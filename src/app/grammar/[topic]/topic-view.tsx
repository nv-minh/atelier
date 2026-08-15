"use client";

import Link from "next/link";
import { ArrowLeft, CheckCircle2, Circle, PencilRuler } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { useGuestGuard } from "@/components/auth-gate";
import { MasteryBadge } from "../hub-view";
import type { TopicPageData } from "@/lib/grammar/data";

export function TopicView({ data, authed }: { data: NonNullable<TopicPageData>; authed: boolean }) {
  const { t, lang } = useI18n();
  const guard = useGuestGuard(authed);
  const { topic, lessons } = data;
  const name = lang === "vi" && topic.nameVi ? topic.nameVi : topic.nameEn;

  return (
    <main className="shell py-10 sm:py-14 pb-28 md:pb-14 max-w-3xl">
      <Link href="/grammar" className="inline-flex items-center gap-1.5 text-sm text-soft hover:text-ink mb-6">
        <ArrowLeft size={15} /> {t("common.back")}
      </Link>

      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-soft font-mono mb-2">{t(`grammar.clusters.${topic.cluster}`)}</p>
          <h1 className="display text-display-md">{name}</h1>
          <p className="text-sm text-soft mt-2">
            {t("grammar.lessonsRead", { read: topic.lessonsRead, total: topic.lessonsTotal })}
            {topic.testQuestionCount > 0 && <> · {t("grammar.questionsN", { n: topic.testQuestionCount })}</>}
          </p>
        </div>
        <MasteryBadge mastery={topic.mastery} answered={topic.answered} />
      </header>

      {topic.testQuestionCount > 0 && (
        <Link
          href={`/grammar/${topic.slug}/test`}
          onClick={guard(`/grammar/${topic.slug}/test`, "grammar")}
          className="mb-8 inline-flex items-center gap-2 rounded-full bg-ink text-paper px-5 py-2.5 text-sm font-medium hover:opacity-90"
        >
          <PencilRuler size={15} /> {t("grammar.lesson.takeTest")}
        </Link>
      )}

      <ol className="card-atelier divide-y divide-ink/10 overflow-hidden">
        {lessons.map((l) => {
          const title = lang === "vi" && l.titleVi ? l.titleVi : l.titleEn;
          return (
            <li key={l.id}>
              <Link
                href={`/grammar/${topic.slug}/lesson/${l.order}`}
                className="flex items-center gap-3.5 px-5 py-3.5 hover:bg-paper-200/40 transition-colors"
              >
                {l.read ? (
                  <CheckCircle2 size={18} className="shrink-0 text-moss-500" />
                ) : (
                  <Circle size={18} className="shrink-0 text-ink/20" />
                )}
                <span className="text-xs font-mono text-soft w-6 shrink-0">{l.order}</span>
                <span className="text-sm leading-snug">{title}</span>
              </Link>
            </li>
          );
        })}
      </ol>
    </main>
  );
}
