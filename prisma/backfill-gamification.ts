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

import { PrismaClient } from "@prisma/client";
import { runBackfillForUser } from "../src/lib/gamification-backfill";

const prisma = new PrismaClient();

async function main() {
  const force = process.argv.includes("--force");

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
