// cefr-stamp.ts — pure class-string builder behind <CefrStamp> (Plan 1
// "Atelier v2", Task 7). No DOM, no React — see cefr-stamp.test.ts for the
// full 5-level matrix. This is the "progress stamp" signature from the kit
// spec (01-plan.md §2.3) and design spec §5.4: A1→C1 is ONE progression, not
// five unrelated colors, so it's coded as a single blue hue getting bolder —
// faint border → solid border → light fill → solid fill → solid ink.
//
// `cefr.a1…c1` (tailwind.config.ts) is a v1-compat alias already pointing at
// --p-blue-200/400/500/600/800 (design spec §5.4), so this reuses that scale
// rather than inventing new tokens.
//
// ── Contrast fix (deviation from the literal spec formula, see
// task-7-report.md for the full WCAG numbers) ──────────────────────────────
// The spec's literal per-level formula colors A1/A2/B1's text with
// `text-cefr-a1/a2/b1` (the same raw blue as the border/fill). Measured with
// the WCAG relative-luminance formula (same method Task 3 used) against the
// real page backgrounds (`bg-canvas`/`bg-surface`, both themes):
//   - A1 (blue-200) on light canvas/surface: 1.43:1 / 1.53:1 — fails even the
//     3:1 large-text floor.
//   - A2 (blue-400) on light canvas/surface: 3.08:1 / 3.30:1 — passes 3:1
//     (large text only), fails 4.5:1 (normal text; text-2xs is far below the
//     large-text size threshold).
//   - B1 (blue-500) on its own bg-cefr-b1/10 tint: 3.42–4.12:1 across both
//     themes — fails 4.5:1 in every combination measured.
// Dark mode alone would have been fine (11–12:1, 5.4–5.8:1) — the primitive
// `--p-blue-*` values aren't retuned per theme, so the failure is
// light-mode-specific. `text-fg-on-tint` is the themed role token built
// exactly for "colored text over a tint" (light: --p-blue-700, dark: an
// explicit lighter blue) and measures ≥6.6:1 in every combination tried
// (page bg AND the b1/10 tint, both themes) — see task-7-report.md. Swapping
// only how CefrStamp *applies* text color (not the shared `cefr.*` scale,
// which other call sites still read) is the fix authorized by task-7-brief.md
// Step 4 when measurement shows a real problem.
//
// B2 fill fix (controller, on top of the implementer's flagged finding):
// `text-fg-on-accent` (white) on the spec'd `bg-cefr-b2/70` measured
// 3.43–3.52:1 in light mode (dark mode: 8.8–9.2:1) — under 4.5:1, and unlike
// A1/A2/B1 there's no border/tint text-color escape hatch here (the text is
// fixed white-on-fill), so the fix has to move the fill opacity instead.
// Re-measured across 70/75/80/85/90/95/100%: 90% clears 4.5:1 on both the
// light canvas (5.19:1) and light surface (5.15:1) backgrounds a stamp can
// sit on, while dark mode — already far above threshold — stays comfortably
// clear (8.8–9.2:1 either way). Still visually "nền đậm" (solid-ish fill,
// per §2.3), just not literally 70%.

const SHARED = "font-mono text-2xs uppercase h-5 rounded-pill px-2";

export function cefrStampClasses(level: string): string {
  switch (level) {
    case "A1":
      // Viền mờ — faint border, no fill.
      return `border border-cefr-a1/40 text-fg-on-tint bg-transparent ${SHARED}`;
    case "A2":
      // Viền rõ — solid (100% opacity) border, still no fill.
      return `border border-cefr-a2 text-fg-on-tint bg-transparent ${SHARED}`;
    case "B1":
      // Nền nhạt — light fill starts here.
      return `border border-cefr-b1/30 text-fg-on-tint bg-cefr-b1/10 ${SHARED}`;
    case "B2":
      // Nền đậm — solid-ish fill, white text (see note above re: light-mode contrast).
      return `border-transparent text-fg-on-accent bg-cefr-b2/90 ${SHARED}`;
    case "C1":
      // Mực đặc — full ink, white text.
      return `border-transparent text-fg-on-accent bg-cefr-c1 ${SHARED}`;
    default:
      // Defensive: `Word.cefr` is a required, non-null DB column constrained
      // in practice to CEFR_LEVELS (src/lib/export-format.ts), but this
      // component's prop type is `string` (per task-7-brief.md), so an
      // unrecognized value degrades to a neutral chip instead of throwing.
      return `border border-hairline text-fg-muted bg-transparent ${SHARED}`;
  }
}
