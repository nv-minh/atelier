import { CEFR_LEVELS } from "../export-format";

/** Real (non-trap) items per block. */
export const BLOCK_SIZE = 5;
/** Hard ceiling on real items, so the test always ends inside ~90 seconds. */
export const MAX_REAL_ITEMS = 35;
/**
 * The estimator interpolates between a band the learner mostly knew and one they
 * mostly did not. One band of data cannot be interpolated, so a run never stops
 * before this many blocks across at least two distinct bands — even when a stop
 * condition has already fired.
 */
export const MIN_BLOCKS = 3;

const TOP = CEFR_LEVELS.length - 1;
const clampBand = (n: number) => Math.min(TOP, Math.max(0, Math.round(n)));

export type BlockResult = { band: number; known: number; total: number };

export type LadderStep = { done: false; band: number } | { done: true };

/**
 * What a finished block says about the learner: they are above this band, below
 * it, or sitting right on the boundary.
 *
 * Expressed as rates rather than counts so a block of a different size (a short
 * final block, say) still classifies correctly.
 */
function outcome(b: BlockResult): "up" | "down" | "pin" {
  const rate = b.total > 0 ? b.known / b.total : 0;
  if (rate >= 0.8) return "up";
  if (rate <= 0.4) return "down";
  return "pin";
}

/**
 * Nearest band not yet measured, preferring upward.
 *
 * Upward first because a `pin` block scored just ABOVE the 0.5 crossing, so the
 * band that completes the bracket is the harder one above it.
 */
function nearestUntested(tested: Set<number>, from: number): number | null {
  for (let d = 1; d <= TOP + 1; d++) {
    for (const cand of [from + d, from - d]) {
      const b = clampBand(cand);
      if (b === clampBand(from) && d > 0 && tested.has(b)) continue;
      if (!tested.has(b)) return b;
    }
  }
  return null;
}

/**
 * Decide the next band to test, or that the test is over.
 *
 * Pure and stateless: it takes the blocks completed so far and derives
 * everything, so the caller can persist a draft, reload, and resume without
 * carrying a machine state around. Trap items are deliberately NOT part of
 * `blocks` — they measure guessing, not level, and counting them would move the
 * learner's band for saying yes to a word that does not exist.
 *
 * Stops when the level is bracketed (the direction reversed, or a block landed
 * exactly on the boundary), when the scale runs out, or when the item budget is
 * spent — but never before MIN_BLOCKS blocks across two distinct bands.
 */
export function nextLadderStep(blocks: readonly BlockResult[]): LadderStep {
  // Start in the middle: it minimises the worst-case distance to either edge.
  if (!blocks.length) return { done: false, band: clampBand(Math.floor(TOP / 2)) };

  const asked = blocks.reduce((n, b) => n + b.total, 0);
  if (asked + BLOCK_SIZE > MAX_REAL_ITEMS) return { done: true };

  const tested = new Set(blocks.map((b) => clampBand(b.band)));
  const last = blocks[blocks.length - 1];
  const dir = outcome(last);

  // A reversal means the boundary has been crossed and is now bracketed.
  const moves = blocks.map(outcome).filter((d) => d !== "pin");
  const reversed = moves.some((d, i) => i > 0 && d !== moves[i - 1]);
  const atEdge =
    (dir === "up" && clampBand(last.band) >= TOP) || (dir === "down" && clampBand(last.band) <= 0);

  const haveEnough = blocks.length >= MIN_BLOCKS && tested.size >= 2;
  if ((dir === "pin" || reversed || atEdge) && haveEnough) return { done: true };

  // Either the level is not bracketed yet, or it is but there is not enough data
  // to interpolate. Both cases want another band — one that has not been asked.
  const stepped = dir === "up" ? last.band + 1 : dir === "down" ? last.band - 1 : last.band;
  const candidate = clampBand(stepped);
  const next = tested.has(candidate) ? nearestUntested(tested, last.band) : candidate;

  // Every band measured and still no bracket: nothing further to learn.
  if (next === null) return { done: true };
  return { done: false, band: next };
}
