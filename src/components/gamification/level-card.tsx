"use client";

import { motion } from "motion/react";
import { Trophy } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";

// Level + XP progress bar to the next level. Mirrors stat-card.tsx / TodayCard
// styling (card-atelier, display type, Atelier tokens) so it slots into the home
// grid without visual seams. Dark mode is inherited via the token classes.
export function LevelCard({
  level,
  currentLevelXp,
  nextLevelXp,
  progress01,
  xp,
  delay = 0,
}: {
  level: number;
  currentLevelXp: number;
  nextLevelXp: number;
  progress01: number;
  xp: number;
  delay?: number;
}) {
  const { t } = useI18n();
  const pct = Math.round(progress01 * 100);

  return (
    <div
      className="card-atelier p-6 sm:p-7 h-full flex flex-col justify-between animate-fade-up"
      style={{ animationDelay: `${delay}ms`, animationFillMode: "both" }}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-fg-muted font-semibold mb-1">
            {t("gamify.level")}
          </p>
          <p className="display text-4xl tabular-nums">{level}</p>
          <p className="text-xs text-fg-muted mt-0.5">{t("gamify.xpTotal", { n: xp.toLocaleString() })}</p>
        </div>
        <span className="inline-grid h-9 w-9 place-items-center rounded-full bg-ember/10 text-ember">
          <Trophy size={16} />
        </span>
      </div>

      <div className="mt-5">
        <div className="flex items-baseline justify-between mb-1.5">
          <span className="text-[11px] uppercase tracking-wide text-fg-muted">
            {t("gamify.xpToNext", { n: Math.max(0, nextLevelXp - currentLevelXp) })}
          </span>
          <span className="text-xs text-fg-muted tabular-nums">
            {currentLevelXp} / {nextLevelXp}
          </span>
        </div>
        <div className="h-2 rounded-full bg-ink/10 overflow-hidden">
          <motion.div
            className="h-full bg-ember rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ ease: "easeOut", duration: 0.6, delay: delay / 1000 + 0.1 }}
          />
        </div>
      </div>
    </div>
  );
}
