import { CEFR_LEVELS } from "../export-format";
import type { BlockResult } from "./ladder";

/**
 * Bump whenever REFERENCE_BAND_SIZE (or the correction maths) changes. Those
 * constants define the scale, so an estimate produced before a change and one
 * produced after are not the same measurement — comparing them without noticing
 * the version would be silently wrong.
 */
export const ESTIMATOR_VERSION = 1;

/**
 * Roughly how many words each CEFR band contains, in the language at large.
 *
 * These are order-of-magnitude estimates chosen at design time, NOT published
 * figures — good enough to show a learner "~4,200 words" and let them watch it
 * grow, not good enough to cite.
 *
 * Critically they are EXTERNAL constants rather than counts from the `Word`
 * table. Deriving them from the DB would mean every vocabulary import silently
 * re-scaled every existing user's estimate and changed what their stored band
 * meant, without them studying a thing.
 */
export const REFERENCE_BAND_SIZE: Record<string, number> = {
  A1: 600,
  A2: 900,
  B1: 1500,
  B2: 2500,
  C1: 3500,
};

export type PlacementInput = {
  blocks: readonly BlockResult[];
  /** Pseudoword items. Answering "known" to these measures guessing. */
  traps: { total: number; known: number };
};

export type PlacementEstimate = {
  /** Continuous position on the CEFR scale, A1=0 … C1=4. */
  band: number;
  vocabSizeEst: number;
  falseAlarmRate: number;
  /** Corrected rate per CEFR label, including bands never tested. */
  correctedRates: Record<string, number>;
  estimatorVersion: number;
};

const TOP = CEFR_LEVELS.length - 1;
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/**
 * Estimate a learner's level from a yes/no vocabulary check.
 *
 * Uses the standard guessing correction from vocabulary testing:
 *
 *     corrected = (hit_rate - false_alarm_rate) / (1 - false_alarm_rate)
 *
 * where the false-alarm rate is how often they claimed a word that does not
 * exist. Someone who says yes to everything scores a false-alarm rate of 1, and
 * the formula collapses their estimate to the floor by itself — no special case
 * needed, and no way to game the test by claiming everything.
 *
 * Takes NOTHING but the answers. See the note on REFERENCE_BAND_SIZE.
 */
export function estimatePlacement(input: PlacementInput): PlacementEstimate {
  const trapsTotal = Math.max(0, input.traps.total);
  const falseAlarmRate = trapsTotal > 0 ? clamp01(input.traps.known / trapsTotal) : 0;

  // Claiming every fake word says nothing about vocabulary, and would divide by
  // zero below. The floor is the honest answer.
  if (falseAlarmRate >= 1) {
    return {
      band: 0,
      vocabSizeEst: 0,
      falseAlarmRate: 1,
      correctedRates: Object.fromEntries(CEFR_LEVELS.map((l) => [l, 0])),
      estimatorVersion: ESTIMATOR_VERSION,
    };
  }

  // Merge blocks by band: the ladder can measure one band across two blocks,
  // and treating them separately would throw one away.
  const perBand = new Map<number, { known: number; total: number }>();
  for (const blk of input.blocks) {
    if (blk.total <= 0) continue;
    const band = Math.min(TOP, Math.max(0, Math.round(blk.band)));
    const acc = perBand.get(band) ?? { known: 0, total: 0 };
    acc.known += blk.known;
    acc.total += blk.total;
    perBand.set(band, acc);
  }

  const correct = (hit: number) => clamp01((hit - falseAlarmRate) / (1 - falseAlarmRate));

  const tested = [...perBand.keys()].sort((a, b) => a - b);
  if (!tested.length) {
    return {
      band: 0,
      vocabSizeEst: 0,
      falseAlarmRate,
      correctedRates: Object.fromEntries(CEFR_LEVELS.map((l) => [l, 0])),
      estimatorVersion: ESTIMATOR_VERSION,
    };
  }

  const lowestTested = tested[0];
  const highestTested = tested[tested.length - 1];

  // An adaptive ladder always skips bands, so every untested band needs a rule.
  // Below the tested range: assume monotonicity — knowing 80% of B2 does not
  // imply knowing 0% of A1. Above it: assume not known, which is what failing
  // to reach that band suggests.
  const rateAt = (band: number): number => {
    const hit = perBand.get(band);
    if (hit) return correct(hit.known / hit.total);
    if (band < lowestTested) return correct(perBand.get(lowestTested)!.known / perBand.get(lowestTested)!.total);
    return 0;
  };

  const correctedRates: Record<string, number> = {};
  let vocab = 0;
  for (let i = 0; i <= TOP; i++) {
    const label = CEFR_LEVELS[i];
    const r = rateAt(i);
    correctedRates[label] = r;
    vocab += r * (REFERENCE_BAND_SIZE[label] ?? 0);
  }

  // Band = where the corrected rate crosses 0.5, interpolated linearly between
  // the two bands that bracket it. Interpolation (rather than "the last band
  // they passed") is what makes the band a float, so drift can nudge it half a
  // step instead of jumping a whole one.
  let band = 0;
  const first = rateAt(lowestTested);
  if (first < 0.5) {
    // Even the easiest band tested is below half — floor, nothing to bracket.
    band = 0;
  } else {
    band = highestTested;
    for (let i = lowestTested; i < TOP; i++) {
      const hi = rateAt(i);
      const lo = rateAt(i + 1);
      if (hi >= 0.5 && lo < 0.5) {
        const span = hi - lo;
        band = span > 0 ? i + (hi - 0.5) / span : i;
        break;
      }
    }
  }

  return {
    band: Math.min(TOP, Math.max(0, band)),
    vocabSizeEst: Math.round(vocab),
    falseAlarmRate,
    correctedRates,
    estimatorVersion: ESTIMATOR_VERSION,
  };
}

// Band is a float on the A1=0 … C1=4 scale. Four places in the app used to
// inline CEFR_LEVELS[clamp(round(band))]; centralized here so a fifth place
// (the vocab vault) doesn't copy it again.
export function bandToCefr(band: number): string {
  const i = Number.isFinite(band) ? Math.round(band) : 0;
  return CEFR_LEVELS[Math.min(CEFR_LEVELS.length - 1, Math.max(0, i))];
}
