import "server-only";
import { prisma } from "../db";
import { CEFR_LEVELS } from "../export-format";
import { DRIFT, type DriftReview, computeDrift } from "./drift";

/** Reviews considered. Recent enough to reflect now, wide enough to be stable. */
const WINDOW = 100;

/**
 * Nudge the learner's stored band from their recent reviews.
 *
 * Thin by design: the decision is computeDrift's, this only joins the data and
 * writes the result. Called from endSession, which is already a write path with
 * a best-effort wrapper — there is no job runner here, and a session ending is
 * exactly when fresh evidence exists.
 *
 * Returns what it did so the caller can log it; never throws for "nothing to
 * do". A learner with no profile is skipped: drift adjusts a measurement, it does
 * not invent one.
 */
export async function applyDrift(
  userId: string,
  now = new Date()
): Promise<{ moved: boolean; delta: number; reason: string }> {
  const profile = await prisma.learnerProfile.findUnique({
    where: { userId },
    select: { band: true, driftedAt: true },
  });
  if (!profile) return { moved: false, delta: 0, reason: "no-profile" };

  const logs = await prisma.reviewLog.findMany({
    where: { userId },
    orderBy: { reviewedAt: "desc" },
    take: WINDOW,
    select: {
      rating: true,
      card: { select: { lapses: true, word: { select: { cefr: true } } } },
    },
  });

  const reviews: DriftReview[] = [];
  for (const l of logs) {
    const cefr = l.card?.word?.cefr;
    if (!cefr) continue;
    const cefrIndex = (CEFR_LEVELS as readonly string[]).indexOf(cefr);
    if (cefrIndex === -1) continue;
    reviews.push({ cefrIndex, rating: l.rating, lapses: l.card.lapses });
  }

  const result = computeDrift({
    reviews,
    band: profile.band,
    driftedAt: profile.driftedAt,
    now,
  });
  if (result.delta === 0) return { moved: false, delta: 0, reason: result.reason };

  const top = CEFR_LEVELS.length - 1;
  const band = Math.min(top, Math.max(0, profile.band + result.delta));

  await prisma.learnerProfile.update({
    where: { userId },
    data: {
      band,
      // The band is now derived from behaviour rather than from the test. placedAt
      // is deliberately left alone: it records when they were measured, which is
      // still true, and the retake prompt reads it.
      source: "drift",
      driftedAt: now,
    },
  });

  return { moved: true, delta: result.delta, reason: result.reason };
}
