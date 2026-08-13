import "server-only";
import { prisma } from "@/lib/db";
import { totalXp } from "@/lib/gamification-defs";
import { addUtcDays, todayStr } from "@/lib/utils";
import { PACE_WINDOW_DAYS } from "./constants";
import { derivePace } from "./pace";

// Thin: fetch the window, hand the numbers to derivePace. Keep decisions there.
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
