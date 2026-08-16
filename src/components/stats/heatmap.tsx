"use client";

import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { useI18n } from "@/components/i18n-provider";

type Day = { date: string; count: number; newCards: number; reviews: number };

export function ActivityHeatmap({ data }: { data: Day[] }) {
  const { t } = useI18n();
  const [hover, setHover] = useState<Day | null>(null);
  const max = useMemo(() => Math.max(1, ...data.map((d) => d.count)), [data]);

  // group into weeks (columns of 7)
  const weeks = useMemo(() => {
    const weeks: Day[][] = [];
    let current: Day[] = [];
    // pad start to align weekday
    const firstDow = new Date(data[0]?.date ?? Date.now()).getDay();
    for (let i = 0; i < firstDow; i++) current.push({ date: "", count: -1, newCards: 0, reviews: 0 });
    for (const d of data) {
      current.push(d);
      if (current.length === 7) {
        weeks.push(current);
        current = [];
      }
    }
    if (current.length) weeks.push(current);
    return weeks;
  }, [data]);

  const monthLabels = useMemo(() => {
    const labels: { idx: number; label: string }[] = [];
    let lastMonth = -1;
    weeks.forEach((w, i) => {
      const valid = w.find((d) => d.date);
      if (!valid) return;
      const m = new Date(valid.date).getMonth();
      if (m !== lastMonth) {
        labels.push({ idx: i, label: new Date(valid.date).toLocaleString("en", { month: "short" }) });
        lastMonth = m;
      }
    });
    return labels;
  }, [weeks]);

  const level = (c: number) => {
    if (c <= 0) return "bg-ink/8";
    const r = c / max;
    if (r < 0.25) return "bg-ember/25";
    if (r < 0.5) return "bg-ember/50";
    if (r < 0.75) return "bg-ember/75";
    return "bg-ember";
  };

  return (
    <div className="card-atelier p-6 sm:p-7">
      <div className="flex items-baseline justify-between mb-5">
        <div>
          <h3 className="display text-xl">{t("stats.activity")}</h3>
          <p className="text-xs text-fg-muted mt-0.5">{t("stats.activitySub")}</p>
        </div>
        {hover && hover.date ? (
          <div className="text-right">
            <p className="text-sm font-semibold tabular-nums">{t("stats.nReviews", { n: hover.count })}</p>
            <p className="text-xs text-fg-muted">{hover.date}</p>
          </div>
        ) : (
          <span className="text-xs text-fg-muted font-mono">{t("stats.hoverDay")}</span>
        )}
      </div>

      <div className="overflow-x-auto scrollbar-hide -mx-1 px-1">
        <div className="inline-flex flex-col gap-1 min-w-max">
          {/* month labels */}
          <div className="flex gap-1 pl-0 mb-0.5 relative h-3">
            {monthLabels.map((m) => (
              <span
                key={m.idx}
                className="text-[10px] text-fg-muted absolute"
                style={{ left: `calc(${m.idx} * 15px)` }}
              >
                {m.label}
              </span>
            ))}
          </div>
          <div className="flex gap-1">
            {weeks.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-1">
                {week.map((day, di) =>
                  day.count < 0 ? (
                    <div key={di} className="h-3 w-3" />
                  ) : (
                    <motion.div
                      key={di}
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: Math.min(0.5, (wi * 7 + di) * 0.001) }}
                      whileHover={{ scale: 1.4, zIndex: 10 }}
                      onMouseEnter={() => setHover(day)}
                      onMouseLeave={() => setHover(null)}
                      className={`h-3 w-3 rounded-sm ${level(day.count)} ${day.count > 0 ? "ring-0" : ""} cursor-pointer`}
                      title={`${day.date}: ${day.count}`}
                    />
                  )
                )}
              </div>
            ))}
          </div>
          <div className="flex items-center justify-end gap-1.5 mt-2">
            <span className="text-[10px] text-fg-muted">{t("stats.less")}</span>
            <div className="h-3 w-3 rounded-sm bg-ink/8" />
            <div className="h-3 w-3 rounded-sm bg-ember/25" />
            <div className="h-3 w-3 rounded-sm bg-ember/50" />
            <div className="h-3 w-3 rounded-sm bg-ember/75" />
            <div className="h-3 w-3 rounded-sm bg-ember" />
            <span className="text-[10px] text-fg-muted">{t("stats.more")}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
