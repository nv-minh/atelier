"use client";

import Link from "next/link";
import { useI18n } from "@/components/i18n-provider";
import { cn } from "@/lib/utils";
import type { TopicSummary } from "@/lib/topics-data";

export function TopicsGridView({ topics }: { topics: TopicSummary[] }) {
  const { t } = useI18n();
  const totalCovered = topics.reduce((s, tp) => s + tp.count, 0);

  return (
    <main className="shell py-10 sm:py-14 pb-28 md:pb-14">
      <header className="mb-10 max-w-2xl">
        <p className="text-sm text-soft font-mono mb-3">{t("topics.header")}</p>
        <h1 className="display text-display-lg mb-3">
          {t("topics.title")} <span className="display-it text-ember">{t("topics.titleAccent")}</span>
        </h1>
        <p className="text-soft text-lg leading-relaxed">
          {t("topics.subtitle", { n: totalCovered.toLocaleString(), t: topics.length })}
        </p>
      </header>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {topics.map((tp, i) => (
          <Link
            key={tp.slug}
            href={`/topics/${tp.slug}`}
            className="group card-atelier p-6 hover:-translate-y-0.5 transition-all border hover:border-ember/30 flex flex-col"
            style={{ animationDelay: `${i * 40}ms` }}
          >
            <div className="flex items-start justify-between mb-4">
              <span className="text-3xl">{tp.emoji}</span>
              <span className={cn("display text-2xl tabular-nums", tp.accent)}>{tp.count}</span>
            </div>
            <h3 className="display text-xl mb-1">{t(`topics.names.${tp.slug}`)}</h3>
            <p className="text-xs text-soft leading-relaxed mb-4 flex-1">{t(`topics.blurbs.${tp.slug}`)}</p>
            {tp.preview.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-3 border-t border-line">
                {tp.preview.map((w) => (
                  <span key={w} className="text-[11px] rounded-full bg-ink/5 text-soft px-2 py-0.5">
                    {w}
                  </span>
                ))}
                <span className="text-[11px] text-soft/60 px-1 self-center">→</span>
              </div>
            )}
          </Link>
        ))}
      </div>
    </main>
  );
}
