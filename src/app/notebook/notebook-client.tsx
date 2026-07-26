"use client";

import Link from "next/link";
import { GraduationCap, Zap, StickyNote, Star } from "lucide-react";
import { CefrBadge } from "@/components/cefr-badge";
import { StarButton } from "@/components/star-button";
import { useI18n } from "@/components/i18n-provider";
import { cn } from "@/lib/utils";

type Entry = {
  wordId: string;
  word: string;
  cefr: string;
  typeVi: string | null;
  typeEn: string | null;
  definitionEn: string | null;
  definitionVi: string | null;
  imageUrl: string | null;
  note: string;
  card: { state: number; reps: number; lapses: number; due: string } | null;
};

const stateLabel: Record<number, { key: string; c: string }> = {
  0: { key: "common.new", c: "text-cefr-a2" },
  1: { key: "common.learning", c: "text-ember" },
  2: { key: "common.review", c: "text-moss-500" },
  3: { key: "common.relearning", c: "text-red-400" },
};

export function NotebookClient({ entries }: { entries: Entry[] }) {
  const { t, lang } = useI18n();
  const n = entries.length;

  return (
    <main className="shell py-10 sm:py-14 pb-28 md:pb-14">
      <header className="mb-8 max-w-2xl">
        <p className="text-sm text-soft font-mono mb-3">{t("notebook.header")}</p>
        <h1 className="display text-display-lg mb-3">
          {t("notebook.title")} <span className="display-it text-ember">{t("notebook.titleAccent")}</span>
        </h1>
        {n > 0 && (
          <p className="text-soft">
            {n === 1 ? t("notebook.subtitleOne") : t("notebook.subtitle", { n })}
          </p>
        )}
      </header>

      {n === 0 ? (
        <div className="card-atelier p-10 sm:p-14 text-center max-w-xl mx-auto">
          <span className="inline-grid h-12 w-12 place-items-center rounded-full bg-ember/10 text-ember mb-4">
            <Star size={20} />
          </span>
          <h2 className="display text-xl mb-2">{t("notebook.emptyTitle")}</h2>
          <p className="text-soft text-sm mb-6">{t("notebook.emptyBody")}</p>
          <Link
            href="/browse"
            className="inline-flex items-center gap-1.5 rounded-full bg-ink text-paper px-5 py-2 text-sm font-medium hover:opacity-90 transition-opacity"
          >
            {t("notebook.goBrowse")}
          </Link>
        </div>
      ) : (
        <>
          {/* Study actions */}
          <div className="flex flex-col sm:flex-row gap-3 mb-3">
            <Link
              href="/study/flashcard?scope=starred"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-ink text-paper px-5 py-2.5 text-sm font-medium hover:opacity-90 transition-opacity"
            >
              <GraduationCap size={16} /> {t("notebook.studyStarred")}
            </Link>
            <Link
              href="/study/cram?scope=starred"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-line px-5 py-2.5 text-sm font-medium text-soft hover:text-ink hover:border-ember/40 transition-colors"
            >
              <Zap size={16} /> {t("notebook.cramStarred")}
            </Link>
          </div>
          <p className="text-xs text-soft/80 mb-6">{t("notebook.dailyLimitNote")}</p>

          {/* List */}
          <div className="grid gap-2.5">
            {entries.map((w) => {
              const st = w.card ? stateLabel[w.card.state] : null;
              const typeLabel = lang === "vi" ? w.typeVi : w.typeEn;
              return (
                <div
                  key={w.wordId}
                  className="card-atelier p-4 sm:p-5 flex items-start gap-4 hover:border-ember/25 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <Link href={`/word/${encodeURIComponent(w.word)}`} className="display text-lg hover:text-ember transition-colors">
                        {w.word}
                      </Link>
                      <CefrBadge level={w.cefr} />
                      {typeLabel && <span className="text-xs text-soft">· {typeLabel}</span>}
                      {w.note && <StickyNote size={13} className="text-ember" aria-label={t("notebook.hasNote")} />}
                    </div>
                    {w.definitionEn && <p className="text-sm text-soft mt-1 line-clamp-2">{w.definitionEn}</p>}
                    {w.definitionVi && <p className="text-xs text-soft/70 mt-0.5 line-clamp-1">{w.definitionVi}</p>}
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <StarButton wordId={w.wordId} initialStarred={true} size="sm" />
                    {st ? (
                      <span className={cn("pill text-[9px]", st.c)}>{t(st.key)}</span>
                    ) : (
                      <span className="pill text-[9px] text-soft">—</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </main>
  );
}
