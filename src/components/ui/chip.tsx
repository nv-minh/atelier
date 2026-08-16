import * as React from "react";
import { cn } from "@/lib/utils";

export type ChipVariant = "tag" | "filter" | "choice";

type ChipProps = {
  variant?: ChipVariant;
  active?: boolean; // chỉ có ý nghĩa với filter/choice
  className?: string;
  children: React.ReactNode;
} & React.HTMLAttributes<HTMLSpanElement>;

// Shape shared by every variant — layout/size only, no color (colors are
// per-variant below, and `variant="tag"` — the only one with real call sites
// today — deliberately ships no border color: `border border-transparent` so
// a call site's own `border-{color}` override (several of the 21 migrated
// `.pill` sites tint the whole chip red/moss/etc. via className) still shows
// a real 1px line, not a 0-width one.
const BASE = "inline-flex items-center justify-center gap-1 h-[34px] px-3 rounded-pill";

// `variant="tag"` (default) replaces the old `.pill` CSS class (globals.css,
// now deleted) — the 21 real `<span>`/`<Link>`/`<p>` call sites this task
// migrates onto <Chip>/chipClasses(). Typography matches `.pill`'s former
// declaration (font-size/weight/tracking/uppercase); several call sites pass
// `text-[9px]`/`text-[10px]`/`text-[11px]` via `className` to shrink it
// further — `cn()` (tailwind-merge) resolves that correctly because
// `className` is always merged AFTER these defaults (see Chip below).
// `tracking-overline` is NOT a standalone Tailwind utility (it only exists
// baked into the `text-2xs` fontSize entry in tailwind.config.ts) — so unlike
// CefrStamp (which uses `text-2xs` and gets it for free), Chip needs the
// literal token via an arbitrary-value class.
const TAG_CLASSES =
  "border border-transparent bg-sunken text-fg-muted " +
  "text-[0.7rem] font-semibold uppercase tracking-[var(--tracking-overline)]";

// `variant="filter"`/`"choice"` have no real call site yet — all 21 `.pill`
// sites migrated in this task are static tags (verified before writing
// task-7-brief.md: the interactive CEFR filter chips in
// library-client.tsx/cefr-filter.tsx use their own class, handled in Task 6).
// Built ahead per the spec kit so Plan 2/4's real filter UI can use it as-is.
function toggleClasses(active?: boolean): string {
  return active ? "bg-accent text-fg-on-accent" : "bg-sunken text-fg-muted";
}

/**
 * Pure class-string builder behind <Chip>. Exported separately so call sites
 * that can't render a bare <span> — e.g. the 3 synonym/antonym/topic `<Link>`
 * pills in word-detail-client.tsx, which need real navigation — can still get
 * Chip's exact classes without losing their element type.
 */
export function chipClasses(variant: ChipVariant = "tag", active?: boolean): string {
  return cn(BASE, variant === "tag" ? TAG_CLASSES : toggleClasses(active));
}

export function Chip({ variant = "tag", active, className, children, ...props }: ChipProps) {
  return (
    <span className={cn(chipClasses(variant, active), className)} {...props}>
      {children}
    </span>
  );
}
