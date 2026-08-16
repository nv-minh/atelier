"use client";

import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import type { WeeklyRecap as WeeklyRecapData } from "@/lib/stats";

// This ISO week vs last week. Each row shows this-week value, last-week value,
// and a signed delta with a direction glyph. Accuracy shows as a percentage;
// time as minutes. Token classes keep dark mode correct.
export function WeeklyRecap({ data }: { data: WeeklyRecapData }) {
  const { t } = useI18n();
  const { thisWeek, lastWeek, delta } = data;

  const rows = [
    { label: t("gamify.recapReviews"), now: thisWeek.reviews, prev: lastWeek.reviews, d: delta.reviews },
    { label: t("gamify.recapNew"), now: thisWeek.newCards, prev: lastWeek.newCards, d: delta.newCards },
    {
      label: t("gamify.recapTime"),
      now: fmtMin(thisWeek.timeSec),
      prev: fmtMin(lastWeek.timeSec),
      d: Math.round(delta.timeSec / 60),
      dSuffix: "m",
    },
    {
      label: t("gamify.recapAccuracy"),
      now: `${thisWeek.accuracy.toFixed(0)}%`,
      prev: `${lastWeek.accuracy.toFixed(0)}%`,
      d: Math.round(delta.accuracy),
      dSuffix: "pt",
    },
    { label: t("gamify.recapXp"), now: thisWeek.xp, prev: lastWeek.xp, d: delta.xp },
  ];

  return (
    <div className="card-atelier p-6 sm:p-7">
      <div className="flex items-baseline justify-between mb-5">
        <h3 className="display text-lg">{t("gamify.weeklyRecap")}</h3>
        <div className="flex items-center gap-4 text-[11px] uppercase tracking-wide text-fg-muted">
          <span>{t("gamify.thisWeek")}</span>
          <span className="opacity-60">{t("gamify.lastWeek")}</span>
        </div>
      </div>
      <div className="divide-y divide-ink/10">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between py-2.5">
            <span className="text-sm text-fg-muted">{r.label}</span>
            <div className="flex items-center gap-4">
              <Delta value={r.d} suffix={r.dSuffix} />
              <span className="display text-lg tabular-nums w-16 text-right">{r.now}</span>
              <span className="text-sm text-fg-muted opacity-60 tabular-nums w-12 text-right">{r.prev}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function fmtMin(sec: number): string {
  return `${Math.round(sec / 60)}m`;
}

function Delta({ value, suffix = "" }: { value: number; suffix?: string }) {
  if (value === 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs text-fg-muted opacity-60 w-14 justify-end">
        <Minus size={12} />
      </span>
    );
  }
  const up = value > 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-xs font-semibold tabular-nums w-14 justify-end ${
        up ? "text-moss-500" : "text-red-400"
      }`}
    >
      {up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
      {up ? "+" : ""}
      {value}
      {suffix}
    </span>
  );
}
