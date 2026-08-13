"use client";

// Spaced repetition, explained by the shape of the thing rather than by a
// paragraph about it: the gap between one review and the next widens as the
// word sticks. The vertical space between the dots grows with the interval, so
// reading down the column IS the concept — no chart library, no axes.

import { useI18n } from "@/components/i18n-provider";

// Gap in pixels before each row, roughly tracking the real FSRS ramp on a
// compressed (log-ish) scale so the last step stays on screen.
const STEPS = [
  { key: "i1", gap: 0 },
  { key: "i2", gap: 14 },
  { key: "i3", gap: 24 },
  { key: "i4", gap: 38 },
  { key: "i5", gap: 56 },
  { key: "i6", gap: 78 },
] as const;

export function IntervalLadder() {
  const { t } = useI18n();

  return (
    <div className="relative pl-1">
      {/* the rule the dots sit on */}
      <span
        aria-hidden
        className="absolute left-[5px] top-2 bottom-2 w-px bg-gradient-to-b from-ember/50 via-ember/25 to-transparent"
      />

      {/* CSS fade-up on mount rather than a scroll-triggered reveal: a
          whileInView element that never receives its trigger stays at
          opacity 0, and this list carries the explanation, not decoration. */}
      <ol className="relative">
        {STEPS.map((s, n) => (
          <li
            key={s.key}
            style={{ marginTop: s.gap, animationDelay: `${n * 70}ms`, animationFillMode: "both" }}
            className="flex items-center gap-4 animate-fade-up"
          >
            <span
              className={
                n === 0
                  ? "h-[11px] w-[11px] rounded-full bg-ember shrink-0"
                  : "h-[11px] w-[11px] rounded-full border-2 border-ember/45 bg-paper shrink-0"
              }
            />
            <span className="font-mono text-sm text-soft tabular-nums">{t(`landing.how.${s.key}`)}</span>
          </li>
        ))}
      </ol>

      <p className="mt-8 text-xs text-soft/70 leading-relaxed max-w-xs">{t("landing.how.caption")}</p>
    </div>
  );
}
