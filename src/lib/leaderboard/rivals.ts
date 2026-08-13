// The ten rivals: a pure function of (userId, week). No DB rows, no cron, no
// stored state — see the spec's section 2 for why.

import { hashSeed, makeRng, rngFloat, rngInt, rngPick, rngShuffle } from "./rng";
import { weekIndex } from "./week";
import { PERSONA_NAMES, AVATAR_COLORS } from "./personas";
import {
  RIVAL_COUNT, PACE_FACTOR_MIN, PACE_FACTOR_MAX,
  WINDOW_STEP_MIN, WINDOW_STEP_MAX,
  REST_PROB_MIN, REST_PROB_MAX, REGULARITY_MIN, REGULARITY_MAX,
  WEEKEND_BIAS_MAX, FORM_TREND_MAX,
} from "./constants";

export type Rival = {
  /** Ổn định theo (user, tên) nên rival "cùng người" qua các tuần vẫn một id. */
  id: string;
  name: string;
  colorClass: string;
  paceFactor: number;   // 0.55 … 1.6
  peakHourVn: number;   // 0 … 23, giờ VN
  regularity: number;   // σ tương đối của XP ngày
  restProb: number;     // 0.05 … 0.45
  weekendBias: number;  // -0.45 … 0.45
  formTrend: number;    // -0.25 … 0.25, đổi theo tuần
};

// A permutation of the name pool that is fixed forever for this user, so the
// roster window can slide over it without ever consulting last week's roster
// (which would need recursion back through every past week).
function namePermutation(userId: string): string[] {
  return rngShuffle(makeRng(hashSeed("perm", userId)), PERSONA_NAMES);
}

// Window start for a given week. Step alternates 5/6 so consecutive weeks share
// 5 or 4 names — familiar faces, but not the same league forever. Closed form
// of the alternating walk: ceil(wIndex/2) even-indexed steps of MIN, the rest
// of MAX (carryover tests are the check that this matches the walk).
function windowStart(userId: string, wIndex: number): number {
  const stepRng = makeRng(hashSeed("step", userId));
  const start = rngInt(stepRng, 0, PERSONA_NAMES.length - 1);
  const evenSteps = Math.ceil(wIndex / 2);
  const oddSteps = Math.floor(wIndex / 2);
  const advance = evenSteps * WINDOW_STEP_MIN + oddSteps * WINDOW_STEP_MAX;
  return (start + advance) % PERSONA_NAMES.length;
}

// Personality is seeded from (userId, rival name) so a rival carried across
// weeks keeps their character; only formTrend varies by week.
function buildOne(userId: string, name: string, wIndex: number): Rival {
  const rng = makeRng(hashSeed("rival", userId, name));
  const paceFactor = rngFloat(rng, PACE_FACTOR_MIN, PACE_FACTOR_MAX);
  const regularity = rngFloat(rng, REGULARITY_MIN, REGULARITY_MAX);
  const restProb = rngFloat(rng, REST_PROB_MIN, REST_PROB_MAX);
  const weekendBias = rngFloat(rng, -WEEKEND_BIAS_MAX, WEEKEND_BIAS_MAX);
  const colorClass = rngPick(rng, AVATAR_COLORS);
  const peakHourVn = rngInt(rng, 0, 23);
  // No night-peak quota: at 02:00 VN a rival's "active X ago" stamp is
  // (26 − peakHourVn) hours old, so a small-hours peak reads STALE, not
  // freshly active — the VN offset plus the walk-back rule already keeps the
  // board plausible at 3am without singling out any hour range (ruling R9).
  // formTrend is the only week-varying trait: form comes and goes.
  const formRng = makeRng(hashSeed("form", userId, name, wIndex));
  const formTrend = rngFloat(formRng, -FORM_TREND_MAX, FORM_TREND_MAX);
  return {
    id: `r_${hashSeed(userId, name).toString(36)}`,
    name,
    colorClass,
    paceFactor,
    peakHourVn,
    regularity,
    restProb,
    weekendBias,
    formTrend,
  };
}

export function buildRivals(userId: string, now: Date): Rival[] {
  const wIndex = weekIndex(now);
  const perm = namePermutation(userId);
  const start = windowStart(userId, wIndex);
  const names = Array.from(
    { length: RIVAL_COUNT },
    (_, i) => perm[(start + i) % perm.length]
  );
  return names.map((n) => buildOne(userId, n, wIndex));
}
