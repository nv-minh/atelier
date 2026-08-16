"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { StickyNote, Lock } from "lucide-react";
import { CefrStamp } from "@/components/ui/cefr-stamp";
import { Chip } from "@/components/ui/chip";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { AudioButton } from "@/components/audio-button";
import { StarButton } from "@/components/star-button";
import { KnownButton } from "@/components/known-button";
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
  known: boolean;
};

const stateLabel: Record<number, { t: string; c: string }> = {
  0: { t: "New", c: "text-cefr-a2" },
  1: { t: "Learning", c: "text-ember" },
  2: { t: "Review", c: "text-moss-500" },
  3: { t: "Relearning", c: "text-red-400" },
};

type Query = { q?: string; cefr?: string; topic?: string; scope?: Scope; page?: number; limit?: number };

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

  // Row selection for the bulk action bar below. Keyed by word id.
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkMsg, setBulkMsg] = useState<string | null>(null);
  // True while a bulk request is in flight — disables the action buttons so a
  // double-click can't fire two overlapping requests against the same selection.
  const [bulkPending, setBulkPending] = useState(false);
  // Tracks the timer that clears `bulkMsg`, so a second bulk action (or an
  // unmount) can cancel the previous one instead of leaving a stray
  // setState-after-unmount / a premature clear of the newer message.
  const bulkMsgTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (bulkMsgTimer.current) clearTimeout(bulkMsgTimer.current);
    };
  }, []);

  const showBulkMsg = (msg: string) => {
    if (bulkMsgTimer.current) clearTimeout(bulkMsgTimer.current);
    setBulkMsg(msg);
    bulkMsgTimer.current = setTimeout(() => setBulkMsg(null), 3000);
  };

  // `items` is a fresh array from the server on every navigation (new page,
  // filter, or scope), so a stale selection would otherwise point at word ids
  // that are no longer on screen — the floating bar would keep showing "N
  // selected" for rows the user can no longer see, and running an action
  // would silently apply to invisible words. Clear it whenever the list
  // changes out from under the selection.
  useEffect(() => {
    setSelected(new Set());
  }, [items]);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const runBulk = async (action: string) => {
    setBulkPending(true);
    try {
      const res = await fetch("/api/vault/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wordIds: [...selected], action }),
      });
      if (!res.ok) {
        // An expired session (401) or an unknown word (404) must surface —
        // silently no-op-ing here would leave the selection sitting there
        // with zero feedback, as if the click had done nothing.
        showBulkMsg(res.status === 401 ? t("browse.bulkErrorAuth") : t("browse.bulkError"));
        return;
      }
      const result = await res.json().catch(() => null);
      setSelected(new Set());
      if (result && typeof result.changed === "number") {
        showBulkMsg(t("browse.bulkDone", { n: result.changed }));
      }
      // Server component re-reads the DB: refresh instead of hand-editing local
      // state, so the status pills and summary strip never drift from the DB.
      router.refresh();
    } finally {
      setBulkPending(false);
    }
  };

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
        <p className="text-sm text-fg-muted font-mono mb-3">{t("browse.header")}</p>
        <h1 className="display text-display-lg mb-3">
          {t("browse.title")} <span className="display-it text-ember">{t("browse.titleAccent")}</span>
        </h1>
        <p className="text-fg-muted">{t("browse.subtitle", { n: total.toLocaleString() })}</p>
      </header>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <form onSubmit={onSubmit} className="flex-1">
          <Input
            form="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("browse.searchWord")}
          />
        </form>
        <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
          {levels.map((l) => (
            <button
              key={l}
              onClick={() => startTransition(() => router.push(`/browse?${mkQs(cur, { cefr: l, page: 1 })}`))}
              className={cn(
                "rounded-full px-3.5 py-2 text-sm font-medium border whitespace-nowrap transition-colors",
                cefr === l ? "bg-accent text-fg-on-accent border-accent" : "border-hairline/10 text-fg-muted hover:text-fg"
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
        <span className="text-xs text-fg-muted font-mono shrink-0">{t("browse.scopeLabel")}</span>
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
            title={!authed && s !== "all" ? t("browse.scopeLocked") : undefined}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-medium border whitespace-nowrap transition-colors",
              scope === s ? "bg-ember text-paper border-ember" : "border-hairline/10 text-fg-muted hover:text-fg"
            )}
          >
            {t(`browse.scope${s[0].toUpperCase()}${s.slice(1)}`)}
            {!authed && s !== "all" && <Lock size={10} className="inline ml-1 text-ember" aria-hidden />}
          </button>
        ))}
        <select
          value={topic}
          onChange={(e) => startTransition(() => router.push(`/browse?${mkQs(cur, { topic: e.target.value, page: 1 })}`))}
          aria-label={t("browse.topicLabel")}
          className="rounded-full border border-hairline/10 bg-surface px-3.5 py-2 text-sm"
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
        <Card variant="flat" className="p-4 mb-5 flex flex-wrap items-center gap-x-5 gap-y-2">
          <span className="display text-lg">{t("browse.summaryLearned", { n: summary.learned.toLocaleString() })}</span>
          <span className="text-sm text-fg-muted">{t("browse.summaryLearning", { n: summary.learning.toLocaleString() })}</span>
          <span className="text-sm text-fg-muted">{t("browse.summaryKnown", { n: summary.known.toLocaleString() })}</span>
          {summary.band && summary.band.total > 0 && (
            <span className="text-sm text-fg-muted tabular-nums">
              {t("browse.summaryBand", {
                level: summary.band.level,
                pct: Math.round((summary.band.learned / summary.band.total) * 100),
              })}
            </span>
          )}
          <div className="flex gap-2 ml-auto">
            <Link
              href={`/study/cram?${mkQs({ cefr, topic }, { scope: "weak" as Scope, limit: 20 })}`}
              className="rounded-full border border-hairline/10 px-3.5 py-1.5 text-xs font-medium hover:border-ember"
            >
              {t("browse.studyWeak")}
            </Link>
            <a
              // /api/export has no notion of pagination — pass page:1 in the
              // patch so a export while on page N > 1 doesn't leave a stray
              // `page=N` on the URL that claims a pagination the endpoint
              // ignores.
              href={`/api/export?format=csv&${mkQs(cur, { page: 1 })}`}
              download
              className="rounded-full border border-hairline/10 px-3.5 py-1.5 text-xs font-medium hover:border-ember"
            >
              {t("browse.exportFiltered")}
            </a>
          </div>
        </Card>
      )}

      {/* List */}
      <div className="grid gap-2.5">
        {items.length === 0 && (
          <Card variant="flat" className="p-12 text-center text-fg-muted">{t("browse.noWords")}</Card>
        )}
        {items.map((w) => {
          const st = w.cardState !== null ? stateLabel[w.cardState] : null;
          return (
            <Card
              variant="interactive"
              key={w.id}
              className="p-4 sm:p-5 flex items-start gap-4"
            >
              {authed && (
                <input
                  type="checkbox"
                  checked={selected.has(w.id)}
                  onChange={() => toggle(w.id)}
                  aria-label={w.word}
                  className="mt-1 shrink-0 accent-ember"
                />
              )}
              {isRealImage(w.imageUrl) && (
                <WordImage imageUrl={w.imageUrl} word={w.word} fit="cover" className="w-20 h-20 shrink-0" />
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
                  {w.ipaUk && <span className="font-mono text-xs text-fg-muted">{w.ipaUk}</span>}
                  <CefrStamp level={w.cefr} />
                  {w.typeVi && <span className="text-xs text-fg-muted">· {w.typeVi}</span>}
                  {w.hasNote && <StickyNote size={12} className="text-ember" aria-label={t("notebook.hasNote")} />}
                </div>
                {w.definitionEn && <p className="text-sm text-fg-muted mt-1 line-clamp-2">{w.definitionEn}</p>}
                {w.definitionVi && <p className="text-xs text-fg-muted/70 mt-0.5 line-clamp-1">{w.definitionVi}</p>}
                {w.synonyms.length > 0 && (
                  <p className="text-xs text-fg-muted/80 mt-1">
                    <span className="text-moss-600 dark:text-moss-400">{t("browse.syn")}</span> {w.synonyms.slice(0, 3).join(", ")}
                  </p>
                )}
              </div>
              <div className="flex flex-col items-end gap-2 shrink-0">
                <div className="flex items-center gap-1">
                  <StarButton wordId={w.id} initialStarred={w.starred} size="sm" />
                  <KnownButton wordId={w.id} initialKnown={w.known} variant="icon" />
                  <AudioButton word={w.word} accent="us" size="sm" />
                </div>
                {st ? (
                  <Chip className={cn("text-[9px]", st.c)}>{st.t}</Chip>
                ) : (
                  <Chip className="text-[9px] text-fg-muted">—</Chip>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-8">
          <button
            disabled={page <= 1}
            onClick={() => goToPage(page - 1)}
            className="rounded-full border border-hairline/10 px-4 py-2 text-sm disabled:opacity-30 hover:bg-paper-200/50"
          >
            {t("browse.prev")}
          </button>
          <span className="text-sm text-fg-muted tabular-nums">
            {page} / {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => goToPage(page + 1)}
            className="inline-flex items-center gap-1.5 rounded-full border border-hairline/10 px-4 py-2 text-sm disabled:opacity-30 hover:bg-paper-200/50"
          >
            {t("browse.next")}
            {!authed && <Lock size={12} className="text-ember" aria-hidden />}
          </button>
        </div>
      )}

      {/* Floating bulk action bar — only while rows are selected. Every
          action re-reads the DB via router.refresh() rather than patching
          local state, so the summary strip and per-row pills never drift
          out of sync with what actually happened on the server. */}
      {selected.size > 0 && (
        <Card variant="flat" className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-40 px-4 py-3 flex items-center gap-2 shadow-lg">
          <span className="text-sm text-fg-muted">{t("browse.bulkSelected", { n: selected.size })}</span>
          <button
            onClick={() => runBulk("mark-known")}
            disabled={bulkPending}
            className="rounded-full border border-hairline/10 px-3 py-1.5 text-xs hover:border-ember disabled:opacity-40 disabled:pointer-events-none"
          >
            {t("browse.bulkMarkKnown")}
          </button>
          <button
            onClick={() => runBulk("star")}
            disabled={bulkPending}
            className="rounded-full border border-hairline/10 px-3 py-1.5 text-xs hover:border-ember disabled:opacity-40 disabled:pointer-events-none"
          >
            {t("browse.bulkStar")}
          </button>
          <button
            onClick={() => runBulk("reset")}
            disabled={bulkPending}
            className="rounded-full border border-hairline/10 px-3 py-1.5 text-xs hover:border-ember disabled:opacity-40 disabled:pointer-events-none"
          >
            {t("browse.bulkReset")}
          </button>
          <button onClick={() => setSelected(new Set())} className="text-xs text-fg-muted hover:text-fg">
            {t("browse.bulkClear")}
          </button>
        </Card>
      )}

      {/* Transient confirmation after a bulk action lands — survives past the
          bar above disappearing (selection clears immediately on success). */}
      {bulkMsg && (
        <Card
          variant="flat"
          role="status"
          aria-live="polite"
          className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-40 px-4 py-2 text-sm shadow-lg"
        >
          {bulkMsg}
        </Card>
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
  if (next.limit) sp.set("limit", String(next.limit));
  return sp.toString();
}
