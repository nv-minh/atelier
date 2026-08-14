import "server-only";
import { prisma } from "../db";
import { todayStr } from "../utils";
import { leechWhere } from "../study-engine";
import { computeStreakFromDb } from "../gamification-checks";
import { pickReminder, countDaysInactive, isSaturdayAppDay, type Reminder } from "./pick";

// Gather a ReminderInput from the DB, then hand the decision to pickReminder. The
// SAME function the cron uses — that is what keeps the in-app banner and the push
// notification from ever saying different things.
export async function getReminderState(userId: string, now = new Date()): Promise<Reminder | null> {
  const today = todayStr(now);

  const [todayStat, streak, dueCount, leechCount, activeDays] = await Promise.all([
    prisma.dailyStat.findUnique({
      where: { userId_dateStr: { userId, dateStr: today } },
      select: { totalCount: true },
    }),
    computeStreakFromDb(prisma, userId),
    prisma.card.count({ where: { userId, due: { lte: now }, state: { gte: 1 } } }),
    prisma.card.count({ where: leechWhere(userId) }),
    // Only the last 21 days: win-back stops at the day-14 mark, so anything older
    // cannot change the answer.
    prisma.dailyStat.findMany({
      where: { userId, totalCount: { gt: 0 } },
      orderBy: { dateStr: "desc" },
      take: 21,
      select: { dateStr: true },
    }),
  ]);

  return pickReminder({
    // "Had activity" = totalCount > 0, the same predicate computeStreakFromDb uses.
    studiedToday: (todayStat?.totalCount ?? 0) > 0,
    streak,
    dueCount,
    leechCount,
    daysInactive: countDaysInactive(activeDays.map((d) => d.dateStr), today),
    isSaturday: isSaturdayAppDay(now),
  });
}
