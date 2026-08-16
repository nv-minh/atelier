"use client";

import Link from "next/link";
import { Flame } from "lucide-react";
import { StatCard } from "@/components/stats/stat-card";
import { CefrProgress } from "@/components/stats/cefr-progress";
import { ActivityHeatmap } from "@/components/stats/heatmap";
import { ForecastChart, AccuracyChart } from "@/components/stats/charts";
import { WeeklyRecap } from "@/components/gamification/weekly-recap";
import { BadgeGallery } from "@/components/gamification/badge-gallery";
import { useI18n } from "@/components/i18n-provider";
import { Card } from "@/components/ui/card";
import type { WeeklyRecap as WeeklyRecapData } from "@/lib/stats";
import type { GamificationSummary } from "@/lib/gamification";

export function StatsView({
  stats,
  heatmap,
  forecast,
  accuracy,
  leeches,
  recap,
  gamify,
}: {
  stats: any;
  heatmap: any[];
  forecast: any[];
  accuracy: any[];
  leeches: { word: string; lapses: number }[];
  recap: WeeklyRecapData;
  gamify: GamificationSummary;
}) {
  const { t } = useI18n();

  return (
    <main className="shell py-10 sm:py-14 pb-28 md:pb-14">
      <header className="mb-10 max-w-2xl">
        <p className="text-sm text-fg-muted font-mono mb-3">{t("stats.header")}</p>
        <h1 className="display text-display-lg mb-3">
          {t("stats.title")} <span className="display-it text-ember">{t("stats.titleAccent")}</span>
        </h1>
        <p className="text-fg-muted text-lg leading-relaxed">{t("stats.subtitle")}</p>
      </header>

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <StatCard label={t("stats.totalStudied")} value={stats.totalCards} sub={t("stats.of", { n: stats.totalWords.toLocaleString() })} />
        <StatCard label={t("stats.learnedLabel")} value={stats.learnedCards} accent="text-moss-500" sub={t("stats.learnedSub")} delay={60} />
        <StatCard label={t("stats.streakLabel")} value={`${stats.streak}d`} sub={t("stats.streakSub")} delay={120} />
        <StatCard label={t("stats.recallLabel")} value={`${stats.accuracy.toFixed(0)}%`} accent="text-ember" sub={t("stats.recallSub")} delay={180} />
      </section>

      <section className="mb-6">
        <WeeklyRecap data={recap} />
      </section>

      <section className="grid lg:grid-cols-2 gap-4 sm:gap-6 mb-6">
        <ForecastChart data={forecast} />
        <AccuracyChart data={accuracy} />
      </section>

      <section className="mb-6">
        <CefrProgress stats={stats.cefrStats} />
      </section>

      <section className="mb-6">
        <BadgeGallery unlockedKeys={gamify.unlockedKeys} unlockedAt={gamify.unlockedAt} />
      </section>

      {leeches.length > 0 && (
        <section className="mb-6">
          <Card variant="flat" className="p-6 sm:p-7">
            <div className="flex items-center gap-2 mb-4">
              <span className="inline-grid h-8 w-8 place-items-center rounded-full bg-red-400/10 text-red-400">
                <Flame size={15} />
              </span>
              <h3 className="display text-lg">{t("stats.leechTitle")}</h3>
            </div>
            <ul className="grid gap-1.5">
              {leeches.map((l) => (
                <li key={l.word}>
                  <Link
                    href={`/word/${encodeURIComponent(l.word)}`}
                    className="flex items-baseline justify-between gap-4 rounded-lg px-3 py-2 hover:bg-paper-200/50 transition-colors"
                  >
                    <span className="display text-base hover:text-ember transition-colors">{l.word}</span>
                    <span className="text-xs text-red-400 font-semibold tabular-nums shrink-0">
                      {t("stats.leechLapses", { n: l.lapses })}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            <Link
              href="/notebook?tab=leeches"
              className="inline-block mt-3 text-sm text-fg-muted hover:text-ember transition-colors"
            >
              {t("stats.leechLink")} →
            </Link>
          </Card>
        </section>
      )}

      <section>
        <ActivityHeatmap data={heatmap} />
      </section>
    </main>
  );
}
