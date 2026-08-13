// Word frequency as a normalized percentile.
//
// The one rule this module exists to enforce: a raw rank must never reach the
// database. Ranks in the pack files are per-source and not comparable across
// lists — `mister` is rank 1 in both the Business Service List and the TOEIC
// Service List, and `be` is rank 1 in NGSL-Spoken. Written into one shared
// column, that makes `mister` the most frequent word in English, and every
// learner who picks business or TOEIC sees it first.
//
// Normalizing against each list's own size fixes the comparison: freqPct is
// "how far from the top of its own list this word sits", 1 = most frequent.

/** Frequency scales a percentile can come from, best general scale first. */
export type FreqSource = "ngsl" | "ngsl-spoken" | "bsl" | "tsl";

/**
 * Which scale a pack's `rank` column came from. A pack absent here has no rank
 * data, and its words keep `freqPct = null` on purpose: the selection engine
 * scores null neutrally rather than inventing a number.
 */
export const PACK_FREQ_SOURCE: Record<string, FreqSource> = {
  business: "bsl",
  toeic: "tsl",
  conversation: "ngsl-spoken",
};

/**
 * rank → percentile in [0, 1], normalized against the list's own size.
 * Returns null for input that cannot produce a meaningful percentile, so
 * callers never have to invent a fallback number.
 *
 * Clamped because the lists disagree about where they start: NGSL-Spoken ranks
 * begin at 0, the service lists at 1.
 */
export function freqPctFromRank(rank: number | null | undefined, listSize: number): number | null {
  if (typeof rank !== "number" || !Number.isFinite(rank) || rank < 0) return null;
  if (!Number.isFinite(listSize) || listSize <= 0) return null;
  return Math.min(1, Math.max(0, 1 - rank / listSize));
}

/**
 * Percentile + provenance for one pack word. Both fields are null together —
 * a percentile whose scale is unknown is not usable for debugging later.
 */
export function freqForPackWord(
  packName: string,
  rank: number | null | undefined,
  listSize: number
): { freqPct: number | null; freqSource: FreqSource | null } {
  const freqSource = PACK_FREQ_SOURCE[packName];
  if (!freqSource) return { freqPct: null, freqSource: null };
  const freqPct = freqPctFromRank(rank, listSize);
  return freqPct === null ? { freqPct: null, freqSource: null } : { freqPct, freqSource };
}
