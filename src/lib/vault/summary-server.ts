import "server-only";
import { cache } from "react";
import { prisma } from "../db";
import { LEARNED_STATES } from "../fsrs";
import { bandToCefr } from "../placement/estimate";
import { shapeSummary, type VaultSummary } from "./summary";

// Three queries in parallel (Postgres serverless charges latency per round
// trip), then hand every count over to the pure shapeSummary. `total` (every
// Word in the table, unfiltered) used to be a fourth query here, but nothing
// consumed it — /browse renders its own filtered `total` as a separate prop —
// so it was a full round trip on every render for a number no one read.
//
// Wrapped in React's cache() so repeated calls within the SAME request dedupe
// to one DB round trip. Deliberately NOT unstable_cache: this is per-user
// data, and unstable_cache's cross-REQUEST cache would risk serving one
// learner's numbers to another.
export const getVaultSummary = cache(async (userId: string): Promise<VaultSummary> => {
  const [grouped, knownCount, profile] = await Promise.all([
    prisma.card.groupBy({ by: ["state"], _count: true, where: { userId } }),
    prisma.wordMark.count({ where: { userId, known: true } }),
    prisma.learnerProfile.findUnique({ where: { userId }, select: { band: true } }),
  ]);

  const cardStates = grouped.map((g) => ({ state: g.state, count: g._count }));
  if (!profile) {
    return shapeSummary({ cardStates, knownCount, bandLevel: null });
  }

  // Only count for the band the learner is actually AT — two cheap counts,
  // instead of scanning every card the user owns the way getDashboardStats
  // has to in order to build all five bands.
  const level = bandToCefr(profile.band);
  const [bandTotal, bandLearned] = await Promise.all([
    prisma.word.count({ where: { cefr: level } }),
    prisma.card.count({
      where: { userId, state: { in: [...LEARNED_STATES] }, word: { cefr: level } },
    }),
  ]);
  return shapeSummary({ cardStates, knownCount, bandLevel: level, bandTotal, bandLearned });
});
