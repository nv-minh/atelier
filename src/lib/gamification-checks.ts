// Shared achievement-computation helpers. NO server-only import so the tsx
// backfill script (prisma/backfill-gamification.ts) can reuse the exact same
// logic the server awarder uses — same split pattern as export-format.ts.
//
// Each helper takes a PrismaClient so it works with both the app singleton
// (src/lib/db.ts) and a throwaway client in the backfill script.

import type { PrismaClient } from "@prisma/client";
import { todayStr, addUtcDays } from "./utils";
import { XP_PER_RATING, CEFR_ACHIEVEMENT_LEVELS } from "./gamification-defs";

// A card is "mastered" once it's in Review state with a scheduled interval of at
// least three weeks — i.e. it's genuinely stuck in long-term memory.
export const MASTERED_STATE = 2;
export const MASTERED_MIN_DAYS = 21;

// Consecutive active days ending today or yesterday. Same algorithm as
// stats.computeStreak — kept here (rather than importing the server-only stats
// module) so the backfill script can call it too.
export async function computeStreakFromDb(prisma: PrismaClient, userId: string): Promise<number> {
  // Bound the scan: a streak can only run back from today, so rows older than
  // ~13 months can never be part of it. Without this Postgres ships the user's
  // ENTIRE DailyStat history before the break-early loop below even starts —
  // slow for long-tenured users, and 200x worse inside the reminder cron which
  // calls this per user. The take is a hard backstop on top of the date window.
  const since = todayStr(addUtcDays(new Date(), -400));
  const stats = await prisma.dailyStat.findMany({
    // A day counts toward the streak if it has EITHER vocab SRS reviews
    // (totalCount) OR grammar answers (grammarCount) — the user chose full
    // gamification integration for grammar (design §7). totalCount itself
    // stays SRS-only so vocab accuracy/heatmap stats remain pure.
    where: {
      userId,
      dateStr: { gte: since },
      OR: [{ totalCount: { gt: 0 } }, { grammarCount: { gt: 0 } }],
    },
    orderBy: { dateStr: "desc" },
    take: 400,
    select: { dateStr: true },
  });
  if (stats.length === 0) return 0;

  const today = todayStr();
  const yesterday = todayStr(addUtcDays(new Date(), -1));
  if (stats[0].dateStr !== today && stats[0].dateStr !== yesterday) return 0;

  let streak = 0;
  // cursor is a UTC-midnight base (parsed from a YYYY-MM-DD dateStr), so step it
  // on the UTC axis — addDays() uses local setDate/getDate and would slip a day
  // across a DST transition, resetting every streak to 0 on transition day.
  let cursor = new Date(stats[0].dateStr);
  for (const s of stats) {
    if (s.dateStr === todayStr(cursor)) {
      streak += 1;
      cursor = addUtcDays(cursor, -1);
    } else {
      break;
    }
  }
  return streak;
}

export async function masteredCount(prisma: PrismaClient, userId: string): Promise<number> {
  return prisma.card.count({
    where: { userId, state: MASTERED_STATE, scheduledDays: { gte: MASTERED_MIN_DAYS } },
  });
}

// Which CEFR levels the user has fully started: for a level to count, the user
// must have a card in state >= 1 for EVERY word of that level. Done with two
// groupBy queries (total words per cefr, started cards per cefr) + a JS compare,
// mirroring getDashboardStats' approach — no per-level N+1.
export async function fullyStartedCefrLevels(
  prisma: PrismaClient,
  userId: string
): Promise<string[]> {
  const [wordByCefr, startedCards] = await Promise.all([
    prisma.word.groupBy({ by: ["cefr"], _count: true }),
    prisma.card.findMany({
      where: { userId, state: { gte: 1 } },
      select: { word: { select: { cefr: true } } },
    }),
  ]);
  const totalByCefr: Record<string, number> = {};
  for (const g of wordByCefr) totalByCefr[g.cefr] = g._count;
  const startedByCefr: Record<string, number> = {};
  for (const c of startedCards) {
    const lvl = c.word.cefr;
    startedByCefr[lvl] = (startedByCefr[lvl] ?? 0) + 1;
  }
  const done: string[] = [];
  for (const lvl of CEFR_ACHIEVEMENT_LEVELS) {
    const total = totalByCefr[lvl] ?? 0;
    if (total > 0 && (startedByCefr[lvl] ?? 0) >= total) done.push(lvl);
  }
  return done;
}

// Total lifetime reviews logged (one indexed count).
export async function totalReviews(prisma: PrismaClient, userId: string): Promise<number> {
  return prisma.reviewLog.count({ where: { userId } });
}

// Group a user's review logs by UTC day and sum XP per day from ratings.
// Used by the backfill to reconstruct DailyStat.xp historically. The day key
// matches DailyStat.dateStr (todayStr = UTC ISO date).
export function xpByDayFromLogs(
  logs: { rating: number; reviewedAt: Date }[]
): { byDay: Map<string, number>; totalXp: number } {
  const byDay = new Map<string, number>();
  let totalXp = 0;
  for (const log of logs) {
    const xp = XP_PER_RATING[log.rating] ?? 0;
    totalXp += xp;
    const day = todayStr(log.reviewedAt);
    byDay.set(day, (byDay.get(day) ?? 0) + xp);
  }
  return { byDay, totalXp };
}
