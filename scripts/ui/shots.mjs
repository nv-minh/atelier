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
// Usage:
//   node scripts/ui/shots.mjs --tag=<tag> [--base=http://localhost:3000]
//
// --tag is required (used as the output subdirectory name); --base defaults
// to http://localhost:3000.

import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
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
            await page.evaluate(() => document.fonts.ready);
            const filename = `${routeToSlug(route)}__${theme}__${width}.png`;
            await page.screenshot({ path: path.join(outDir, filename), fullPage: true });
            shotCount++;
          } finally {
            await page.close();
          }
        } catch (err) {
          console.error(`[ui:shots] ${route} @ ${width}px/${theme} failed: ${err.message}`);
        }
      }

      await context.close();
    }
  }

  await browser.close();

  const badList =
    badRoutes.size === 0
      ? "none"
      : [...badRoutes.entries()].map(([route, statuses]) => `${route} (${[...statuses].join(",")})`).join(", ");

  console.log(`[ui:shots] wrote ${shotCount} screenshots to ${outDir} — non-200 routes: ${badList}`);
}

main();
