import { CEFR_LEVELS } from "../export-format";
import { todayStr } from "../utils";

/**
 * Every threshold the band-drift rule depends on. Starting points, not measured
 * values — see selection/constants.ts for the same reasoning.
 */
export const DRIFT = {
  /**
   * Below this many usable reviews, do nothing. Without the gate, the first
   * handful of reviews in a session jerk the band around, and a learner having
   * one bad morning gets demoted.
   */
  minReviews: 30,
  /** Most the band may move in one run. Drift is a nudge, not a re-test. */
  maxStep: 0.25,
  againShareDown: 0.35,
  easyShareUp: 0.45,
  /** Easy on a card that has lapsed this often is relearning, not headroom. */
  maxLapsesForUp: 2,
  /** How much harder a failed below-band card counts than a failed on-band one. */
  probeWeight: 2,
  /** Reviews further than this from the target band are ignored entirely. */
  nearBand: 1,
};

export type DriftReview = {
  /** Band of the reviewed word, A1=0 … C1=4. */
  cefrIndex: number;
  /** FSRS rating: 1=Again, 2=Hard, 3=Good, 4=Easy. */
  rating: number;
  lapses: number;
};

export type DriftResult = {
  delta: number;
  /** Why the result is what it is — a silent 0 is otherwise undebuggable. */
  reason: string;
  /** Share of the sample that was below-band probe material. */
  probeShare: number;
};

const TOP = CEFR_LEVELS.length - 1;

/**
 * Nudge a learner's band from how their reviews are actually going.
 *
 * Pure: takes the reviews, the current band, when drift last ran, and the
 * current time. The caller does the joining and the writing.
 *
 * The signal is deliberately conservative. A band that moves easily is worse
 * than one that moves late: selection, the probe slot and the widen ladder all
 * read it, so noise here shows up as a session of wrong-level words.
 *
 * Reviews of words FAR from the band are dropped rather than counted. Failing C1
 * words as a B1 learner is expected and says nothing about whether B1 is the
 * right home band — counting it would demote people for stretching.
 *
 * A failed card BELOW the band counts double: that card was handed out on the
 * assumption they already knew everything down there, so failing it is direct
 * evidence the assumption was wrong. Probe status is inferred from band distance,
 * so nothing has to be recorded when the card is dealt.
 */
export function computeDrift(input: {
  reviews: readonly DriftReview[];
  band: number;
  driftedAt: Date | null;
  now: Date;
}): DriftResult {
  const band = Math.min(TOP, Math.max(0, input.band));

  // At most once a day, on the same UTC day boundary the rest of the app uses.
  // A future stamp is ignored rather than trusted — clock skew must not freeze a
  // band forever.
  if (input.driftedAt && input.driftedAt.getTime() <= input.now.getTime()) {
    if (todayStr(input.driftedAt) === todayStr(input.now)) {
      return { delta: 0, reason: "already-drifted-today", probeShare: 0 };
    }
  }

  const isProbe = (r: DriftReview) => r.cefrIndex < band - DRIFT.nearBand;
  // Anything within nearBand of the band, plus probes from below at any distance.
  const usable = input.reviews.filter(
    (r) => Math.abs(r.cefrIndex - band) <= DRIFT.nearBand || isProbe(r)
  );

  if (usable.length < DRIFT.minReviews) {
    return { delta: 0, reason: "too-few-reviews", probeShare: 0 };
  }

  const probes = usable.filter(isProbe);
  const probeShare = probes.length / usable.length;

  // Weighted failure share: a probe failure is worth probeWeight ordinary ones,
  // on both sides of the ratio so the result stays a share in [0, 1].
  let failWeight = 0;
  let totalWeight = 0;
  let easy = 0;
  let easyWithLapses = 0;
  for (const r of usable) {
    const w = isProbe(r) ? DRIFT.probeWeight : 1;
    totalWeight += w;
    if (r.rating === 1) failWeight += w;
    if (r.rating === 4) {
      easy++;
      if (r.lapses > DRIFT.maxLapsesForUp) easyWithLapses++;
    }
  }

  const againShare = totalWeight > 0 ? failWeight / totalWeight : 0;
  const easyShare = easy / usable.length;

  if (againShare > DRIFT.againShareDown) {
    // Scale within the clamp by how far past the threshold it is, so a learner
    // who is badly misplaced moves the full step and a marginal one moves less.
    const over = (againShare - DRIFT.againShareDown) / (1 - DRIFT.againShareDown);
    const delta = -Math.min(DRIFT.maxStep, DRIFT.maxStep * Math.max(0.2, over));
    return { delta: clampToScale(band, delta), reason: "failing-at-band", probeShare };
  }

  if (easyShare >= DRIFT.easyShareUp) {
    // Easy answers on cards with a lapse history are relearning, not headroom.
    if (easyWithLapses > easy / 2) {
      return { delta: 0, reason: "easy-but-lapsing", probeShare };
    }
    const over = (easyShare - DRIFT.easyShareUp) / (1 - DRIFT.easyShareUp);
    const delta = Math.min(DRIFT.maxStep, DRIFT.maxStep * Math.max(0.2, over));
    return { delta: clampToScale(band, delta), reason: "easy-at-band", probeShare };
  }

  return { delta: 0, reason: "steady", probeShare };
}

/** Never let a nudge push the stored band off either end of the scale. */
function clampToScale(band: number, delta: number): number {
  const next = Math.min(TOP, Math.max(0, band + delta));
  return next - band;
}
