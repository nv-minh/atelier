"use client";

import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/components/i18n-provider";
import { Card } from "@/components/ui/card";

const colors: Record<string, string> = {
  A1: "bg-cefr-a1",
  A2: "bg-cefr-a2",
  B1: "bg-cefr-b1",
  B2: "bg-cefr-b2",
  C1: "bg-cefr-c1",
};

export function CefrProgress({ stats }: { stats: Array<{ level: string; total: number; learned: number; learning: number; unseen: number }> }) {
  const { t } = useI18n();
  return (
    <Card variant="flat" className="p-6 sm:p-7">
      <div className="flex items-baseline justify-between mb-5">
        <h3 className="display text-xl">{t("stats.masteryByLevel")}</h3>
        <span className="text-xs text-fg-muted font-mono">CEFR</span>
      </div>
      <div className="space-y-4">
        {stats.map((s, i) => {
          const learnedPct = s.total ? (s.learned / s.total) * 100 : 0;
          const learningPct = s.total ? (s.learning / s.total) * 100 : 0;
          return (
            <div key={s.level}>
              <div className="flex items-baseline justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span className={cn("h-2 w-2 rounded-full", colors[s.level])} />
                  <span className="text-sm font-semibold">{s.level}</span>
                  <span className="text-xs text-fg-muted">
                    {s.learned}/{s.total} · {t("stats.learnedLegend").toLowerCase()}
                  </span>
                </div>
                <span className="text-xs font-mono text-fg-muted tabular-nums">{learnedPct.toFixed(0)}%</span>
              </div>
              <div className="h-2.5 rounded-full bg-ink/8 overflow-hidden flex">
                <motion.div
                  className={cn("h-full", colors[s.level])}
                  initial={{ width: 0 }}
                  animate={{ width: `${learnedPct}%` }}
                  transition={{ delay: 0.1 + i * 0.08, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                />
                <motion.div
                  className="h-full bg-ink/20"
                  initial={{ width: 0 }}
                  animate={{ width: `${learningPct}%` }}
                  transition={{ delay: 0.15 + i * 0.08, duration: 0.6 }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex gap-4 mt-5 pt-4 border-t border-hairline/10 text-xs text-fg-muted">
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-ink/60" /> {t("stats.learnedLegend")}</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-ink/20" /> {t("stats.learningLegend")}</span>
      </div>
    </Card>
  );
}
