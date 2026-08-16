// Screenshot tool for the Atelier v2 UI/UX migration (Plan 0 onward).
//
// Every later plan in the migration uses the PNGs this script writes as its
// acceptance artifact (before/after visual diffing), so the capture
// conditions must stay identical across every run:
//
//   - Always point --base at a `next start` (production) server, never
//     `next dev`. Dev serves an unminified bundle, injects the dev overlay
//     (error indicator, route-announcer), and its hydration/timing behaves
//     differently from what real users see — any of that would show up as
//     a spurious visual "diff" between two capture runs that has nothing to
//     do with the actual UI change being screenshotted.
//   - Theme is forced via `localStorage.setItem('theme', ...)` in an
//     `addInitScript` that runs before any page script, NOT via the OS-level
//     `prefers-color-scheme` media feature. The anti-FOUC inline script in
//     src/app/layout.tsx reads the same `theme` localStorage key (falling
//     back to prefers-color-scheme only when the key is absent) and adds the
//     `.dark` class to <html> before first paint. Driving the OS color
//     scheme instead would rely on that fallback path and would not match
//     what a user who has explicitly picked a theme in-app actually sees.
//
// Besides the PNGs, every run also writes manifest.json to the tag's output
// directory: one record per route — { route, finalUrl, status, redirected,
// files[] }. page.goto() silently follows HTTP redirects (a gated route like
// /study can 307 to /login and still resolve with a 200 response), so the
// manifest is what lets later tooling detect a redirected/mismatched route
// mechanically — by diffing two tags' manifests — instead of relying on a
// human reading the stdout summary line.
//
// Usage:
//   node scripts/ui/shots.mjs --tag=<tag> [--base=http://localhost:3000]
//
// --tag is required (used as the output subdirectory name); --base defaults
// to http://localhost:3000.

import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

// Fixed route list — do not derive this from the filesystem router. A hard
// list keeps every capture run comparable across plans even if routes are
// added/removed/renamed during the migration.
const ROUTES = [
  "/",
  "/topics",
  "/topics/food",
  "/browse",
  "/study",
  "/notebook",
  "/stats",
  "/leaderboard",
  "/settings",
  "/grammar",
  "/onboarding",
  "/login",
];

const WIDTHS = [375, 768, 1280];
const THEMES = ["light", "dark"];

// Arbitrary; only matters for the initial (non-fullPage) layout pass before
// screenshot({ fullPage: true }) captures the real, possibly-taller, page.
const VIEWPORT_HEIGHT = 900;

function parseArgs(argv) {
  let tag = null;
  let base = "http://localhost:3000";
  for (const arg of argv) {
    if (arg.startsWith("--tag=")) tag = arg.slice("--tag=".length);
    else if (arg.startsWith("--base=")) base = arg.slice("--base=".length);
  }
  return { tag, base };
}

// "/" -> "root"; "/topics/food" -> "topics_food"
function routeToSlug(route) {
  if (route === "/") return "root";
  return route.replace(/^\//, "").replace(/\//g, "_");
}

// Opens `${base}/grammar`, finds the first link whose path matches
// ^/grammar/[^/]+$, and returns [thatPath, `${thatPath}/lesson/1`].
// Returns [] (with a warning on stdout) if no such link is found — the
// caller must not hard-code a topic slug that could go stale.
async function discoverGrammarRoutes(browser, base) {
  const context = await browser.newContext({ deviceScaleFactor: 2 });
  try {
    const page = await context.newPage();
    await page.goto(`${base}/grammar`, { waitUntil: "networkidle" });
    const hrefPath = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll("a[href]"));
      for (const a of links) {
        try {
          const p = new URL(a.href, window.location.origin).pathname;
          if (/^\/grammar\/[^/]+$/.test(p)) return p;
        } catch {
          // ignore unparsable hrefs
        }
      }
      return null;
    });
    if (!hrefPath) {
      console.warn(
        "[ui:shots] Could not find a /grammar/<topic> link on /grammar — skipping the two inferred routes."
      );
      return [];
    }
    return [hrefPath, `${hrefPath}/lesson/1`];
  } catch (err) {
    console.warn(
      `[ui:shots] Failed to discover /grammar sub-routes (${err.message}) — skipping the two inferred routes.`
    );
    return [];
  } finally {
    await context.close();
  }
}

// Determine whether the navigation actually got redirected, by walking
// response.request().redirectedFrom() back to the original request.
//
// page.goto() follows HTTP redirects transparently and resolves with the
// *final* response, so comparing response.url() (or page.url()) against the
// requested URL only tells us the end state — it can't distinguish "the
// server redirected us" from other reasons the two strings might not be
// byte-identical (e.g. a trailing slash Next.js normalizes on its own).
// Walking redirectedFrom() instead confirms an actual browser-level HTTP
// redirect chain exists between the requested URL and the final response.
function detectRedirect(response) {
  const chain = [];
  let req = response.request();
  while (req) {
    chain.unshift(req.url());
    req = req.redirectedFrom();
  }
  return { redirected: chain.length > 1, chain };
}

