import "server-only";
import { prisma } from "../db";
import { todayStr } from "../utils";
import { leechWhere } from "../study-engine";
import { computeStreakFromDb } from "../gamification-checks";
import { pickReminder, countDaysInactive, isSaturdayAppDay, type Reminder } from "./pick";

/**
 * The four numbers a reminder decision needs beyond the win-back lookback. Split
 * out because the home page already computes every one of them for its dashboard,
 * and recomputing them there costs an unbounded DailyStat scan (the streak) plus
 * two counts on the app's most-loaded page.
 */
export type ReminderFacts = {
  /** DailyStat.totalCount > 0 for today's app-day. */
  studiedToday: boolean;
  streak: number;
  dueCount: number;
  leechCount: number;
};

/**
 * Decide from facts the caller already holds. Only the win-back lookback is
 * queried here.
 *
 * This is the one place ReminderFacts becomes a ReminderInput — getReminderState
 * delegates to it rather than calling pickReminder itself, so the banner and the
 * push can never be built from two different mappings.
 */
export async function getReminderStateFrom(
  userId: string,
  facts: ReminderFacts,
  now = new Date()
): Promise<Reminder | null> {
  const today = todayStr(now);
  // Only the last 21 days: win-back stops at the day-14 mark, so anything older
  // cannot change the answer.
  const activeDays = await prisma.dailyStat.findMany({
    where: { userId, totalCount: { gt: 0 } },
    orderBy: { dateStr: "desc" },
    take: 21,
    select: { dateStr: true },
  });

  return pickReminder({
    ...facts,
    daysInactive: countDaysInactive(activeDays.map((d) => d.dateStr), today),
    isSaturday: isSaturdayAppDay(now),
  });
}

// Gather everything from the DB, for callers that hold nothing yet (the cron). The
// SAME decision path the in-app banner uses — that is what keeps the banner and the
// push notification from ever saying different things.
export async function getReminderState(userId: string, now = new Date()): Promise<Reminder | null> {
  const today = todayStr(now);

  const [todayStat, streak, dueCount, leechCount] = await Promise.all([
    prisma.dailyStat.findUnique({
      where: { userId_dateStr: { userId, dateStr: today } },
      select: { totalCount: true },
    }),
    computeStreakFromDb(prisma, userId),
    prisma.card.count({ where: { userId, due: { lte: now }, state: { gte: 1 } } }),
    prisma.card.count({ where: leechWhere(userId) }),
  ]);

  return getReminderStateFrom(
    userId,
    {
      // "Had activity" = totalCount > 0, the same predicate computeStreakFromDb uses.
      studiedToday: (todayStat?.totalCount ?? 0) > 0,
      streak,
      dueCount,
      leechCount,
    },
    now
  );
}
