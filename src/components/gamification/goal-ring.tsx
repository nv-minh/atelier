"use client";

import { motion } from "motion/react";
import { Check } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { Card } from "@/components/ui/card";

// Circular SVG progress ring for today's XP against the daily goal. Center shows
// today's XP. When the goal is met the ring shifts ember → moss and a subtle
// check appears — a quiet reward, not a fanfare. Token colors keep dark mode
// correct without extra classes.
//
// `variant="raised"`: paired with LevelCard in the same "LEVEL + GOAL" home
// grid row (home-view.tsx) — the two need matching elevation so they read as
// one visual pair rather than mismatched card weights (Task 6's "bo góc lệch
// cặp" lesson applies to elevation just as much as corner radius). Evaluated
// against the new generic ProgressBar "ring" form (Task 8 Step 3) and kept
// bespoke: this ring has framer-motion fill animation, a center XP label, and
// an ember→moss color swap + checkmark on goal-reached that a generic
// primitive would have to grow special cases for, with no other caller to
// justify the abstraction yet.
export function GoalRing({
  todayXp,
  dailyGoalXp,
  delay = 0,
}: {
  todayXp: number;
  dailyGoalXp: number;
  delay?: number;
}) {
  const { t } = useI18n();
  const goal = Math.max(1, dailyGoalXp);
  const ratio = Math.min(1, todayXp / goal);
  const reached = todayXp >= dailyGoalXp;

  const size = 128;
  const stroke = 10;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const dash = circumference * ratio;

  return (
    <Card
      variant="raised"
      className="p-6 sm:p-7 h-full flex flex-col items-center justify-center text-center animate-fade-up"
      style={{ animationDelay: `${delay}ms`, animationFillMode: "both" }}
    >
      <p className="text-[11px] uppercase tracking-wider text-fg-muted font-semibold mb-4 self-start">
        {t("gamify.dailyGoal")}
      </p>
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            strokeWidth={stroke}
            className="stroke-ink/10"
          />
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="round"
            className={reached ? "stroke-moss-500" : "stroke-ember"}
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: circumference - dash }}
            transition={{ ease: "easeOut", duration: 0.7, delay: delay / 1000 + 0.1 }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`display text-3xl tabular-nums ${reached ? "text-moss-500" : ""}`}>
            {todayXp}
          </span>
          <span className="text-[10px] uppercase tracking-wide text-fg-muted">
            {t("gamify.todayXp")}
          </span>
        </div>
      </div>
      <p className="mt-4 text-xs text-fg-muted">
        {reached ? (
          <span className="inline-flex items-center gap-1 text-moss-500 font-medium">
            <Check size={13} /> {t("gamify.goalReached")}
          </span>
        ) : (
          t("gamify.goalOf", { n: dailyGoalXp })
        )}
      </p>
    </Card>
  );
}
