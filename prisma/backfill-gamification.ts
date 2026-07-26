/* eslint-disable */
// One-time gamification backfill: reconstruct DailyStat.xp, UserProgress.xp, and
// historically-earned achievements for every user who has review history.
//
//   npm run db:backfill-xp            # skips users already backfilled
//   npm run db:backfill-xp -- --force # re-run for everyone
//
// Idempotent: safe to run repeatedly (XP is SET, not incremented; achievement
// inserts skip duplicates). The per-user logic lives in
// src/lib/gamification-backfill.ts and is shared with the lazy inline backfill
// in getGamificationSummary — one source of truth.
//
// --force RESETS each user's ReviewLog-derived `xp` (DailyStat.xp + UserProgress.xp)
// to the value computed from their ReviewLogs. As of Phase 5 the bonusXp ledger
// (DailyStat.bonusXp + UserProgress.bonusXp) holds all non-SRS XP (matching, …)
// and is a SEPARATE column this script never reads or writes — so --force is now
// safe for bonus XP: it only rebuilds `xp`, leaving every bonus untouched. Total
// XP everywhere in the app is xp + bonusXp.

import { PrismaClient } from "@prisma/client";
import { runBackfillForUser } from "../src/lib/gamification-backfill";

const prisma = new PrismaClient();

async function main() {
  const force = process.argv.includes("--force");

  if (force) {
    console.warn(
      "--force: the ReviewLog-derived `xp` ledger will be RESET to the value " +
        "derived from each user's ReviewLogs. The separate bonusXp ledger " +
        "(non-SRS modes like matching) is NOT touched, so bonus XP is safe."
    );
  }

  // Only users who have at least one review log — no point touching the rest.
  const userIds = (
    await prisma.reviewLog.findMany({ distinct: ["userId"], select: { userId: true } })
  ).map((r) => r.userId);

  console.log(`Backfill starting for ${userIds.length} user(s) with review history${force ? " (--force)" : ""}.`);

  let processed = 0;
  let skipped = 0;
  let totalDays = 0;
  let totalAchievements = 0;

  for (const userId of userIds) {
    const res = await runBackfillForUser(prisma, userId, { force });
    if (res.skipped) {
      skipped += 1;
      continue;
    }
    processed += 1;
    totalDays += res.daysWritten;
    totalAchievements += res.achievementsUnlocked;
    console.log(
      `  ✓ ${userId}: ${res.totalXp} XP across ${res.daysWritten} day(s), ${res.achievementsUnlocked} achievement(s)`
    );
  }

  console.log(
    `Done. Processed ${processed}, skipped ${skipped} (already backfilled). ` +
      `${totalDays} DailyStat day(s) written, ${totalAchievements} achievement(s) unlocked.`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
