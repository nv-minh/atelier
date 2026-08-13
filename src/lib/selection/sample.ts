import { SELECTION } from "./constants";

export type Slots = { probe: number; core: number; topic: number };

/**
 * Divide a new-card budget into three purposes.
 *
 *   probe — words BELOW the learner's band, to find gaps they think they know
 *   core  — on-band words scored WITHOUT any topic boost, so the vocabulary
 *           does not narrow to whichever field they picked
 *   topic — the rest, scored WITH the topic boost
 *
 * The probe slot is drawn by lottery when the exact share rounds to zero.
 * Rounding it up instead would turn a 3-card session into 33% probing; taking
 * the floor and never drawing it would mean short sessions never probe at all.
 * A Bernoulli draw keeps the long-run rate at the intended share either way.
 *
 * `rng` is injected so tests are deterministic.
 *
 * Postcondition: probe + core + topic === floor(max(0, budget)).
 */
export function splitSlots(budget: number, rng: () => number): Slots {
  const b = Math.max(0, Math.floor(budget));
  if (b === 0) return { probe: 0, core: 0, topic: 0 };

  const probeExact = SELECTION.probeShare * b;
  let probe = Math.floor(probeExact);
  if (probe === 0) probe = rng() < probeExact ? 1 : 0;
  probe = Math.min(probe, b);

  // Clamp against what probing already took, so topic can never go negative.
  const core = Math.min(Math.round(SELECTION.coreShare * b), b - probe);
  const topic = b - probe - core;
  return { probe, core, topic };
}

/** Unusable weights become 0 rather than poisoning the running total. */
function sanitize(w: number): number {
  return Number.isFinite(w) && w > 0 ? w : 0;
}

/**
 * Draw `k` distinct items, each item's chance proportional to its weight.
 *
 * Weighted sampling rather than "take the top k": argmax would hand every
 * learner at the same band with the same interests one identical list in one
 * identical order, which just swaps alphabetical determinism for another kind.
 * Sampling keeps high scorers likely without making them certain.
 *
 * When every weight is zero the draw falls back to uniform — a collapsed pool
 * must still produce cards rather than an empty session.
 *
 * Never mutates `items`. `rng` is injected so tests are deterministic.
 */
export function weightedSampleWithoutReplacement<T>(
  items: readonly T[],
  weight: (t: T) => number,
  k: number,
  rng: () => number
): T[] {
  const want = Math.min(Math.floor(k), items.length);
  if (want <= 0) return [];

  const pool = items.slice();
  const out: T[] = [];

  for (let n = 0; n < want; n++) {
    const weights = pool.map((p) => sanitize(weight(p)));
    const total = weights.reduce((a, b) => a + b, 0);

    let idx: number;
    if (total <= 0) {
      idx = Math.min(pool.length - 1, Math.floor(rng() * pool.length));
    } else {
      let r = rng() * total;
      // Default to the last index: floating-point drift can leave `r` a hair
      // above the accumulated total, and falling through must still pick.
      idx = pool.length - 1;
      for (let i = 0; i < pool.length; i++) {
        r -= weights[i];
        if (r <= 0) {
          idx = i;
          break;
        }
      }
    }

    out.push(pool[idx]);
    pool.splice(idx, 1);
  }

  return out;
}
