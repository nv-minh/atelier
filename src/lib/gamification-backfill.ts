// One-time XP/achievement backfill for a single user. NO server-only import so
// it's callable from BOTH the tsx CLI script (prisma/backfill-gamification.ts)
// AND the lazy inline backfill inside getGamificationSummary — one source of
// truth for "reconstruct a user's gamification state from their review history".

import type { PrismaClient } from "@prisma/client";
import { XP_PER_RATING } from "./gamification-defs";
import {
  xpByDayFromLogs,
  computeStreakFromDb,
  masteredCount,
  totalReviews,
  fullyStartedCefrLevels,
} from "./gamification-checks";
import { ACHIEVEMENTS } from "./gamification-defs";

export type BackfillResult = {
  userId: string;
  skipped: boolean;
  daysWritten: number;
  totalXp: number;
  achievementsUnlocked: number;
};

// Historically-earned achievement keys for a user, given already-computed
// counts. Mirrors the live awarder's thresholds so backfilled and live unlocks
// agree. One-shot families (perfect_session) are NOT backfilled — they need
// session context we don't reconstruct; they unlock going forward instead.
function historicalKeys(opts: {
  streak: number;
  reviews: number;
  mastered: number;
  cefrDone: string[];
}): string[] {
  const keys: string[] = [];
  for (const a of ACHIEVEMENTS) {
    if (a.family === "streak" && a.threshold && opts.streak >= a.threshold) keys.push(a.key);
    else if (a.family === "reviews" && a.threshold && opts.reviews >= a.threshold) keys.push(a.key);
    else if (a.family === "mastered" && a.threshold && opts.mastered >= a.threshold) keys.push(a.key);
    else if (a.family === "cefr") {
      const lvl = a.key.slice("cefr_".length);
      if (opts.cefrDone.includes(lvl)) keys.push(a.key);
    }
  }
  return keys;
}

// Reconstruct DailyStat.xp, UserProgress.xp, and historical achievements for one
// user. Idempotent by design: DailyStat.xp is SET (not incremented), UserProgress
// is upserted with an absolute xp, and achievement inserts skip duplicates.
export async function runBackfillForUser(
  prisma: PrismaClient,
  userId: string,
  opts: { force?: boolean } = {}
): Promise<BackfillResult> {
  const existing = await prisma.userProgress.findUnique({ where: { userId } });
  if (existing?.backfilledAt && !opts.force) {
    return { userId, skipped: true, daysWritten: 0, totalXp: 0, achievementsUnlocked: 0 };
  }

  const logs = await prisma.reviewLog.findMany({
    where: { userId },
    select: { rating: true, reviewedAt: true },
    orderBy: { reviewedAt: "asc" },
  });

  const { byDay, totalXp } = xpByDayFromLogs(logs);

  // Write per-day XP. Update existing DailyStat rows; create a row only when a
  // day has logs but no DailyStat (shouldn't normally happen, but keeps XP whole).
  let daysWritten = 0;
  for (const [dateStr, xp] of byDay) {
    const row = await prisma.dailyStat.findUnique({
      where: { userId_dateStr: { userId, dateStr } },
    });
    if (row) {
      await prisma.dailyStat.update({
        where: { userId_dateStr: { userId, dateStr } },
        data: { xp },
      });
    } else {
      await prisma.dailyStat.create({ data: { userId, dateStr, xp } });
    }
    daysWritten += 1;
  }

  // Absolute XP total (idempotent — set, never increment).
  await prisma.userProgress.upsert({
    where: { userId },
    update: { xp: totalXp, backfilledAt: new Date() },
    create: { userId, xp: totalXp, backfilledAt: new Date() },
  });

  // Silently unlock everything historically earned.
  const [streak, reviews, mastered, cefrDone] = await Promise.all([
    computeStreakFromDb(prisma, userId),
    totalReviews(prisma, userId),
    masteredCount(prisma, userId),
    fullyStartedCefrLevels(prisma, userId),
  ]);
  const keys = historicalKeys({ streak, reviews, mastered, cefrDone });
  let achievementsUnlocked = 0;
  if (keys.length > 0) {
    const res = await prisma.achievement.createMany({
      data: keys.map((key) => ({ userId, key })),
      skipDuplicates: true,
    });
    achievementsUnlocked = res.count;
  }

  return { userId, skipped: false, daysWritten, totalXp, achievementsUnlocked };
}
