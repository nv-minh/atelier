import { describe, expect, it } from "vitest";
import { stratifyByTercile } from "./stratify";

/** Rows arrive already ordered by freqPct desc, nulls last. */
const rows = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `w${i}`, rank: i }));

describe("stratifyByTercile", () => {
  it("draws from all three frequency thirds, not just the top", () => {
    // Without stratification a B2 block could be entirely high-frequency words,
    // the learner passes a band that is really too hard for them, and their
    // measured level comes out inflated.
    const picked = stratifyByTercile(rows(30), 3, () => 0);
    const positions = picked.map((p) => p.rank);
    expect(positions.some((p) => p < 10)).toBe(true);
    expect(positions.some((p) => p >= 10 && p < 20)).toBe(true);
    expect(positions.some((p) => p >= 20)).toBe(true);
  });

  it("returns the requested count", () => {
    expect(stratifyByTercile(rows(30), 9, () => 0)).toHaveLength(9);
    expect(stratifyByTercile(rows(30), 3, () => 0)).toHaveLength(3);
  });

  it("spreads the count evenly across the thirds", () => {
    const picked = stratifyByTercile(rows(30), 9, () => 0);
    const perThird = [0, 0, 0];
    for (const p of picked) perThird[Math.min(2, Math.floor(p.rank / 10))]++;
    expect(perThird).toEqual([3, 3, 3]);
  });

  it("never repeats an item", () => {
    const picked = stratifyByTercile(rows(30), 12, () => 0.5);
    expect(new Set(picked.map((p) => p.id)).size).toBe(picked.length);
  });

  it("returns everything it has when asked for more than exists", () => {
    expect(stratifyByTercile(rows(4), 10, () => 0)).toHaveLength(4);
  });

  it("handles a pool smaller than three without dropping items", () => {
    expect(stratifyByTercile(rows(2), 2, () => 0)).toHaveLength(2);
    expect(stratifyByTercile(rows(1), 1, () => 0)).toHaveLength(1);
  });

  it("returns nothing for an empty pool or a non-positive count", () => {
    expect(stratifyByTercile([], 5, () => 0)).toEqual([]);
    expect(stratifyByTercile(rows(30), 0, () => 0)).toEqual([]);
    expect(stratifyByTercile(rows(30), -3, () => 0)).toEqual([]);
  });

  it("varies which items it picks as the rng varies", () => {
    // Two learners must not get an identical item bank, or the test becomes a
    // fixed quiz that can be shared and memorised.
    const a = stratifyByTercile(rows(30), 6, () => 0).map((p) => p.id).join();
    const b = stratifyByTercile(rows(30), 6, () => 0.99).map((p) => p.id).join();
    expect(a).not.toBe(b);
  });
});
