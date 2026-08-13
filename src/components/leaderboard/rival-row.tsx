"use client";

import { Flame, ChevronUp, ChevronDown } from "lucide-react";
import type { BoardEntry } from "@/lib/leaderboard/board";
import { useI18n } from "@/components/i18n-provider";
import { cn } from "@/lib/utils";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const last = parts[parts.length - 1];
  return (parts.length > 1 ? parts[0][0] + last[0] : last.slice(0, 2)).toUpperCase();
}

export function RivalRow({ entry, nowIso }: { entry: BoardEntry; nowIso: string }) {
  const { t } = useI18n();
  const isUser = entry.kind === "user";

  const activeLabel = (() => {
    if (!entry.lastActiveAt) return null;
    const mins = Math.max(0, (Date.parse(nowIso) - Date.parse(entry.lastActiveAt)) / 60000);
    if (mins < 5) return t("leaderboard.activeNow");
    if (mins < 60) return t("leaderboard.activeMinutes", { n: Math.round(mins) });
    const hours = mins / 60;
    if (hours < 24) return t("leaderboard.activeHours", { n: Math.round(hours) });
    const days = Math.round(hours / 24);
    return days <= 1 ? t("leaderboard.activeYesterday") : t("leaderboard.activeDays", { n: days });
  })();

  return (
    <li
      className={cn(
        "flex items-center gap-3 sm:gap-4 rounded-2xl px-3 sm:px-4 py-3",
        isUser && "bg-ember/8 border border-ember/20"
      )}
    >
      <span className={cn("w-6 text-right font-mono text-sm", isUser ? "text-ember" : "text-soft")}>
        {entry.rank}
      </span>

      <span
        aria-hidden
        className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-semibold", entry.colorClass)}
      >
        {initials(entry.name)}
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className={cn("truncate text-sm", isUser ? "font-semibold" : "font-medium")}>
            {isUser ? t("leaderboard.you") : entry.name}
          </span>
          {entry.streak > 0 && (
            <span className="inline-flex shrink-0 items-center gap-0.5 text-xs text-soft">
              <Flame size={11} className="text-ember" />
              {entry.streak}
            </span>
          )}
        </span>
        {activeLabel && <span className="block text-xs text-soft/70">{activeLabel}</span>}
      </span>

      {entry.delta !== null && entry.delta !== 0 && (
        <span
          className={cn(
            "inline-flex shrink-0 items-center text-xs font-medium",
            entry.delta > 0 ? "text-moss-500" : "text-cefr-b2"
          )}
          aria-label={
            entry.delta > 0
              ? t("leaderboard.deltaUp", { n: entry.delta })
              : t("leaderboard.deltaDown", { n: -entry.delta })
          }
        >
          {entry.delta > 0 ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          {Math.abs(entry.delta)}
        </span>
      )}

      <span className="w-16 shrink-0 text-right font-mono text-sm tabular-nums">
        {entry.weeklyXp.toLocaleString()}
      </span>
    </li>
  );
}
