import { describe, expect, it } from "vitest";
import {
  ESTIMATOR_VERSION,
  REFERENCE_BAND_SIZE,
  estimatePlacement,
} from "./estimate";
import type { BlockResult } from "./ladder";

const b = (band: number, known: number, total = 5): BlockResult => ({ band, known, total });
const noTraps = { total: 4, known: 0 };

describe("guess correction", () => {
  it("leaves the hit rate alone when the learner never claimed a fake word", () => {
    const e = estimatePlacement({ blocks: [b(2, 4), b(3, 1)], traps: noTraps });
    expect(e.falseAlarmRate).toBe(0);
    expect(e.correctedRates.B1).toBeCloseTo(0.8, 6);
    expect(e.correctedRates.B2).toBeCloseTo(0.2, 6);
  });

  it("discounts the hit rate by the rate of claiming fake words", () => {
    // corrected = (hit - fa) / (1 - fa) = (0.8 - 0.5) / 0.5 = 0.6
    const e = estimatePlacement({ blocks: [b(2, 4), b(3, 1)], traps: { total: 4, known: 2 } });
    expect(e.falseAlarmRate).toBeCloseTo(0.5, 6);
    expect(e.correctedRates.B1).toBeCloseTo(0.6, 6);
  });

  it("floors the whole estimate when the learner claimed every fake word", () => {
    // A 100% false-alarm rate carries no information about vocabulary at all,
    // and the formula would divide by zero. This must be handled by the maths,
    // not by a special case bolted on elsewhere.
    const e = estimatePlacement({ blocks: [b(2, 5), b(3, 5)], traps: { total: 4, known: 4 } });
    expect(e.falseAlarmRate).toBe(1);
    expect(e.band).toBe(0);
    expect(e.vocabSizeEst).toBe(0);
    expect(Number.isFinite(e.band)).toBe(true);
  });

  it("never reports a negative corrected rate", () => {
    // Claiming fakes more often than real words is not negative knowledge.
    const e = estimatePlacement({ blocks: [b(2, 1)], traps: { total: 4, known: 3 } });
    expect(e.correctedRates.B1).toBe(0);
  });

  it("treats a run with no trap items as a zero false-alarm rate", () => {
    const e = estimatePlacement({ blocks: [b(2, 4)], traps: { total: 0, known: 0 } });
    expect(e.falseAlarmRate).toBe(0);
    expect(e.correctedRates.B1).toBeCloseTo(0.8, 6);
  });
});

describe("band interpolation", () => {
  it("lands between the two bands that bracket the halfway point", () => {
    // B1 0.8, B2 0.2 → crossing 0.5 is exactly halfway → 2.5
    const e = estimatePlacement({ blocks: [b(2, 4), b(3, 1)], traps: noTraps });
    expect(e.band).toBeCloseTo(2.5, 6);
  });

  it("is continuous, not a jump between whole bands", () => {
    // The point of a float band is that drift can move half a step.
    const a = estimatePlacement({ blocks: [b(2, 4), b(3, 1)], traps: noTraps }).band;
    const c = estimatePlacement({ blocks: [b(2, 5), b(3, 1)], traps: noTraps }).band;
    expect(a).not.toBe(c);
    expect(Number.isInteger(a) && Number.isInteger(c)).toBe(false);
  });

  it("reaches the top of the scale when every band was known", () => {
    const e = estimatePlacement({ blocks: [b(3, 5), b(4, 5)], traps: noTraps });
    expect(e.band).toBe(4);
  });

  it("reaches the bottom when nothing was known", () => {
    const e = estimatePlacement({ blocks: [b(1, 0), b(0, 0)], traps: noTraps });
    expect(e.band).toBe(0);
  });

  it("stays inside the scale", () => {
    for (const blocks of [
      [b(0, 5), b(1, 5), b(2, 5), b(3, 5), b(4, 5)],
      [b(0, 0)],
      [b(4, 0)],
      [b(9, 5)],
    ]) {
      const e = estimatePlacement({ blocks, traps: noTraps });
      expect(e.band).toBeGreaterThanOrEqual(0);
      expect(e.band).toBeLessThanOrEqual(4);
    }
  });

  it("merges repeated blocks at the same band instead of ignoring one", () => {
    const split = estimatePlacement({ blocks: [b(2, 2), b(2, 4)], traps: noTraps });
    const combined = estimatePlacement({ blocks: [b(2, 6, 10)], traps: noTraps });
    expect(split.correctedRates.B1).toBeCloseTo(combined.correctedRates.B1, 6);
  });
});

