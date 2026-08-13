// Assembles the board: the user's real weekly XP alongside ten synthetic
// rivals. The user's RANK is earned — nothing here nudges it. The only thing
// calibrated to the user is how hard the rivals are (their pace), decided once
// per week.

import { addUtcDays, todayStr } from "@/lib/utils";
import { buildRivals, type Rival } from "./rivals";
import { rivalWeeklyXp, dailyXpForAll } from "./xp";
import { lastActiveAt } from "./activity";
import { weekDates, isMondayUtc } from "./week";
import { STREAK_LOOKBACK_DAYS } from "./constants";

export type BoardEntry = {
  kind: "user" | "rival";
  key: string;
  name: string;
  colorClass: string;
  weeklyXp: number;
  streak: number;
  /** ISO instant; null cho dòng user (client dùng dữ liệu thật của họ). */
  lastActiveAt: string | null;
  rank: number;
  /** null vào thứ Hai — tuần mới, mọi người bằng 0. */
  delta: number | null;
};

const USER_COLOR = "bg-ember/12 text-ember";

// Streaks for every rival in one pass. dailyXpForAll computes the whole
// roster's XP for a day, so calling it per rival would recompute the same
// day ten times over. Counts back from yesterday: today is still in progress.
function rivalStreaks(rivals: Rival[], now: Date, pace: number): number[] {
  const streaks = new Array(rivals.length).fill(0) as number[];
  const ended = new Array(rivals.length).fill(false) as boolean[];
  for (let back = 1; back <= STREAK_LOOKBACK_DAYS; back++) {
    if (ended.every(Boolean)) break;
    const day = todayStr(addUtcDays(now, -back));
    const xps = dailyXpForAll(rivals, day, pace);
    for (let i = 0; i < rivals.length; i++) {
      if (ended[i]) continue;
      if (xps[i] > 0) streaks[i] += 1;
      else ended[i] = true;
    }
  }
  return streaks;
}

type Row = Omit<BoardEntry, "rank" | "delta">;

function rowsFor(
  input: { userId: string; userName: string; userWeeklyXp: number; userStreak: number; pace: number },
  now: Date,
  dates: string[]
): Row[] {
  const rivals = buildRivals(input.userId, now);
  const weekly = rivalWeeklyXp(rivals, dates, input.pace);
  const streaks = rivalStreaks(rivals, now, input.pace);
  const rivalRows: Row[] = rivals.map((r, i) => ({
    kind: "rival",
    key: r.id,
    name: r.name,
    colorClass: r.colorClass,
    weeklyXp: weekly[i],
    streak: streaks[i],
    lastActiveAt: lastActiveAt(r, now).toISOString(),
  }));
  return [
    ...rivalRows,
    {
      kind: "user",
      key: "me",
      name: input.userName,
      colorClass: USER_COLOR,
      weeklyXp: input.userWeeklyXp,
      streak: input.userStreak,
      lastActiveAt: null,
    },
  ];
}

// XP desc; ties break on key so ordering never flickers between renders.
function rank(rows: Row[]): Map<string, number> {
  const sorted = [...rows].sort(
    (a, b) => b.weeklyXp - a.weeklyXp || (a.key < b.key ? -1 : 1)
  );
  return new Map(sorted.map((r, i) => [r.key, i + 1]));
}

export function buildBoard(input: {
  userId: string;
  userName: string;
  userWeeklyXp: number;
  userStreak: number;
  pace: number;
  now: Date;
}): BoardEntry[] {
  const dates = weekDates(input.now);
  const rows = rowsFor(input, input.now, dates);
  const todayRanks = rank(rows);

  // Δ compares against the board as it stood at the end of yesterday: the same
  // week's XP accumulated through yesterday, NOT yesterday's XP alone. On
  // Monday there is nothing comparable — everyone is at zero — so Δ is hidden.
  // The roster itself is a sliding window keyed on the week, so on Monday
  // "yesterday" belongs to a different week's ten rivals entirely; comparing
  // ranks across that boundary would be meaningless, not just uninteresting.
  let yesterdayRanks: Map<string, number> | null = null;
  if (!isMondayUtc(input.now)) {
    const yesterday = addUtcDays(input.now, -1);
    const throughYesterday = dates.filter((d) => d <= todayStr(yesterday));
    // The user's own XP through yesterday isn't knowable from the weekly total
    // alone; prorating by elapsed days keeps Δ honest in direction (a day of
    // work moves you up) without inventing per-day history.
    const elapsed = Math.max(1, throughYesterday.length);
    const userThrough = Math.round((input.userWeeklyXp * (elapsed - 1)) / elapsed);
    yesterdayRanks = rank(
      rowsFor({ ...input, userWeeklyXp: userThrough }, yesterday, throughYesterday)
    );
  }

  return rows
    .map((r) => {
      const rankNow = todayRanks.get(r.key)!;
      const rankPrev = yesterdayRanks?.get(r.key);
      return {
        ...r,
        rank: rankNow,
        delta: rankPrev === undefined ? null : rankPrev - rankNow,
      };
    })
    .sort((a, b) => a.rank - b.rank);
}
