// Hand-run gate for Plan 1 Task 5 (font swap to Be Vietnam Pro).
//
// Opens /dev/type (src/app/dev/type/page.tsx) on an already-running
// `next dev` server, waits for its canvas glyph-coverage probe to finish,
// and fails if any character fell back to a generic font family
// (data-testid="glyph-fail"). Also prints the production font payload the
// page measured (self-hosted files under _next/static/media only — see the
// page's own 1c section for why the test-harness <link> fetches are
// excluded from that figure).
//
// This does NOT run in CI: production builds 404 every /dev/* route (see
// src/app/dev/layout.tsx + src/middleware.ts), and /dev/* only exists at
// all in dev/preview. It is a tool you run by hand, once, before committing
// a new font — start `npm run dev` in another terminal first.
//
// Usage: node scripts/ui/check-type.mjs [--base=http://localhost:3000]

import { chromium } from "playwright";

function parseArgs(argv) {
  let base = "http://localhost:3000";
  for (const arg of argv) {
    if (arg.startsWith("--base=")) base = arg.slice("--base=".length);
  }
  return { base };
}

async function main() {
  const { base } = parseArgs(process.argv.slice(2));

  try {
    await fetch(base);
  } catch {
    console.error(
      `[check:type] Could not reach ${base}. Start the dev server first: npm run dev`
    );
    process.exit(1);
  }

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(`${base}/dev/type`, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    // The page's own probe runs async work (font loading + per-codepoint
    // canvas measurement) after document.fonts.ready resolves, so poll for
    // its own completion marker instead of guessing a fixed delay.
    await page.waitForSelector('[data-testid="glyph-probe-done"]', { timeout: 30_000 });

    const failures = await page.$$eval('[data-testid="glyph-fail"]', (nodes) =>
      nodes.map((n) => ({
        char: n.getAttribute("data-char"),
        codepoint: n.getAttribute("data-codepoint"),
        family: n.getAttribute("data-family"),
      }))
    );

    const totalKb = await page
      .$eval('[data-testid="font-kb-total"]', (n) => n.getAttribute("data-kb"))
      .catch(() => null);

    if (totalKb !== null) {
      console.log(`[check:type] production font payload (self-hosted, _next/static/media): ${totalKb} KB`);
    }

    if (failures.length > 0) {
      console.error(`[check:type] FAIL — ${failures.length} glyph(s) fell back to a generic font:`);
      for (const f of failures) {
        console.error(`  ${f.family}: "${f.char}" (${f.codepoint})`);
      }
      process.exitCode = 1;
    } else {
      console.log("[check:type] OK — 0 glyph fallbacks across both candidate families.");
    }
  } finally {
    await browser.close();
  }
}

main();
