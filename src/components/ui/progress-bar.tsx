import * as React from "react";
import { cn } from "@/lib/utils";

// ProgressBar primitive (Plan 1 Task 8) — two forms: `line` (a horizontal
// fill track) and `ring` (a circular SVG fill). No pure class-string builder
// here (unlike Card/Button/Chip): the two forms render structurally
// different markup (a <div> track vs. an SVG), not just different classes on
// the same element, so there is no shared class matrix worth pulling out —
// see task-8-report.md for why this stayed a single component.
//
// `form="ring"` was evaluated against gamification/goal-ring.tsx (spec's
// explicit candidate) and deliberately NOT used to replace it: GoalRing has
// bespoke behavior (framer-motion fill animation, a center XP label, and an
// ember→moss color swap + checkmark on goal-reached) that would force this
// primitive to grow special cases for a single caller. It ships here anyway,
// demonstrated in /dev/ui, so Plan 2+ has it ready without another task
// re-deciding the same shape.
//
// `form="line"`'s one real caller today: the topic lesson-progress bar in
// src/app/grammar/hub-view.tsx (previously hand-rolled div/div).

export type ProgressBarForm = "line" | "ring";

function clampPct(value: number): number {
  return Math.max(0, Math.min(100, value));
}

export function ProgressBar({
  value,
  form = "line",
  size = 96,
  label,
  className,
}: {
  /** 0–100. */
  value: number;
  form?: ProgressBarForm;
  /** Ring diameter in px — ignored for `form="line"`. */
  size?: number;
  /** Centered content for `form="ring"` — ignored for `form="line"`. */
  label?: React.ReactNode;
  className?: string;
}) {
  const pct = clampPct(value);

  if (form === "ring") {
    const stroke = Math.max(4, Math.round(size * 0.08));
    const r = (size - stroke) / 2;
    const circumference = 2 * Math.PI * r;
    const dash = circumference * (pct / 100);
    return (
      <div className={cn("relative inline-grid place-items-center", className)} style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-hairline/40" />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="round"
            className="stroke-accent transition-all duration-base"
            strokeDasharray={circumference}
            strokeDashoffset={circumference - dash}
          />
        </svg>
        {label && <div className="absolute inset-0 grid place-items-center">{label}</div>}
      </div>
    );
  }

  // `--accent` is the token spec §5.5 assigns to progress bars specifically
  // ("thanh tiến độ"), so the fill needs no extra opacity modifier.
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-hairline/30", className)}
    >
      <div className="h-full rounded-full bg-accent transition-all duration-base" style={{ width: `${pct}%` }} />
    </div>
  );
}
