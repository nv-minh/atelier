import { CEFR_LEVELS } from "../export-format";

/**
 * OFFSETS around the learner's target, not absolute band positions:
 * `{ lo: -1, hi: 1 }` means "one level either side of target". Absolute values
 * would have to be recomputed per learner, and mixing the two conventions is an
 * easy, silent bug — hence the naming below.
 */
export type BandWindow = { lo: number; hi: number };

export type WidenPlan = {
  attempt: number;
  /** Offsets around the learner's target, or null for "no band constraint". */
  bandWindow: BandWindow | null;
  useTopicBoost: boolean;
  requireBandWindow: boolean;
};

/**
 * The escalation ladder, most specific first. Each step relaxes exactly one
 * thing, so a learner only loses the constraint that was actually blocking.
 *
 * Band before topic is deliberate: someone who chose `medical` would rather
 * study a B2 medical word than a C1 word from a field they did not ask for.
 *
 * This is not defensive programming for a hypothetical — the (C1 x daily-life)
 * cell is empty today, because that pack ships no C1 words at all.
 */
const LADDER: readonly Omit<WidenPlan, "attempt">[] = [
  { bandWindow: { lo: -1, hi: 1 }, useTopicBoost: true, requireBandWindow: true },
  { bandWindow: { lo: -1.5, hi: 1.5 }, useTopicBoost: true, requireBandWindow: true },
  { bandWindow: { lo: -1.5, hi: 1.5 }, useTopicBoost: false, requireBandWindow: true },
  // Last resort: order by frequency across the whole vocabulary. Always returns
  // something as long as the learner has words left to see.
  { bandWindow: null, useTopicBoost: false, requireBandWindow: false },
];

export const MAX_WIDEN_ATTEMPTS = LADDER.length;

/** Clamped at both ends, so a caller's loop counter can never fall off. */
export function widenPlan(attempt: number): WidenPlan {
  const i = Math.min(MAX_WIDEN_ATTEMPTS - 1, Math.max(0, Math.floor(attempt) || 0));
  return { attempt: i, ...LADDER[i] };
}

/**
 * Turn a continuous band window into the discrete CEFR labels to query.
 *
 * `band` is a float but `Word.cefr` is one of five strings, so the window has to
 * collapse onto level indices. Rounding (not floor/ceil) keeps the window
 * centred on the learner instead of biasing it downward.
 *
 * ALWAYS returns at least one level. An empty list would become
 * `cefr: { in: [] }`, which matches no rows — the widen path would then make the
 * pool emptier as it tried to make it bigger.
 */
export function bandWindowToLevels(offsets: BandWindow | null, target: number): string[] {
  const all = CEFR_LEVELS as readonly string[];
  if (!offsets) return [...all];

  const last = all.length - 1;
  const clamp = (n: number) => Math.min(last, Math.max(0, n));
  const lo = clamp(Math.round(target + offsets.lo));
  const hi = clamp(Math.round(target + offsets.hi));

  // Inverted or collapsed window: fall back to the learner's own level rather
  // than returning nothing.
  if (hi < lo) return [all[clamp(Math.round(target))]];

  return all.slice(lo, hi + 1);
}
