import "server-only";
import { prisma } from "@/lib/db";
import { totalXp } from "@/lib/gamification-defs";
import { addUtcDays, todayStr } from "@/lib/utils";
import { PACE_WINDOW_DAYS } from "./constants";
import { derivePace } from "./pace";
import { weekDates } from "./week";

// The leaderboard's server-side DailyStat reads: the user's own pace, and the
// user's own XP through yesterday. Thin on purpose — fetch the window, hand
// the numbers to the pure helpers, keep decisions there.
export async function getUserPace(
  userId: string,
  now: Date
): Promise<{ pace: number; activeDays: number }> {
  const start = todayStr(addUtcDays(now, -(PACE_WINDOW_DAYS - 1)));
  const [rows, settings] = await Promise.all([
    prisma.dailyStat.findMany({
      where: { userId, dateStr: { gte: start } },
      select: { xp: true, bonusXp: true },
    }),
    prisma.settings.findUnique({ where: { userId }, select: { dailyGoalXp: true } }),
  ]);
  return derivePace(rows.map(totalXp), settings?.dailyGoalXp ?? 60);
}

// The user's accumulated XP through yesterday, for the board's rank deltas.
// Deliberately a strict SUBSET of getWeeklyRecap's thisWeek.xp computation —
// same rows, same totalXp helper, same week start — stopping one day earlier.
// Keeping it a subset rather than a second definition is what keeps the number
// the board displays identical to the one /stats shows.
export async function getUserXpThroughYesterday(userId: string, now: Date): Promise<number> {
  const yesterday = todayStr(addUtcDays(now, -1));
  const upto = weekDates(now).filter((d) => d <= yesterday);
  if (upto.length === 0) return 0; // Monday: nothing accumulated yet this week
  const rows = await prisma.dailyStat.findMany({
    where: { userId, dateStr: { in: upto } },
    select: { xp: true, bonusXp: true },
  });
  return rows.reduce((sum, r) => sum + totalXp(r), 0);
}
