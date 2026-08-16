"use client";

import Link from "next/link";
import { ArrowRight, BookOpen } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import type { GrammarHub, TopicCard } from "@/lib/grammar/data";
import { Chip } from "@/components/ui/chip";
import { cardClasses } from "@/lib/ui/card-classes";
import { cn } from "@/lib/utils";
import { ProgressBar } from "@/components/ui/progress-bar";

// Small shared badge: a number when mastery is measurable, the "just started"
// tag chip otherwise (design §7 — no % below 5 answers).
export function MasteryBadge({ mastery, answered }: { mastery: number | null; answered: number }) {
  const { t } = useI18n();
  if (mastery == null) {
    return answered > 0 ? (
      <Chip className="text-fg-muted">{t("grammar.masteryNew")}</Chip>
    ) : null;
  }
  const tone = mastery >= 90 ? "text-moss-500" : mastery >= 50 ? "text-ember" : "text-fg-muted";
  return <span className={`display text-2xl tabular-nums ${tone}`}>{mastery}%</span>;
}

function localName(nameEn: string, nameVi: string | null, lang: string): string {
  return lang === "vi" && nameVi ? nameVi : nameEn;
}

export function HubView({ hub, authed }: { hub: GrammarHub; authed: boolean }) {
  const { t, lang } = useI18n();
  const c = hub.continueTarget;
  const totalQuestions = hub.clusters.reduce(
    (s, cl) => s + cl.topics.reduce((t, tp) => t + tp.testQuestionCount, 0),
    0
  );

  return (
    <main className="shell py-10 sm:py-14 pb-28 md:pb-14">
      <header className="mb-8 max-w-2xl">
        <p className="text-sm text-fg-muted font-mono mb-3">{t("grammar.header")}</p>
        <h1 className="display text-display-lg mb-3">
          {t("grammar.title")} <span className="display-it text-ember">{t("grammar.titleAccent")}</span>
        </h1>
        <p className="text-fg-muted text-lg leading-relaxed">
          {t("grammar.subtitle", {
            lessons: hub.totals.lessonsTotal.toLocaleString(),
            questions: totalQuestions.toLocaleString(),
            topics: hub.clusters.reduce((s, cl) => s + cl.topics.length, 0),
          })}
        </p>
      </header>

      {c && (
        <Link
          href={`/grammar/${c.topicSlug}/lesson/${c.lessonOrder}`}
          className={cn(cardClasses("interactive"), "group p-5 sm:p-6 mb-10 flex items-center gap-4")}
        >
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-ember/10 text-ember">
            <BookOpen size={22} strokeWidth={1.7} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] uppercase tracking-wider text-fg-muted font-semibold">
              {authed && hub.totals.lessonsRead > 0 ? t("grammar.continueTitle") : t("grammar.startTitle")}
            </span>
            <span className="block truncate display text-lg">
              {localName(c.lessonTitleEn, c.lessonTitleVi, lang)}
            </span>
            <span className="block text-xs text-fg-muted truncate">
              {localName(c.topicNameEn, c.topicNameVi, lang)}
            </span>
          </span>
          <span className="inline-flex items-center gap-1.5 text-sm text-ember font-medium whitespace-nowrap">
            {authed && hub.totals.lessonsRead > 0 ? t("grammar.continueCta") : t("grammar.startCta")}
            <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
          </span>
        </Link>
      )}

      {hub.clusters.map((cl) => (
        <section key={cl.key} className="mb-10">
          <h2 className="display text-2xl mb-4">{t(`grammar.clusters.${cl.key}`)}</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {cl.topics.map((tp: TopicCard, i) => (
              <Link
                key={tp.slug}
                href={`/grammar/${tp.slug}`}
                className={cn(cardClasses("interactive"), "group p-5 flex flex-col")}
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <h3 className="display text-lg leading-snug">{localName(tp.nameEn, tp.nameVi, lang)}</h3>
                  <MasteryBadge mastery={tp.mastery} answered={tp.answered} />
                </div>
                <div className="mt-auto">
                  <div className="flex items-center justify-between text-[11px] text-fg-muted mb-1.5">
                    <span>{t("grammar.lessonsRead", { read: tp.lessonsRead, total: tp.lessonsTotal })}</span>
                    {tp.testQuestionCount > 0 && (
                      <span>{t("grammar.questionsN", { n: tp.testQuestionCount })}</span>
                    )}
                  </div>
                  <ProgressBar
                    form="line"
                    value={tp.lessonsTotal > 0 ? (tp.lessonsRead / tp.lessonsTotal) * 100 : 0}
                  />
                </div>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}
