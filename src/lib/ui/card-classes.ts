// Pure class-string builder behind the Card primitive (Plan 1 "Atelier v2",
// Task 8). No DOM, no React — kept trivially unit-testable, see
// card-classes.test.ts for the full variant matrix. Mirrors the retired
// `.card-atelier` CSS class (globals.css, deleted this task): same
// surface/border/radius/shadow, now split into 3 variants instead of one.

export type CardVariant = "flat" | "raised" | "interactive";

// Shared by every variant — alone, this reproduces the old `.card-atelier`
// look exactly (rgb(var(--bg-surface-rgb)) / border-hairline at 0.8 alpha /
// --r-xl / --shadow-sm, see the retired globals.css:80-85).
const BASE = "rounded-xl border border-hairline/80 bg-surface";

const VARIANT_CLASSES: Record<CardVariant, string> = {
  // 1:1 replacement for the retired `.card-atelier` class — plain content
  // containers (settings sections, stat panels, empty states, …) use this
  // unchanged.
  flat: `${BASE} shadow-sm`,
  // Stronger lift for the rare single "hero" dashboard tile that needs to
  // read as more prominent than a plain content box — spec §2.2's cue for
  // emphasis is elevation, not a different hue. Real callers: GoalRing +
  // LevelCard, the home page's paired XP-progress tiles (kept visually
  // matched to each other — see task-8-report.md).
  raised: `${BASE} shadow-md`,
  // Clickable cards/list rows (Link, onClick) — centralizes the hover/active
  // feedback every existing clickable `.card-atelier` site already hand-wrote
  // (hover:-translate-y-0.5 hover:border-ember/30, now the accent token).
  interactive: `${BASE} shadow-sm transition-all duration-base hover:-translate-y-0.5 hover:border-accent/30 hover:shadow-md active:scale-[.99]`,
};

/**
 * Exported so call sites that can't render a bare <div> — e.g. the `<Link>`/
 * `<ul>`/`<ol>`/`<section>`/`motion.div` card sites this task migrates — can
 * still get Card's exact classes without losing their element type. Same
 * precedent as buttonClasses()/chipClasses() in Task 6/7.
 */
export function cardClasses(variant: CardVariant = "flat"): string {
  return VARIANT_CLASSES[variant];
}
