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

import { SELECTION } from "./selection/constants";

/** Frequency scales a percentile can come from, best general scale first. */
export type FreqSource = "ngsl" | "ngsl-spoken" | "bsl" | "tsl" | "wordfreq";

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
 * The neutral point on the percentile scale: the freqPct that would reproduce
 * the score a word with NO frequency data gets today. Derived rather than
 * written as 0.4667 so it cannot drift if the selection constants are tuned.
 */
const NEUTRAL_PCT = (SELECTION.freqUnknown - SELECTION.freqFloor) / SELECTION.freqSpan;

/**
 * Zipf → percentile, deliberately COMPRESSED into a band around the neutral point.
 *
 * Zipf (log10 occurrences per billion words) is the first genuinely absolute
 * frequency signal in this codebase; the rank-derived percentiles above it are
 * per-list and not comparable across lists. Writing raw Zipf percentiles into the
 * same column would therefore mix two scales — measured on the real data, a
 * straight conversion drops ~2,550 of the 2,813 unranked words from a selection
 * weight of 0.60 to ~0.27, while `mister` keeps the 0.9994 its 1,744-word list
 * handed it. That is a worse column, not a better one.
 *
 * So this tier claims only what it can honestly deliver: an ORDER among words that
 * currently all tie at the same neutral score. The band is centred on that neutral
 * point, so filling a word in barely moves how often it is chosen — it only breaks
 * the tie in the right direction.
 *
 * Anchors are fixed points on the general Zipf scale, not quantiles of whatever
 * batch is being filled, so re-running on a different set of words produces the
 * same number for the same word.
 *
 * Returns null for zipf <= 0, which is wordfreq's "no data" answer — an unknown
 * word keeps freqPct = null and is scored neutrally, exactly as before.
 */
export const ZIPF_MID = 4.0;
export const ZIPF_HALF_RANGE = 2.5;
export const ZIPF_BAND_HALF_SPAN = 0.28;

export function freqPctFromZipf(zipf: number | null | undefined): number | null {
  if (typeof zipf !== "number" || !Number.isFinite(zipf) || zipf <= 0) return null;
  const t = Math.min(1, Math.max(-1, (zipf - ZIPF_MID) / ZIPF_HALF_RANGE));
  const pct = NEUTRAL_PCT + ZIPF_BAND_HALF_SPAN * t;
  return Math.min(1, Math.max(0, pct));
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
