"use client";

import Link from "next/link";
import { GraduationCap, Zap, StickyNote, Star, Flame, CheckCheck } from "lucide-react";
import { CefrStamp } from "@/components/ui/cefr-stamp";
import { Chip } from "@/components/ui/chip";
import { Card } from "@/components/ui/card";
import { Tabs } from "@/components/ui/tabs";
import { StarButton } from "@/components/star-button";
import { KnownButton } from "@/components/known-button";
import { useI18n } from "@/components/i18n-provider";
import { cn, formatInterval } from "@/lib/utils";
import { buttonClasses } from "@/lib/ui/button-classes";

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
  starred: boolean;
  known?: boolean;
  card: { state: number; reps: number; lapses: number; due: string } | null;
};

const stateLabel: Record<number, { key: string; c: string }> = {
  0: { key: "common.new", c: "text-cefr-a2" },
  1: { key: "common.learning", c: "text-ember" },
  2: { key: "common.review", c: "text-moss-500" },
  3: { key: "common.relearning", c: "text-red-400" },
};

export function NotebookClient({
  tab,
  entries,
  leeches,
  known,
  gate,
}: {
  tab: "starred" | "leeches" | "known";
  entries: Entry[];
  leeches: Entry[];
  known: Entry[];
  /** Sign-in panel rendered in place of the entries when nobody is signed in. */
  gate?: React.ReactNode;
}) {
  const { t } = useI18n();

  return (
    <main className="shell py-10 sm:py-14 pb-28 md:pb-14">
      <header className="mb-6 max-w-2xl">
        <p className="text-sm text-fg-muted font-mono mb-3">{t("notebook.header")}</p>
        <h1 className="display text-display-lg mb-3">
          {t("notebook.title")} <span className="display-it text-ember">{t("notebook.titleAccent")}</span>
        </h1>
      </header>

      {/* Tabs — kept visible for guests so the page reads as the notebook,
          just empty, rather than as a generic access-denied screen. Pill
          tabs (Plan 1 Task 8), not the old underline TabLink: these navigate
          via next/link + a query param (no client-side tab state), so Tabs
          takes href/active per item rather than assuming a controlled model. */}
      <Tabs
        className="mb-8"
        items={[
          {
            key: "starred",
            href: "/notebook",
            active: tab === "starred",
            label: (
              <>
                <Star size={14} /> {t("notebook.tabStarred")} ({entries.length})
              </>
            ),
          },
          {
            key: "leeches",
            href: "/notebook?tab=leeches",
            active: tab === "leeches",
            label: (
              <>
                <Flame size={14} /> {t("notebook.tabLeeches")} ({leeches.length})
              </>
            ),
          },
          {
            key: "known",
            href: "/notebook?tab=known",
            active: tab === "known",
            label: (
              <>
                <CheckCheck size={14} /> {t("known.filter")} ({known.length})
              </>
            ),
          },
        ]}
      />

      {gate ??
        (tab === "starred" ? (
          <StarredPanel entries={entries} />
        ) : tab === "leeches" ? (
          <LeechesPanel leeches={leeches} />
        ) : (
          <KnownPanel known={known} />
        ))}
    </main>
  );
}

function StarredPanel({ entries }: { entries: Entry[] }) {
  const { t } = useI18n();
  const n = entries.length;

  if (n === 0) {
    return (
      <Card variant="flat" className="p-10 sm:p-14 text-center max-w-xl mx-auto">
        <span className="inline-grid h-12 w-12 place-items-center rounded-full bg-ember/10 text-ember mb-4">
          <Star size={20} />
        </span>
        <h2 className="display text-xl mb-2">{t("notebook.emptyTitle")}</h2>
        <p className="text-fg-muted text-sm mb-6">{t("notebook.emptyBody")}</p>
        <Link
          href="/browse"
          className={buttonClasses("primary", "sm")}
        >
          {t("notebook.goBrowse")}
        </Link>
      </Card>
    );
  }

  return (
    <>
      <p className="text-fg-muted mb-5">
        {n === 1 ? t("notebook.subtitleOne") : t("notebook.subtitle", { n })}
      </p>

      {/* Study actions */}
      <div className="flex flex-col sm:flex-row gap-3 mb-3">
        <Link
          href="/study/flashcard?scope=starred"
          className={buttonClasses("primary", "sm")}
        >
          <GraduationCap size={16} /> {t("notebook.studyStarred")}
        </Link>
        <Link
          href="/study/cram?scope=starred"
          className="inline-flex items-center justify-center gap-2 rounded-full border border-hairline/10 px-5 py-2.5 text-sm font-medium text-fg-muted hover:text-fg hover:border-ember/40 transition-colors"
        >
          <Zap size={16} /> {t("notebook.cramStarred")}
        </Link>
      </div>
      <p className="text-xs text-fg-muted/80 mb-6">{t("notebook.dailyLimitNote")}</p>

      <div className="grid gap-2.5">
        {entries.map((w) => (
          <WordRow key={w.wordId} w={w} />
        ))}
      </div>
    </>
  );
}

