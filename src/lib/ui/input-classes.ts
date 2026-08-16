// Pure class-string builder behind the Input primitive (Plan 1 "Atelier v2",
// Task 9). No DOM, no React — see input-classes.test.ts for the full form
// matrix.
//
// font-size: 16px is NON-NEGOTIABLE (spec §14.12 / §10 item 12): anything
// smaller triggers iOS Safari's auto-zoom on focus. Written as the literal
// arbitrary value `text-[16px]` rather than Tailwind's `text-base` so it can
// never silently drift if the core font-size scale changes elsewhere (the
// gate's Playwright check reads the browser's *computed* font-size, not this
// source string, precisely because a class name alone doesn't prove
// anything — see task-9-report.md).
//
// `focus:border-accent`, not `focus:border-ember`: spec §5.5's color-role
// table assigns "focus" to --accent explicitly. The two are numerically
// IDENTICAL today — tailwind.config.ts's `ember.DEFAULT` already points at
// `--accent-rgb` (Task 3's v1-compat remap) — so this is a zero-visual-diff
// naming fix, not a color change. Same category of fix as Task 8's
// `bg-ember/70` → `bg-accent` in grammar/hub-view.tsx: the legacy name reads
// as the wrong role even though the pixels are already correct.

export type InputForm = "text" | "search";

const BASE =
  "h-12 w-full rounded-full border border-hairline/10 bg-surface text-[16px] text-fg " +
  "placeholder:text-fg-muted outline-none transition-colors duration-instant " +
  "focus:border-accent disabled:opacity-50 disabled:pointer-events-none";

// `search` reserves left padding for the leading icon <Input> renders itself
// (see input.tsx); `text` has no icon, so it gets even horizontal padding.
const FORM_CLASSES: Record<InputForm, string> = {
  text: "px-4",
  search: "pl-11 pr-4",
};

export function inputClasses(form: InputForm = "text"): string {
  return `${BASE} ${FORM_CLASSES[form]}`;
}
