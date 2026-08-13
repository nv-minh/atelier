import "server-only";
import { prisma } from "../db";
import { LEARNED_STATES } from "../fsrs";
import { bandToCefr } from "../placement/estimate";
import { shapeSummary, type VaultSummary } from "./summary";

// Four queries in parallel (Postgres serverless charges latency per round
// trip), then hand every count over to the pure shapeSummary.
export async function getVaultSummary(userId: string): Promise<VaultSummary> {
  const [total, grouped, knownCount, profile] = await Promise.all([
    prisma.word.count(),
    prisma.card.groupBy({ by: ["state"], _count: true, where: { userId } }),
    prisma.wordMark.count({ where: { userId, known: true } }),
    prisma.learnerProfile.findUnique({ where: { userId }, select: { band: true } }),
  ]);

  const cardStates = grouped.map((g) => ({ state: g.state, count: g._count }));
  if (!profile) {
    return shapeSummary({ total, cardStates, knownCount, bandLevel: null });
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
  return shapeSummary({ total, cardStates, knownCount, bandLevel: level, bandTotal, bandLearned });
}