// Strips the --base prefix off an absolute URL for readable stdout output
// (manifest.json keeps the full absolute URL — it's meant for tooling, not
// eyeballs, and must stay unambiguous regardless of --base).
function stripBase(url, base) {
  return url.startsWith(base) ? url.slice(base.length) : url;
}

async function main() {
  const { tag, base } = parseArgs(process.argv.slice(2));
  if (!tag) {
    console.error("[ui:shots] Missing required --tag=<tag> argument. Example: --tag=t00-baseline");
    process.exit(1);
  }

  const outDir = path.join(process.cwd(), "data", "ui-shots", tag);
  await mkdir(outDir, { recursive: true });

  const browser = await chromium.launch();

  const inferredRoutes = await discoverGrammarRoutes(browser, base);
  const routes = [...ROUTES, ...inferredRoutes];

  let shotCount = 0;
  // route -> Set of non-200 statuses observed for it, across widths/themes.
  const badRoutes = new Map();
  // route -> { route, finalUrl, status, redirected, files[] }. One entry per
  // route, aggregated across every width/theme capture — redirect/status is
  // a server-side property of the route, not of the viewport we requested it
  // at. Written to manifest.json at the end (see file header comment).
  const manifest = new Map();

  for (const theme of THEMES) {
    for (const width of WIDTHS) {
      const context = await browser.newContext({
        viewport: { width, height: VIEWPORT_HEIGHT },
        deviceScaleFactor: 2,
        colorScheme: theme,
      });
      // Must run before any navigation so the anti-FOUC script in
      // src/app/layout.tsx sees `theme` already set on first paint.
      await context.addInitScript((t) => {
        localStorage.setItem("theme", t);
      }, theme);

      for (const route of routes) {
        // One broken route must never abort the whole capture run.
        try {
          const page = await context.newPage();
          try {
            const response = await page.goto(`${base}${route}`, { waitUntil: "networkidle" });
            const status = response ? response.status() : null;
            if (status !== null && status !== 200) {
              if (!badRoutes.has(route)) badRoutes.set(route, new Set());
              badRoutes.get(route).add(status);
            }
            const { redirected } = response ? detectRedirect(response) : { redirected: false };
            const finalUrl = response ? response.url() : null;
            await page.evaluate(() => document.fonts.ready);
            const filename = `${routeToSlug(route)}__${theme}__${width}.png`;
            await page.screenshot({ path: path.join(outDir, filename), fullPage: true });
            shotCount++;

            const entry = manifest.get(route) ?? { route, finalUrl, status, redirected, files: [] };
            entry.finalUrl = finalUrl;
            entry.status = status;
            entry.redirected = redirected;
            entry.files.push(filename);
            delete entry.error; // a successful capture supersedes an earlier failed attempt
            manifest.set(route, entry);
          } finally {
            await page.close();
          }
        } catch (err) {
          console.error(`[ui:shots] ${route} @ ${width}px/${theme} failed: ${err.message}`);
          // Seed a manifest entry so a route that fails on every attempt
          // still shows up when a later plan diffs two tags' manifests,
          // instead of silently disappearing. A subsequent successful
          // capture (different width/theme) overwrites this via the `?? `
          // fallback above/below.
          if (!manifest.has(route)) {
            manifest.set(route, {
              route,
              finalUrl: null,
              status: null,
              redirected: null,
              files: [],
              error: err.message,
            });
          }
        }
      }

      await context.close();
    }
  }

  await browser.close();

  const manifestPath = path.join(outDir, "manifest.json");
  await writeFile(manifestPath, `${JSON.stringify([...manifest.values()], null, 2)}\n`);

  const badList =
    badRoutes.size === 0
      ? "none"
      : [...badRoutes.entries()].map(([route, statuses]) => `${route} (${[...statuses].join(",")})`).join(", ");

  // Redirected is its own category, separate from non-200: a redirected
  // route can still resolve with a 200 (e.g. /study -> /login, which itself
  // renders fine), so it would never show up in `badList` above even though
  // the PNG is not a picture of the route its filename claims.
  const redirectedEntries = [...manifest.values()].filter((e) => e.redirected);
  const redirectedList =
    redirectedEntries.length === 0
      ? "none"
      : redirectedEntries.map((e) => `${e.route} -> ${stripBase(e.finalUrl, base)}`).join(", ");

  console.log(
    `[ui:shots] wrote ${shotCount} screenshots to ${outDir} — non-200 routes: ${badList} — redirected: ${redirectedList} — manifest: ${manifestPath}`
  );
}

main();