describe("vocabulary size estimate", () => {
  it("sums each band's corrected rate against a fixed reference size", () => {
    // Everything known at every tested band, and the assumption that lower
    // untested bands are known too → the full reference total.
    const e = estimatePlacement({ blocks: [b(4, 5)], traps: noTraps });
    const total = Object.values(REFERENCE_BAND_SIZE).reduce((a, c) => a + c, 0);
    expect(e.vocabSizeEst).toBe(total);
  });

  it("assumes a band below the lowest tested one is known at least as well", () => {
    // Someone who knows 80% of B2 words is not assumed to know 0% of A1.
    const e = estimatePlacement({ blocks: [b(3, 4)], traps: noTraps });
    expect(e.correctedRates.A1).toBeCloseTo(0.8, 6);
    expect(e.correctedRates.A2).toBeCloseTo(0.8, 6);
    expect(e.correctedRates.B1).toBeCloseTo(0.8, 6);
  });

  it("assumes a band above the highest tested one is not known", () => {
    const e = estimatePlacement({ blocks: [b(2, 4)], traps: noTraps });
    expect(e.correctedRates.B2).toBe(0);
    expect(e.correctedRates.C1).toBe(0);
  });

  it("is a whole number of words", () => {
    const e = estimatePlacement({ blocks: [b(2, 3), b(3, 1)], traps: { total: 4, known: 1 } });
    expect(Number.isInteger(e.vocabSizeEst)).toBe(true);
  });
});

describe("independence from the database", () => {
  // Spec criterion 7. If the estimate were computed from "you know 40% of the
  // B2 words IN THE DB", then importing 2,000 B2 words would silently change
  // every existing user's reported vocabulary and re-scale their stored band —
  // without them studying anything. The reference sizes are therefore external
  // constants, and this function takes no database input at all.
  it("depends only on the answers given", () => {
    const input = { blocks: [b(2, 4), b(3, 1)], traps: noTraps };
    expect(estimatePlacement(input)).toEqual(estimatePlacement(input));
  });

  it("uses reference band sizes that are plain constants", () => {
    expect(REFERENCE_BAND_SIZE).toEqual({ A1: 600, A2: 900, B1: 1500, B2: 2500, C1: 3500 });
  });

  it("accepts nothing but blocks and traps, so a word count cannot leak in", () => {
    // A second argument would be the obvious place for a DB handle to appear.
    expect(estimatePlacement.length).toBe(1);
  });

  it("stamps the estimator version so a later constant change is detectable", () => {
    // Changing REFERENCE_BAND_SIZE changes the scale for everyone; without a
    // version, an old stored estimate and a new one compare silently wrong.
    expect(estimatePlacement({ blocks: [b(2, 4)], traps: noTraps }).estimatorVersion).toBe(
      ESTIMATOR_VERSION
    );
  });
});

describe("degenerate input", () => {
  it("returns a floored estimate for no blocks at all", () => {
    const e = estimatePlacement({ blocks: [], traps: noTraps });
    expect(e.band).toBe(0);
    expect(e.vocabSizeEst).toBe(0);
  });

  it("ignores a block with no items rather than dividing by zero", () => {
    const e = estimatePlacement({ blocks: [b(2, 0, 0), b(3, 1)], traps: noTraps });
    expect(Number.isFinite(e.band)).toBe(true);
    expect(Number.isFinite(e.vocabSizeEst)).toBe(true);
  });
});
