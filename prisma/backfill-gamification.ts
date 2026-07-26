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
// ⚠️  --force RESETS each user's XP to the value DERIVED FROM THEIR ReviewLogs.
//     Today that's every XP source, so it's harmless. But once non-ReviewLog
//     bonus XP exists (Phase 5's matching/pronunciation ledger split), --force
//     would ERASE that bonus XP, because the backfill only knows about reviews.
//     After Phase 5, do NOT --force without first accounting for bonus XP.

import { PrismaClient } from "@prisma/client";
import { runBackfillForUser } from "../src/lib/gamification-backfill";

const prisma = new PrismaClient();

async function main() {
  const force = process.argv.includes("--force");

  if (force) {
    console.warn(
      "⚠️  --force: XP will be RESET to the value derived from each user's ReviewLogs. " +
        "This erases any future non-ReviewLog bonus XP (matching/pronunciation). " +
        "Safe today (reviews are the only XP source); revisit after Phase 5's ledger split."
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
