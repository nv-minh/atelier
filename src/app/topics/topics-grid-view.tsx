"use client";

import Link from "next/link";
import { Lock } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { useGuestGuard } from "@/components/auth-gate";
import { cn } from "@/lib/utils";
import type { TopicSummary } from "@/lib/topics-data";

export function TopicsGridView({
  topics,
  authed = true,
}: {
  topics: TopicSummary[];
  authed?: boolean;
}) {
  const { t } = useI18n();
  const guard = useGuestGuard(authed);
  const totalCovered = topics.reduce((s, tp) => s + tp.count, 0);

  return (
    <main className="shell py-10 sm:py-14 pb-28 md:pb-14">
      <header className="mb-10 max-w-2xl">
        <p className="text-sm text-fg-muted font-mono mb-3">{t("topics.header")}</p>
        <h1 className="display text-display-lg mb-3">
          {t("topics.title")} <span className="display-it text-ember">{t("topics.titleAccent")}</span>
        </h1>
        <p className="text-fg-muted text-lg leading-relaxed">
          {t("topics.subtitle", { n: totalCovered.toLocaleString(), t: topics.length })}
        </p>
        {!authed && (
          <p
            id="topics-locked-hint"
            className="mt-4 inline-flex items-center gap-2 rounded-full border border-hairline/10 px-3.5 py-1.5 text-xs text-fg-muted"
          >
            <Lock size={12} className="text-ember" />
            {t("auth.reasons.topic")}
          </p>
        )}
      </header>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {topics.map((tp, i) => (
          <Link
            key={tp.slug}
            href={`/topics/${tp.slug}`}
            onClick={guard(`/topics/${tp.slug}`, "topic")}
            aria-describedby={authed ? undefined : "topics-locked-hint"}
            className="group card-atelier p-6 hover:-translate-y-0.5 transition-all border hover:border-ember/30 flex flex-col"
            style={{ animationDelay: `${i * 40}ms` }}
          >
            <div className="flex items-start justify-between mb-4">
              <span className="text-3xl">{tp.emoji}</span>
              <span className="flex items-center gap-2">
                {!authed && (
                  <Lock size={13} className="text-fg-muted/50 group-hover:text-ember transition-colors" aria-hidden />
                )}
                <span className={cn("display text-2xl tabular-nums", tp.accent)}>{tp.count}</span>
              </span>
            </div>
            <h3 className="display text-xl mb-1">{t(`topics.names.${tp.slug}`)}</h3>
            <p className="text-xs text-fg-muted leading-relaxed mb-4 flex-1">{t(`topics.blurbs.${tp.slug}`)}</p>
            {/* The arrow is the click affordance for every card, so it must render
                regardless of `preview` — a topic can have zero preview words while
                still being a fully clickable link. Only the chips are conditional. */}
            <div className="flex flex-wrap items-center gap-1.5 pt-3 border-t border-hairline/10">
              {tp.preview.length > 0 &&
                tp.preview.map((w) => (
                  <span key={w} className="text-[11px] rounded-full bg-ink/5 text-fg-muted px-2 py-0.5">
                    {w}
                  </span>
                ))}
              <span className="text-[11px] text-fg-muted/60 px-1 self-center ml-auto" aria-hidden>
                →
              </span>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
