"use client";

import { StatCard } from "@/components/stats/stat-card";
import { CefrProgress } from "@/components/stats/cefr-progress";
import { ActivityHeatmap } from "@/components/stats/heatmap";
import { ForecastChart, AccuracyChart } from "@/components/stats/charts";
import { useI18n } from "@/components/i18n-provider";

export function StatsView({
  stats,
  heatmap,
  forecast,
  accuracy,
}: {
  stats: any;
  heatmap: any[];
  forecast: any[];
  accuracy: any[];
}) {
  const { t } = useI18n();

  return (
    <main className="shell py-10 sm:py-14 pb-28 md:pb-14">
      <header className="mb-10 max-w-2xl">
        <p className="text-sm text-soft font-mono mb-3">{t("stats.header")}</p>
        <h1 className="display text-display-lg mb-3">
          {t("stats.title")} <span className="display-it text-ember">{t("stats.titleAccent")}</span>
        </h1>
        <p className="text-soft text-lg leading-relaxed">{t("stats.subtitle")}</p>
      </header>

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <StatCard label={t("stats.totalStudied")} value={stats.totalCards} sub={t("stats.of", { n: stats.totalWords.toLocaleString() })} />
        <StatCard label={t("stats.learnedLabel")} value={stats.learnedCards} accent="text-moss-500" sub={t("stats.learnedSub")} delay={60} />
        <StatCard label={t("stats.streakLabel")} value={`${stats.streak}d`} sub={t("stats.streakSub")} delay={120} />
        <StatCard label={t("stats.recallLabel")} value={`${stats.accuracy.toFixed(0)}%`} accent="text-ember" sub={t("stats.recallSub")} delay={180} />
      </section>

      <section className="grid lg:grid-cols-2 gap-4 sm:gap-6 mb-6">
        <ForecastChart data={forecast} />
        <AccuracyChart data={accuracy} />
      </section>

      <section className="mb-6">
        <CefrProgress stats={stats.cefrStats} />
      </section>

      <section>
        <ActivityHeatmap data={heatmap} />
      </section>
    </main>
  );
}
