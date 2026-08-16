"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { CefrStamp } from "@/components/ui/cefr-stamp";
import { Chip, chipClasses } from "@/components/ui/chip";
import { Card } from "@/components/ui/card";
import { AudioButton } from "@/components/audio-button";
import { WordImage, isRealImage } from "@/components/word-image";
import { StarButton } from "@/components/star-button";
import { KnownButton } from "@/components/known-button";
import { NoteEditor } from "@/components/note-editor";
import { useI18n } from "@/components/i18n-provider";
import { formatInterval } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { StudyWord } from "@/lib/study-engine";

type Detail = {
  word: StudyWord;
  card: { state: number; reps: number; lapses: number; due: string } | null;
  reviews: { rating: number; reviewedAt: string }[];
  mark: { starred: boolean; note: string; known: boolean };
  topics: string[];
  synonyms: string[];
  antonyms: string[];
};

const stateKey: Record<number, string> = {
  0: "common.new",
  1: "common.learning",
  2: "common.review",
  3: "common.relearning",
};

const ratingKey: Record<number, { key: string; c: string }> = {
  1: { key: "word.ratingAgain", c: "text-red-400 border-red-400/30 bg-red-400/10" },
  2: { key: "word.ratingHard", c: "text-ember border-ember/30 bg-ember/10" },
  3: { key: "word.ratingGood", c: "text-moss-500 border-moss-500/30 bg-moss-500/10" },
  4: { key: "word.ratingEasy", c: "text-cefr-a2 border-cefr-a2/30 bg-cefr-a2/10" },
};

export function WordDetailClient({ detail }: { detail: Detail }) {
  const { t, lang } = useI18n();
  const w = detail.word;

  const typeLabel = lang === "vi" ? w.typeVi : w.typeEn;

  return (
    <main className="shell py-10 sm:py-14 pb-28 md:pb-14">
      <Link href="/notebook" className="inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg mb-6">
        <ArrowLeft size={15} /> {t("nav.notebook")}
      </Link>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main column */}
        <div className="lg:col-span-2 space-y-5">
          <Card variant="flat" className="p-6 sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-baseline gap-3 flex-wrap">
                  <h1 className="display text-display-md">{w.word}</h1>
                  <CefrStamp level={w.cefr} />
                  {typeLabel && <span className="text-sm text-fg-muted">· {typeLabel}</span>}
                </div>
                <div className="flex items-center gap-3 mt-3 flex-wrap">
                  {w.ipaUk && <span className="font-mono text-xs text-fg-muted">UK {w.ipaUk}</span>}
                  {w.ipaUs && <span className="font-mono text-xs text-fg-muted">US {w.ipaUs}</span>}
                  <div className="flex gap-1.5">
                    <AudioButton word={w.word} accent="uk" size="sm" />
                    <AudioButton word={w.word} accent="us" size="sm" />
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <KnownButton wordId={w.id} initialKnown={detail.mark.known} />
                <StarButton wordId={w.id} initialStarred={detail.mark.starred} />
              </div>
            </div>

            {isRealImage(w.imageUrl) && (
              <div className="mt-5 max-w-xs">
                <WordImage imageUrl={w.imageUrl} word={w.word} />
              </div>
            )}

            <div className="mt-5 space-y-1.5">
              {w.definitionEn && <p className="text-fg">{w.definitionEn}</p>}
              {w.definitionVi && <p className="text-fg-muted text-sm">{w.definitionVi}</p>}
            </div>

            {w.extraDefs.length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-mono text-fg-muted uppercase tracking-wide mb-1.5">{t("word.more")}</p>
                <ul className="space-y-1 text-sm text-fg-muted list-disc list-inside">
                  {w.extraDefs.map((d, i) => (
                    <li key={i}>{d}</li>
                  ))}
                </ul>
              </div>
            )}

            {(w.example || w.exampleVi) && (
              <div className="mt-4 border-l-2 border-hairline/10 pl-3">
                <p className="text-xs font-mono text-fg-muted uppercase tracking-wide mb-1">{t("word.example")}</p>
                {w.example && <p className="text-sm text-fg italic">{w.example}</p>}
                {w.exampleVi && <p className="text-sm text-fg-muted">{w.exampleVi}</p>}
              </div>
            )}

            {detail.synonyms.length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-mono text-fg-muted uppercase tracking-wide mb-1.5">{t("word.synonyms")}</p>
                <div className="flex flex-wrap gap-1.5">
                  {detail.synonyms.map((s) => (
                    <Link key={s} href={`/word/${encodeURIComponent(s)}`} className={cn(chipClasses(), "text-[11px] text-moss-600 dark:text-moss-400 border-moss-500/30 bg-moss-500/10 hover:border-moss-500/60")}>
                      {s}
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {detail.antonyms.length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-mono text-fg-muted uppercase tracking-wide mb-1.5">{t("word.antonyms")}</p>
                <div className="flex flex-wrap gap-1.5">
                  {detail.antonyms.map((a) => (
                    <Link key={a} href={`/word/${encodeURIComponent(a)}`} className={cn(chipClasses(), "text-[11px] text-red-400 border-red-400/30 bg-red-400/10 hover:border-red-400/60")}>
                      {a}
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {detail.topics.length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-mono text-fg-muted uppercase tracking-wide mb-1.5">{t("word.topics")}</p>
                <div className="flex flex-wrap gap-1.5">
                  {detail.topics.map((slug) => (
                    <Link key={slug} href={`/topics/${slug}`} className={cn(chipClasses(), "text-[11px] text-fg-muted hover:text-fg hover:border-ember/40")}>
                      {t(`topics.names.${slug}`)}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </Card>

          {/* Note editor */}
          <Card variant="flat" className="p-6">
            <NoteEditor wordId={w.id} initialNote={detail.mark.note} />
          </Card>
        </div>

        {/* Sidebar: SRS + history */}
        <div className="space-y-5">
          <Card variant="flat" className="p-6">
            <p className="text-xs font-mono text-fg-muted uppercase tracking-wide mb-3">{t("word.srsTitle")}</p>
            {detail.card ? (
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-fg-muted">{t("word.srsState")}</dt>
                  <dd className="text-fg">{t(stateKey[detail.card.state] ?? "common.new")}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-fg-muted">{t("word.srsReps")}</dt>
                  <dd className="text-fg tabular-nums">{detail.card.reps}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-fg-muted">{t("word.srsLapses")}</dt>
                  <dd className="text-fg tabular-nums">{detail.card.lapses}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-fg-muted">{t("word.srsDue")}</dt>
                  <dd className="text-fg tabular-nums">{formatInterval(new Date(detail.card.due))}</dd>
                </div>
              </dl>
            ) : (
              <p className="text-sm text-fg-muted">{t("word.notStudied")}</p>
            )}
          </Card>

          <Card variant="flat" className="p-6">
            <p className="text-xs font-mono text-fg-muted uppercase tracking-wide mb-3">{t("word.history")}</p>
            {detail.reviews.length === 0 ? (
              <p className="text-sm text-fg-muted">{t("word.noHistory")}</p>
            ) : (
              <ul className="space-y-2">
                {detail.reviews.map((r, i) => {
                  const rk = ratingKey[r.rating];
                  return (
                    <li key={i} className="flex items-center justify-between text-sm">
                      <span className="text-fg-muted tabular-nums">
                        {new Date(r.reviewedAt).toLocaleDateString(lang === "vi" ? "vi-VN" : "en-US")}
                      </span>
                      {rk && <Chip className={cn("text-[10px]", rk.c)}>{t(rk.key)}</Chip>}
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </main>
  );
}
