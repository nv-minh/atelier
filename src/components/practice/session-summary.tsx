"use client";

import { motion } from "motion/react";
import { CheckCircle2, RotateCcw } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { RATING } from "@/lib/practice/types";
import type { SessionSummaryData } from "@/lib/practice/session-state";

export function SessionSummary({
  data,
  remaining,
  durationSec,
  xpGained,
  unsaved,
}: {
  data: SessionSummaryData;
  remaining: { due: number; new: number };
  durationSec: number;
  xpGained: number;
  unsaved: number;
}) {
  const { t } = useI18n();
  const mm = String(Math.floor(durationSec / 60)).padStart(2, "0");
  const ss = String(durationSec % 60).padStart(2, "0");
  const left = remaining.due + remaining.new;

  const rows = [
    { label: t("study.again"), n: data.counts[RATING.Again], color: "text-red-400", dot: "bg-red-400" },
    { label: t("study.hard"), n: data.counts[RATING.Hard], color: "text-ember", dot: "bg-ember-400" },
    { label: t("study.good"), n: data.counts[RATING.Good], color: "text-moss-500", dot: "bg-moss-500" },
    { label: t("study.easy"), n: data.counts[RATING.Easy], color: "text-cefr-a2", dot: "bg-cefr-a2" },
  ];

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-6 py-10">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md"
      >
        <motion.div
          initial={{ scale: 0, rotate: -30 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ delay: 0.1, type: "spring", stiffness: 200 }}
          className="mx-auto mb-5 grid h-20 w-20 place-items-center rounded-full bg-moss-500/15 text-moss-500"
        >
          <CheckCircle2 size={40} strokeWidth={1.5} />
        </motion.div>

        <h2 className="display text-display-md mb-1 text-center">{t("study.sessionComplete")}</h2>
        <p className="text-fg-muted text-center mb-2">{t("study.youReviewed", { n: data.total })}</p>
        {xpGained > 0 && (
          <p className="text-center mb-2 text-sm font-semibold text-ember">
            {t("gamify.xpEarned", { n: xpGained })}
          </p>
        )}
        {unsaved > 0 && (
          <p className="text-center mb-2 text-sm text-red-500">{t("practice.unsavedN", { n: unsaved })}</p>
        )}
        <div className="mb-4" />

        <div className="grid grid-cols-3 gap-3 mb-5">
          <Card variant="flat" className="p-4 text-center">
            <p className="display text-2xl text-moss-500 tabular-nums">{data.pct}%</p>
            <p className="text-[10px] uppercase tracking-wide text-fg-muted">{t("study.accLabel")}</p>
          </Card>
          <Card variant="flat" className="p-4 text-center">
            <p className="display text-2xl tabular-nums">
              {mm}:{ss}
            </p>
            <p className="text-[10px] uppercase tracking-wide text-fg-muted">{t("study.timeLabel")}</p>
          </Card>
          <Card variant="flat" className="p-4 text-center">
            <p className="display text-2xl tabular-nums">{data.bestCombo}</p>
            <p className="text-[10px] uppercase tracking-wide text-fg-muted">{t("practice.comboBest")}</p>
          </Card>
        </div>

        <Card variant="flat" className="p-5 mb-6">
          <p className="text-[11px] uppercase tracking-wider text-fg-muted font-semibold mb-3">
            {t("study.breakdown")}
          </p>
          <div className="space-y-2.5">
            {rows.map((r) => {
              const pct = data.total > 0 ? (r.n / data.total) * 100 : 0;
              return (
                <div key={r.label} className="flex items-center gap-3">
                  <span className="flex items-center gap-2 w-16 shrink-0">
                    <span className={`h-2 w-2 rounded-full ${r.dot}`} />
                    <span className="text-sm">{r.label}</span>
                  </span>
                  <div className="flex-1 h-2 rounded-full bg-ink/8 overflow-hidden">
                    <motion.div
                      className={`h-full ${r.dot}`}
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ delay: 0.2, duration: 0.5 }}
                    />
                  </div>
                  <span className={`text-sm font-semibold tabular-nums w-6 text-right ${r.color}`}>
                    {r.n}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {left > 0 && (
            <Button onClick={() => window.location.reload()} variant="primary" size="md">
              <RotateCcw size={16} /> {t("practice.continueN", { n: left })}
            </Button>
          )}
          <a
            href="/study"
            className="inline-flex items-center justify-center gap-2 rounded-full border border-hairline/10 px-6 py-3 font-medium hover:bg-paper-200/50"
          >
            {t("study.changeMode")}
          </a>
        </div>
      </motion.div>
    </div>
  );
}
