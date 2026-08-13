"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Search, StickyNote, Lock } from "lucide-react";
import { CefrBadge } from "@/components/cefr-badge";
import { AudioButton } from "@/components/audio-button";
import { StarButton } from "@/components/star-button";
import { useAuthGate, useGuestGuard } from "@/components/auth-gate";
import { useI18n } from "@/components/i18n-provider";
import { WordImage, isRealImage } from "@/components/word-image";
import { cn } from "@/lib/utils";
import { CEFR_LEVELS } from "@/lib/export-format";
import type { VaultSummary } from "@/lib/vault/summary";
import { BROWSE_SCOPES, type Scope } from "@/lib/vault/scope";
import { TOPICS } from "@/lib/topic-taxonomy";

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

type Query = { q?: string; cefr?: string; topic?: string; scope?: Scope; page?: number };

export function LibraryClient({
  items,
  total,
  page,
  totalPages,
  q,
  cefr,
  topic,
  scope,
  summary,
  authed = true,
}: {
  items: Item[];
  total: number;
  page: number;
  totalPages: number;
  q: string;
  cefr: string;
  topic: string;
  scope: Scope;
  summary: VaultSummary | null;
  authed?: boolean;
}) {
  const router = useRouter();
  const { t } = useI18n();
  const { open: openGate } = useAuthGate();
  const guard = useGuestGuard(authed);
  const [search, setSearch] = useState(q);
  const [isPending, startTransition] = useTransition();

  // Current filter state, built ONCE from props and passed into every mkQs
  // call. Without this, each chip would have to guess at the rest of the
  // filter on its own and would drop another chip's parameter — exactly the
  // bug mkQs exists to prevent.
  const cur: Query = { q: search, cefr, topic, scope, page };

  // Guests read page 1 freely; paging deeper raises the prompt instead of
  // navigating to a wall they did not ask for.
  const goToPage = (next: number) => {
    const href = `/browse?${mkQs(cur, { page: next })}`;
    if (!authed) {
      openGate({ callbackUrl: href, reason: "library" });
      return;
    }
    router.push(href);
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(() => router.push(`/browse?${mkQs(cur, { q: search, page: 1 })}`));
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
              onClick={() => startTransition(() => router.push(`/browse?${mkQs(cur, { cefr: l, page: 1 })}`))}
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

      {/* Scope row, plus the topic select — sharing the same horizontally
          scrollable strip since a topic dropdown next to a handful of scope
          chips still fits on mobile, while a chip per topic would not (there
          are 28 of them). */}
      <div className="flex items-center gap-2 mb-4 overflow-x-auto scrollbar-hide">
        <span className="text-xs text-soft font-mono shrink-0">{t("browse.scopeLabel")}</span>
        {BROWSE_SCOPES.map((s) => (
          <button
            key={s}
            onClick={() => {
              if (!authed && s !== "all") {
                openGate({ callbackUrl: `/browse?${mkQs(cur, { scope: s, page: 1 })}`, reason: "library" });
                return;
              }
              startTransition(() => router.push(`/browse?${mkQs(cur, { scope: s, page: 1 })}`));
            }}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-medium border whitespace-nowrap transition-colors",
              scope === s ? "bg-ember text-paper border-ember" : "border-line text-soft hover:text-ink"
            )}
          >
            {t(`browse.scope${s[0].toUpperCase()}${s.slice(1)}`)}
            {!authed && s !== "all" && <Lock size={10} className="inline ml-1 text-ember" aria-hidden />}
          </button>
        ))}
        <select
          value={topic}
          onChange={(e) => startTransition(() => router.push(`/browse?${mkQs(cur, { topic: e.target.value, page: 1 })}`))}
          className="rounded-full border border-line bg-surface px-3.5 py-2 text-sm"
        >
          <option value="ALL">{t("browse.topicAll")}</option>
          {TOPICS.map((tp) => (
            <option key={tp.slug} value={tp.slug}>{t(`topics.names.${tp.slug}`)}</option>
          ))}
        </select>
      </div>

      {/* Progress strip — only once signed in (summary is null for guests)
          and only once the learner has actually seen a word, so a brand-new
          account does not see an all-zero strip. */}
      {summary && summary.seen > 0 && (
        <div className="card-atelier p-4 mb-5 flex flex-wrap items-center gap-x-5 gap-y-2">
          <span className="display text-lg">{t("browse.summaryLearned", { n: summary.learned.toLocaleString() })}</span>
          <span className="text-sm text-soft">{t("browse.summaryLearning", { n: summary.learning.toLocaleString() })}</span>
          <span className="text-sm text-soft">{t("browse.summaryKnown", { n: summary.known.toLocaleString() })}</span>
          {summary.band && summary.band.total > 0 && (
            <span className="text-sm text-soft tabular-nums">
              {t("browse.summaryBand", {
                level: summary.band.level,
                pct: Math.round((summary.band.learned / summary.band.total) * 100),
              })}
            </span>
          )}
          <div className="flex gap-2 ml-auto">
            <Link
              href={`/study/cram?${mkQs({ cefr, topic }, { scope: "weak" as Scope })}`}
              className="rounded-full border border-line px-3.5 py-1.5 text-xs font-medium hover:border-ember"
            >
              {t("browse.studyWeak")}
            </Link>
            <a
              href={`/api/export?format=csv&${mkQs(cur, {})}`}
              download
              className="rounded-full border border-line px-3.5 py-1.5 text-xs font-medium hover:border-ember"
            >
              {t("browse.exportFiltered")}
            </a>
          </div>
        </div>
      )}

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
                  <Link
                    href={`/word/${encodeURIComponent(w.word)}`}
                    onClick={guard(`/word/${encodeURIComponent(w.word)}`, "word")}
                    className="display text-lg hover:text-ember transition-colors"
                  >
                    {w.word}
                  </Link>
                  {w.ipaUk && <span className="font-mono text-xs text-soft">{w.ipaUk}</span>}
                  <CefrBadge level={w.cefr} />
                  {w.typeVi && <span className="text-xs text-soft">· {w.typeVi}</span>}
                  {w.hasNote && <StickyNote size={12} className="text-ember" aria-label={t("notebook.hasNote")} />}
                </div>
                {w.definitionEn && <p className="text-sm text-soft mt-1 line-clamp-2">{w.definitionEn}</p>}
                {/* `text-soft` is a @layer components class, not a Tailwind colour
                    key — bare/opacity colour utilities like `text-soft/70` need a
                    DEFAULT colour key to slash-modify, so that form silently
                    compiles to nothing and the line rendered at full ink instead
                    of dimmed. Splitting into `text-soft opacity-70` applies the
                    dimming as a separate utility instead of trying to modify
                    `text-soft` itself. */}
                {w.definitionVi && <p className="text-xs text-soft opacity-70 mt-0.5 line-clamp-1">{w.definitionVi}</p>}
                {w.synonyms.length > 0 && (
                  <p className="text-xs text-soft opacity-80 mt-1">
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
            onClick={() => goToPage(page - 1)}
            className="rounded-full border border-line px-4 py-2 text-sm disabled:opacity-30 hover:bg-paper-200/50"
          >
            {t("browse.prev")}
          </button>
          <span className="text-sm text-soft tabular-nums">
            {page} / {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => goToPage(page + 1)}
            className="inline-flex items-center gap-1.5 rounded-full border border-line px-4 py-2 text-sm disabled:opacity-30 hover:bg-paper-200/50"
          >
            {t("browse.next")}
            {!authed && <Lock size={12} className="text-ember" aria-hidden />}
          </button>
        </div>
      )}
    </main>
  );
}

// The one place that builds a /browse URL. Every chip (search, CEFR, scope,
// topic, page) routes through here with the FULL current filter (`cur`) plus
// only the field it changed (`patch`) — so no chip can silently drop another
// chip's parameter, which is exactly what the old per-chip URLSearchParams
// building used to do.
function mkQs(cur: Query, patch: Query) {
  const next = { ...cur, ...patch };
  const sp = new URLSearchParams();
  if (next.q) sp.set("q", next.q);
  if (next.cefr && next.cefr !== "ALL") sp.set("cefr", next.cefr);
  if (next.topic && next.topic !== "ALL") sp.set("topic", next.topic);
  if (next.scope && next.scope !== "all") sp.set("scope", next.scope);
  if (next.page && next.page > 1) sp.set("page", String(next.page));
  return sp.toString();
}
