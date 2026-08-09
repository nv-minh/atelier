"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Search, StickyNote } from "lucide-react";
import { CefrBadge } from "@/components/cefr-badge";
import { AudioButton } from "@/components/audio-button";
import { StarButton } from "@/components/star-button";
import { useI18n } from "@/components/i18n-provider";
import { WordImage, isRealImage } from "@/components/word-image";
import { cn } from "@/lib/utils";
import { CEFR_LEVELS } from "@/lib/export-format";

type Item = {
  id: string;
  word: string;
  cefr: string;
  typeEn: string | null;
  typeVi: string | null;
  ipaUk: string | null;
  ipaUs: string | null;
  definitionEn: string | null;
  definitionVi: string | null;
  imageUrl: string | null;
  synonyms: string[];
  example: string | null;
  cardState: number | null;
  reps: number;
  starred: boolean;
  hasNote: boolean;
};

const stateLabel: Record<number, { t: string; c: string }> = {
  0: { t: "New", c: "text-cefr-a2" },
  1: { t: "Learning", c: "text-ember" },
  2: { t: "Review", c: "text-moss-500" },
  3: { t: "Relearning", c: "text-red-400" },
};

export function LibraryClient({
  items,
  total,
  page,
  totalPages,
  q,
  cefr,
}: {
  items: Item[];
  total: number;
  page: number;
  totalPages: number;
  q: string;
  cefr: string;
}) {
  const router = useRouter();
  const { t } = useI18n();
  const [search, setSearch] = useState(q);
  const [isPending, startTransition] = useTransition();

  const update = (params: Record<string, string | undefined>) => {
    const sp = new URLSearchParams();
    if (search) sp.set("q", search);
    if (params.cefr !== undefined) {
      if (params.cefr && params.cefr !== "ALL") sp.set("cefr", params.cefr);
    } else if (cefr && cefr !== "ALL") sp.set("cefr", cefr);
    router.push(`/browse?${sp.toString()}`);
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(() => update({}));
  };

  const levels = ["ALL", ...CEFR_LEVELS];

  return (
    <main className="shell py-10 sm:py-14 pb-28 md:pb-14">
      <header className="mb-8 max-w-2xl">
        <p className="text-sm text-soft font-mono mb-3">{t("browse.header")}</p>
        <h1 className="display text-display-lg mb-3">
          {t("browse.title")} <span className="display-it text-ember">{t("browse.titleAccent")}</span>
        </h1>
        <p className="text-soft">{t("browse.subtitle", { n: total.toLocaleString() })}</p>
      </header>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <form onSubmit={onSubmit} className="relative flex-1">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-soft" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("browse.searchWord")}
            className="w-full rounded-full border border-line bg-surface pl-11 pr-4 py-2.5 text-sm outline-none focus:border-ember"
          />
        </form>
        <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
          {levels.map((l) => (
            <button
              key={l}
              onClick={() => startTransition(() => update({ cefr: l }))}
              className={cn(
                "rounded-full px-3.5 py-2 text-sm font-medium border whitespace-nowrap transition-colors",
                cefr === l ? "bg-ink text-paper border-ink" : "border-line text-soft hover:text-ink"
              )}
            >
              {l === "ALL" ? t("browse.all") : l}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="grid gap-2.5">
        {items.length === 0 && (
          <div className="card-atelier p-12 text-center text-soft">{t("browse.noWords")}</div>
        )}
        {items.map((w) => {
          const st = w.cardState !== null ? stateLabel[w.cardState] : null;
          return (
            <div
              key={w.id}
              className="card-atelier p-4 sm:p-5 flex items-start gap-4 hover:border-ember/25 transition-colors"
            >
              {isRealImage(w.imageUrl) && (
                <WordImage imageUrl={w.imageUrl} word={w.word} className="!w-20 !h-20 shrink-0" maxH="max-h-20" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <Link href={`/word/${encodeURIComponent(w.word)}`} className="display text-lg hover:text-ember transition-colors">
                    {w.word}
                  </Link>
                  {w.ipaUk && <span className="font-mono text-xs text-soft">{w.ipaUk}</span>}
                  <CefrBadge level={w.cefr} />
                  {w.typeVi && <span className="text-xs text-soft">· {w.typeVi}</span>}
                  {w.hasNote && <StickyNote size={12} className="text-ember" aria-label={t("notebook.hasNote")} />}
                </div>
                {w.definitionEn && <p className="text-sm text-soft mt-1 line-clamp-2">{w.definitionEn}</p>}
                {w.definitionVi && <p className="text-xs text-soft/70 mt-0.5 line-clamp-1">{w.definitionVi}</p>}
                {w.synonyms.length > 0 && (
                  <p className="text-xs text-soft/80 mt-1">
                    <span className="text-moss-600 dark:text-moss-400">{t("browse.syn")}</span> {w.synonyms.slice(0, 3).join(", ")}
                  </p>
                )}
              </div>
              <div className="flex flex-col items-end gap-2 shrink-0">
                <div className="flex items-center gap-1">
                  <StarButton wordId={w.id} initialStarred={w.starred} size="sm" />
                  <AudioButton word={w.word} accent="us" size="sm" />
                </div>
                {st ? (
                  <span className={cn("pill text-[9px]", st.c)}>{st.t}</span>
                ) : (
                  <span className="pill text-[9px] text-soft">—</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-8">
          <button
            disabled={page <= 1}
            onClick={() => router.push(`/browse?${mkQs(q, cefr, page - 1)}`)}
            className="rounded-full border border-line px-4 py-2 text-sm disabled:opacity-30 hover:bg-paper-200/50"
          >
            {t("browse.prev")}
          </button>
          <span className="text-sm text-soft tabular-nums">
            {page} / {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => router.push(`/browse?${mkQs(q, cefr, page + 1)}`)}
            className="rounded-full border border-line px-4 py-2 text-sm disabled:opacity-30 hover:bg-paper-200/50"
          >
            {t("browse.next")}
          </button>
        </div>
      )}
    </main>
  );
}

function mkQs(q: string, cefr: string, page: number) {
  const sp = new URLSearchParams();
  if (q) sp.set("q", q);
  if (cefr && cefr !== "ALL") sp.set("cefr", cefr);
  sp.set("page", String(page));
  return sp.toString();
}