function LeechesPanel({ leeches }: { leeches: Entry[] }) {
  const { t } = useI18n();
  const n = leeches.length;

  if (n === 0) {
    return (
      <Card variant="flat" className="p-10 sm:p-14 text-center max-w-xl mx-auto">
        <span className="inline-grid h-12 w-12 place-items-center rounded-full bg-moss-500/10 text-moss-500 mb-4">
          <Flame size={20} />
        </span>
        <h2 className="display text-xl mb-2">{t("notebook.leechEmptyTitle")}</h2>
        <p className="text-fg-muted text-sm">{t("notebook.leechEmptyBody")}</p>
      </Card>
    );
  }

  return (
    <>
      <p className="text-fg-muted mb-5 max-w-2xl">{t("notebook.leechExplainer")}</p>

      <div className="mb-6">
        <Link
          href="/study/cram?scope=leeches"
          className={buttonClasses("primary", "sm")}
        >
          <Zap size={16} /> {t("notebook.drillLeeches")}
        </Link>
      </div>

      <div className="grid gap-2.5">
        {leeches.map((w) => (
          <WordRow key={w.wordId} w={w} leech />
        ))}
      </div>
    </>
  );
}

function KnownPanel({ known }: { known: Entry[] }) {
  const { t } = useI18n();

  if (!known.length) {
    return (
      <Card variant="flat" className="p-8 text-center">
        <span className="grid h-11 w-11 place-items-center rounded-full bg-moss-500/10 text-moss-500 mx-auto mb-4">
          <CheckCheck size={18} strokeWidth={2} />
        </span>
        <h2 className="display text-xl mb-2">{t("known.filter")}</h2>
        <p className="text-fg-muted text-sm">{t("known.mark")}</p>
      </Card>
    );
  }

  return (
    <div>
      {/* Says out loud that the mark comes off — a one-way "I know this" would
          lose the word to a mistap, since selection drops it to 2% weight. */}
      <p className="text-fg-muted mb-5 max-w-2xl text-sm">{t("known.unmarkHint")}</p>
      <div className="space-y-2.5">
        {known.map((w) => (
          <WordRow key={w.wordId} w={w} showKnown />
        ))}
      </div>
    </div>
  );
}

function WordRow({ w, leech, showKnown }: { w: Entry; leech?: boolean; showKnown?: boolean }) {
  const { t, lang } = useI18n();
  const st = w.card ? stateLabel[w.card.state] : null;
  const typeLabel = lang === "vi" ? w.typeVi : w.typeEn;
  const overdue = w.card ? new Date(w.card.due) <= new Date() : false;

  return (
    <Card variant="interactive" className="p-4 sm:p-5 flex items-start gap-4">
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <Link href={`/word/${encodeURIComponent(w.word)}`} className="display text-lg hover:text-ember transition-colors">
            {w.word}
          </Link>
          <CefrStamp level={w.cefr} />
          {typeLabel && <span className="text-xs text-fg-muted">· {typeLabel}</span>}
          {w.note && <StickyNote size={13} className="text-ember" aria-label={t("notebook.hasNote")} />}
        </div>
        {w.definitionEn && <p className="text-sm text-fg-muted mt-1 line-clamp-2">{w.definitionEn}</p>}
        {w.definitionVi && <p className="text-xs text-fg-muted/70 mt-0.5 line-clamp-1">{w.definitionVi}</p>}
      </div>
      <div className="flex flex-col items-end gap-2 shrink-0">
        {leech && w.card ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-400/10 text-red-400 px-2.5 py-1 text-[11px] font-semibold tabular-nums">
            <Flame size={11} /> {t("notebook.lapsesLabel", { n: w.card.lapses })}
          </span>
        ) : null}
        {showKnown ? (
          <KnownButton wordId={w.wordId} initialKnown={w.known ?? true} />
        ) : (
          <StarButton wordId={w.wordId} initialStarred={w.starred} size="sm" />
        )}
        {st ? (
          <Chip className={cn("text-[9px]", st.c)}>{t(st.key)}</Chip>
        ) : (
          <Chip className="text-[9px] text-fg-muted">—</Chip>
        )}
        {leech && w.card && (
          <span className="text-[10px] text-fg-muted tabular-nums">
            {t("word.srsDue")} {overdue ? t("notebook.dueNow") : formatInterval(new Date(w.card.due))}
          </span>
        )}
      </div>
    </Card>
  );
}
