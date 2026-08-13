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
const USER_KEY = "me";

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

// Full rows for today's board: streak + lastActiveAt are computed here because
// they are actually rendered. `dates` must already be restricted to elapsed
// days (see buildBoard) — rivalWeeklyXp sums exactly what it's given, so
// passing the full Mon..Sun week here would credit rivals with days that
// haven't happened yet.
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
      key: USER_KEY,
      name: input.userName,
      colorClass: USER_COLOR,
      weeklyXp: input.userWeeklyXp,
      streak: input.userStreak,
      lastActiveAt: null,
    },
  ];
}

type RankRow = { key: string; weeklyXp: number };

// Weekly totals only — everything ranking needs, and nothing else. Used for
// yesterday's snapshot, which exists solely to compare rank positions: it
// never renders a streak badge or a "last active" stamp, so computing them
// (rivalStreaks walks up to STREAK_LOOKBACK_DAYS days, lastActiveAt walks up
// to 4) would be pure waste — the same waste ruling R11 removed from the
// per-rival streak call.
function rankRowsFor(
  userId: string,
  userWeeklyXp: number,
  pace: number,
  now: Date,
  dates: string[]
): RankRow[] {
  const rivals = buildRivals(userId, now);
  const weekly = rivalWeeklyXp(rivals, dates, pace);
  const rivalRows: RankRow[] = rivals.map((r, i) => ({ key: r.id, weeklyXp: weekly[i] }));
  return [...rivalRows, { key: USER_KEY, weeklyXp: userWeeklyXp }];
}

// XP desc; ties break on key so ordering never flickers between renders.
function rank(rows: RankRow[]): Map<string, number> {
  const sorted = [...rows].sort(
    (a, b) => b.weeklyXp - a.weeklyXp || (a.key < b.key ? -1 : 1)
  );
  return new Map(sorted.map((r, i) => [r.key, i + 1]));
}

export function buildBoard(input: {
  userId: string;
  userName: string;
  userWeeklyXp: number;
  /**
   * The user's own weekly XP total as it stood at the end of yesterday (same
   * week, days up to and including yesterday). Supplied by the caller — Task
   * 9 sources it from the same DailyStat rows and totalXp helper that produce
   * userWeeklyXp, just restricted to dateStr <= yesterday. Not derived here:
   * a single weekly total can't be un-summed into "yesterday's slice" without
   * inventing per-day history.
   */
  userWeeklyXpThroughYesterday: number;
  userStreak: number;
  /**
   * The daily figure rivals are scaled to — the caller's dailyPace (weekly
   * output spread over the week), not their sessionPace (per-session
   * intensity). See pace.ts for why the distinction matters.
   */
  pace: number;
  now: Date;
}): BoardEntry[] {
  const weekDays = weekDates(input.now);
  // Rivals only accumulate XP for days that have actually elapsed — the same
  // rule a real weekly total obeys. Using the full Mon..Sun week regardless of
  // what day it is would freeze every rival's total at the week's eventual
  // total from Monday morning on, while the user's real total still grows
  // day by day.
  const datesThroughToday = weekDays.filter((d) => d <= todayStr(input.now));

  const rows = rowsFor(input, input.now, datesThroughToday);
  const todayRanks = rank(rows);

  // Δ compares today's ranking against yesterday's. Monday has no Δ — not
  // because "everyone is at zero" (they aren't: Monday's board already sums
  // Monday's elapsed XP), but because the rival roster is a sliding window
  // keyed on the week: yesterday (Sunday) belongs to the PREVIOUS week's ten
  // rivals, so comparing ranks across that boundary would be meaningless.
  let yesterdayRanks: Map<string, number> | null = null;
  if (!isMondayUtc(input.now)) {
    const yesterday = addUtcDays(input.now, -1);
    const datesThroughYesterday = weekDays.filter((d) => d <= todayStr(yesterday));
    yesterdayRanks = rank(
      rankRowsFor(
        input.userId,
        input.userWeeklyXpThroughYesterday,
        input.pace,
        yesterday,
        datesThroughYesterday
      )
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
