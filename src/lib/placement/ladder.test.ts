import { describe, expect, it } from "vitest";
import { BLOCK_SIZE, MAX_REAL_ITEMS, type BlockResult, nextLadderStep } from "./ladder";

/** A completed block: `known` correct out of BLOCK_SIZE at `band`. */
const block = (band: number, known: number): BlockResult => ({ band, known, total: BLOCK_SIZE });

const pass = (band: number) => block(band, 4); // >= 4/5 → move up
const fail = (band: number) => block(band, 2); // <= 2/5 → move down
const pin = (band: number) => block(band, 3); // exactly 3/5 → boundary found

describe("where the ladder starts", () => {
  it("starts at B1, the middle of the scale", () => {
    // Middle start minimises the worst-case number of blocks to any edge.
    expect(nextLadderStep([])).toEqual({ done: false, band: 2 });
  });
});

describe("climbing and descending", () => {
  it("moves up a band after a passed block", () => {
    expect(nextLadderStep([pass(2)])).toEqual({ done: false, band: 3 });
  });

  it("moves down a band after a failed block", () => {
    expect(nextLadderStep([fail(2)])).toEqual({ done: false, band: 1 });
  });

  it("keeps climbing while blocks keep passing", () => {
    expect(nextLadderStep([pass(2), pass(3)])).toEqual({ done: false, band: 4 });
  });

  it("keeps descending while blocks keep failing", () => {
    expect(nextLadderStep([fail(2), fail(1)])).toEqual({ done: false, band: 0 });
  });
});

describe("stopping", () => {
  it("stops once the direction reverses, which brackets the level", () => {
    // Passed B1 then failed B2: the boundary is between them, nothing left to learn.
    const step = nextLadderStep([pass(2), fail(3), pass(2)]);
    expect(step.done).toBe(true);
  });

  it("stops at the top of the scale instead of asking for a sixth band", () => {
    const step = nextLadderStep([pass(2), pass(3), pass(4)]);
    expect(step.done).toBe(true);
  });

  it("stops at the bottom of the scale instead of going below A1", () => {
    const step = nextLadderStep([fail(2), fail(1), fail(0)]);
    expect(step.done).toBe(true);
  });

  it("stops on an exact 3/5 once it has enough data to interpolate", () => {
    const step = nextLadderStep([pass(2), pass(3), pin(4)]);
    expect(step.done).toBe(true);
  });

  it("never exceeds the item ceiling", () => {
    // 35 real items at 5 per block = 7 blocks maximum, whatever the path.
    const blocks: BlockResult[] = [];
    for (let i = 0; i < 20; i++) {
      const step = nextLadderStep(blocks);
      if (step.done) break;
      // Alternate so no other stop condition fires first.
      blocks.push(block(step.band, i % 2 === 0 ? 4 : 2));
    }
    const asked = blocks.reduce((n, b) => n + b.total, 0);
    expect(asked).toBeLessThanOrEqual(MAX_REAL_ITEMS);
  });

  it("terminates from every reachable path", () => {
    // Exhaustive: every combination of outcomes must reach done within the cap.
    const walk = (blocks: BlockResult[], depth: number) => {
      const step = nextLadderStep(blocks);
      if (step.done) return;
      expect(depth, `path ${blocks.map((b) => `${b.band}:${b.known}`).join(">")}`).toBeLessThan(10);
      for (const known of [0, 2, 3, 4, 5]) {
        walk([...blocks, block(step.band, known)], depth + 1);
      }
    };
    walk([], 0);
  });
});

describe("the three-block floor", () => {
  it("does not stop on a first-block 3/5, which would leave only one band measured", () => {
    // The estimator interpolates between two bands. One band of data means it
    // cannot, so the run continues even though a stop condition fired.
    expect(nextLadderStep([pin(2)]).done).toBe(false);
  });

  it("probes a neighbouring band when a stop fires too early", () => {
    const step = nextLadderStep([pin(2)]);
    expect(step.done).toBe(false);
    if (!step.done) expect(step.band).not.toBe(2);
  });

  it("does not stop on a two-block reversal either", () => {
    expect(nextLadderStep([pass(2), fail(3)]).done).toBe(false);
  });

  it("always ends with at least two distinct bands measured", () => {
    const walk = (blocks: BlockResult[]) => {
      const step = nextLadderStep(blocks);
      if (step.done) {
        const bands = new Set(blocks.map((b) => b.band));
        expect(bands.size, `path ${blocks.map((b) => `${b.band}:${b.known}`).join(">")}`).toBeGreaterThanOrEqual(2);
        expect(blocks.length).toBeGreaterThanOrEqual(3);
        return;
      }
      for (const known of [0, 3, 5]) walk([...blocks, block(step.band, known)]);
    };
    walk([]);
  });

  it("never re-asks a band it already measured", () => {
    const walk = (blocks: BlockResult[]) => {
      const step = nextLadderStep(blocks);
      if (step.done) return;
      expect(
        blocks.some((b) => b.band === step.band),
        `band ${step.band} repeated after ${blocks.map((b) => b.band).join(">")}`
      ).toBe(false);
      for (const known of [0, 3, 5]) walk([...blocks, block(step.band, known)]);
    };
    walk([]);
  });
});

describe("guarding against bad input", () => {
  it("clamps a band outside the scale rather than proposing a sixth level", () => {
    const step = nextLadderStep([pass(9)]);
    if (!step.done) expect(step.band).toBeLessThanOrEqual(4);
  });

  it("handles a block with a different size than the default", () => {
    const step = nextLadderStep([{ band: 2, known: 8, total: 10 }]);
    // 8/10 is a pass, so it should climb.
    if (!step.done) expect(step.band).toBe(3);
  });
});
