"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Layers, CheckSquare, Keyboard, Headphones, Zap, Grid3x3, Mic, ArrowUpRight } from "lucide-react";
import { CefrFilter } from "@/components/study/cefr-filter";
import { DirectionFilter } from "@/components/study/direction-filter";
import { useI18n } from "@/components/i18n-provider";

export default function StudyPage() {
  const { t } = useI18n();
  const params = useSearchParams();

  // carry cefr/topic/dir into the study-mode links
  const qs = new URLSearchParams();
  const cefr = params.get("cefr");
  const topic = params.get("topic");
  const dir = params.get("dir");
  if (cefr) qs.set("cefr", cefr);
  if (topic) qs.set("topic", topic);
  if (dir) qs.set("dir", dir);
  const query = qs.toString();
  const withQuery = (slug: string) => `/study/${slug}${query ? `?${query}` : ""}`;

  const modes = [
    { slug: "flashcard", icon: Layers, accent: "text-ember", ring: "group-hover:border-ember/40", title: t("modes.cards.title"), desc: t("modes.cards.desc"), tag: t("modes.tagSRS") },
    { slug: "quiz", icon: CheckSquare, accent: "text-cefr-a2", ring: "group-hover:border-cefr-a2/40", title: t("modes.quiz.title"), desc: t("modes.quiz.desc"), tag: t("modes.tagPractice") },
    { slug: "typing", icon: Keyboard, accent: "text-moss-500", ring: "group-hover:border-moss-500/40", title: t("modes.typing.title"), desc: t("modes.typing.desc"), tag: t("modes.tagRecall") },
    { slug: "dictation", icon: Headphones, accent: "text-cefr-b2", ring: "group-hover:border-cefr-b2/40", title: t("modes.dictation.title"), desc: t("modes.dictation.desc"), tag: t("modes.tagListening") },
    { slug: "matching", icon: Grid3x3, accent: "text-cefr-b1", ring: "group-hover:border-cefr-b1/40", title: t("modes.matching.title"), desc: t("modes.matching.desc"), tag: t("modes.tagMatching") },
    { slug: "pronunciation", icon: Mic, accent: "text-cefr-b2", ring: "group-hover:border-cefr-b2/40", title: t("modes.pron.title"), desc: t("modes.pron.desc"), tag: t("modes.tagPron") },
    { slug: "cram", icon: Zap, accent: "text-ember", ring: "group-hover:border-ember/40", title: t("modes.cram.title"), desc: t("modes.cram.desc"), tag: t("modes.tagCram") },
  ];

  return (
    <main className="shell py-10 sm:py-16 pb-28 md:pb-16">
      <header className="mb-10 sm:mb-14 max-w-2xl">
        <p className="text-sm text-soft mb-3 font-mono">{t("modes.header")}</p>
        <h1 className="display text-display-lg mb-4">
          {t("modes.title")} <span className="display-it text-ember">{t("modes.titleAccent")}</span>
        </h1>
        <p className="text-soft text-lg leading-relaxed">{t("modes.subtitle")}</p>
      </header>

      <div className="flex flex-col gap-3 mb-2">
        <Suspense fallback={null}>
          <CefrFilter />
        </Suspense>
        <Suspense fallback={null}>
          <DirectionFilter />
        </Suspense>
      </div>

      <div className="grid sm:grid-cols-2 gap-4 sm:gap-5 mt-8">
        {modes.map((m, i) => {
          const Icon = m.icon;
          return (
            <Link
              key={m.slug}
              href={withQuery(m.slug)}
              className={`group relative card-atelier p-6 sm:p-7 border transition-all hover:-translate-y-0.5 ${m.ring}`}
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <div className="flex items-start justify-between mb-5">
                <span className={`grid h-11 w-11 place-items-center rounded-2xl bg-ink/5 ${m.accent}`}>
                  <Icon size={20} strokeWidth={1.75} />
                </span>
                <span className="pill text-soft">{m.tag}</span>
              </div>
              <h3 className="display text-2xl mb-2 flex items-center gap-1.5">
                {m.title}
                <ArrowUpRight
                  size={18}
                  className="opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-soft"
                />
              </h3>
              <p className="text-soft text-sm leading-relaxed">{m.desc}</p>
            </Link>
          );
        })}
      </div>
    </main>
  );
}
