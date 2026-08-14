import "server-only";
import { prisma } from "../db";
import { STATES } from "../fsrs";
import type { BulkAction } from "./bulk";

export async function applyBulk(
  userId: string,
  wordIds: string[],
  action: BulkAction
): Promise<{ changed: number }> {
  if (action === "reset") {
    // Put the review schedule back to the start, WITHOUT touching ReviewLog
    // and WITHOUT deleting the Card. xp (UserProgress/DailyStat) is
    // ReviewLog-derived, and `db:backfill-xp --force` rebuilds it from those
    // logs — deleting a log would make xp silently drop at the next backfill.
    // reps/lapses are kept too: they are history that already happened, not
    // schedule state.
    const r = await prisma.card.updateMany({
      where: { userId, wordId: { in: wordIds } },
      data: {
        state: STATES.New,
        due: new Date(),
        stability: 0,
        difficulty: 0,
        elapsedDays: 0,
        scheduledDays: 0,
        lastReview: null,
      },
    });
    return { changed: r.count };
  }

  const patch =
    action === "mark-known" ? { known: true }
    : action === "unmark-known" ? { known: false }
    : action === "star" ? { starred: true }
    : { starred: false };

  // WordMark has a unique [userId, wordId] but createMany can't upsert, so
  // create whatever rows are missing (skipDuplicates tolerates a race) then
  // update the whole batch.
  await prisma.wordMark.createMany({
    data: wordIds.map((wordId) => ({ userId, wordId })),
    skipDuplicates: true,
  });
  const r = await prisma.wordMark.updateMany({
    where: { userId, wordId: { in: wordIds } },
    data: patch,
  });

  // Clean up rows that no longer carry any signal — the same invariant
  // setWordMark keeps (notebook.ts): not starred, no note, not known means
  // don't keep the row.
  await prisma.wordMark.deleteMany({
    where: { userId, wordId: { in: wordIds }, starred: false, known: false, note: "" },
  });
  return { changed: r.count };
}
