"use client";

import type { BoardEntry } from "@/lib/leaderboard/board";
import { RivalRow } from "@/components/leaderboard/rival-row";
import { HowItWorks } from "@/components/leaderboard/how-it-works";
import { useI18n } from "@/components/i18n-provider";

export function LeaderboardView({
  board,
  nowIso,
  isMonday,
}: {
  board: BoardEntry[];
  nowIso: string;
  /** Computed by the server from `isMondayUtc(now)` — NOT inferred from the
   *  board's deltas. Every row's delta happens to be null on Monday because
   *  buildBoard nulls them all together, but that's an implementation detail
   *  of buildBoard, not a contract the view should rely on. */
  isMonday: boolean;
}) {
  const { t } = useI18n();

  return (
    <main className="shell py-10 sm:py-16 pb-28 md:pb-16">
      <header className="mb-8 sm:mb-12 max-w-2xl">
        <p className="text-sm text-fg-muted mb-3 font-mono">{t("leaderboard.header")}</p>
        <h1 className="display text-display-lg mb-4">
          {t("leaderboard.title")}{" "}
          <span className="display-it text-ember">{t("leaderboard.titleAccent")}</span>
        </h1>
        <p className="text-fg-muted leading-relaxed">{t("leaderboard.subtitle")}</p>
      </header>

      {isMonday && (
        <p className="mb-5 text-sm text-fg-muted">{t("leaderboard.mondayNote")}</p>
      )}

      <ul className="card-atelier p-1.5 sm:p-2">
        {board.map((e) => (
          <RivalRow key={e.key} entry={e} nowIso={nowIso} />
        ))}
      </ul>

      <div className="mt-6">
        <HowItWorks />
      </div>
    </main>
  );
}
