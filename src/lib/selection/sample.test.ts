import { describe, expect, it } from "vitest";
import { splitSlots, weightedSampleWithoutReplacement } from "./sample";

/** Deterministic PRNG (mulberry32) so every assertion below is reproducible. */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const always = (v: number) => () => v;

describe("splitSlots", () => {
  it("splits a full budget of 20 into 1 probe / 5 core / 14 topic", () => {
    expect(splitSlots(20, always(0.99))).toEqual({ probe: 1, core: 5, topic: 14 });
  });

  it("always accounts for every slot in the budget", () => {
    for (let b = 0; b <= 40; b++) {
      for (const r of [0, 0.5, 0.999]) {
        const s = splitSlots(b, always(r));
        expect(s.probe + s.core + s.topic, `budget ${b} rng ${r}`).toBe(b);
        expect(s.probe, `budget ${b}`).toBeGreaterThanOrEqual(0);
        expect(s.core, `budget ${b}`).toBeGreaterThanOrEqual(0);
        expect(s.topic, `budget ${b}`).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("draws the probe slot by lottery on a small budget instead of rounding it up", () => {
    // A budget of 3 must not spend a third of the session probing below band.
    // floor(0.05 * 3) = 0, so the slot is a Bernoulli(0.15) draw.
    expect(splitSlots(3, always(0.01)).probe).toBe(1); // under 0.15 → wins
    expect(splitSlots(3, always(0.99)).probe).toBe(0); // over 0.15 → loses
  });

  it("keeps the small-budget probe rate near its share, nowhere near a third", () => {
    const rng = seeded(7);
    let probes = 0;
    const N = 4000;
    for (let i = 0; i < N; i++) probes += splitSlots(3, rng).probe;
    const rate = probes / N;
    expect(rate).toBeGreaterThan(0.10);
    expect(rate).toBeLessThan(0.20);
  });

  it("never spends the whole budget on probing", () => {
    for (const b of [1, 2, 3]) {
      expect(splitSlots(b, always(0)).probe).toBeLessThanOrEqual(1);
    }
  });

  it("returns nothing to do for an empty or negative budget", () => {
    expect(splitSlots(0, always(0))).toEqual({ probe: 0, core: 0, topic: 0 });
    expect(splitSlots(-5, always(0))).toEqual({ probe: 0, core: 0, topic: 0 });
  });

  it("keeps a core quota on any budget that can afford one", () => {
    // The core slot is what stops a learner's vocabulary narrowing to one field.
    expect(splitSlots(20, always(0.99)).core).toBeGreaterThan(0);
    expect(splitSlots(10, always(0.99)).core).toBeGreaterThan(0);
    expect(splitSlots(3, always(0.99)).core).toBeGreaterThan(0);
  });
});

describe("weightedSampleWithoutReplacement", () => {
  const w = (x: { weight: number }) => x.weight;
  const items = [
    { id: "a", weight: 1 },
    { id: "b", weight: 1 },
    { id: "c", weight: 1 },
    { id: "d", weight: 1 },
  ];

  it("returns exactly k items with no repeats", () => {
    const picked = weightedSampleWithoutReplacement(items, w, 3, seeded(1));
    expect(picked).toHaveLength(3);
    expect(new Set(picked.map((p) => p.id)).size).toBe(3);
  });

  it("is deterministic for a given seed", () => {
    const a = weightedSampleWithoutReplacement(items, w, 3, seeded(42)).map((x) => x.id);
    const b = weightedSampleWithoutReplacement(items, w, 3, seeded(42)).map((x) => x.id);
    expect(a).toEqual(b);
  });

  it("produces different orders for different seeds, so users do not all get one list", () => {
    // Argmax would hand every learner at the same band the same words in the
    // same order — swapping alphabetical determinism for a different determinism.
    const seen = new Set<string>();
    for (let s = 1; s <= 40; s++) {
      seen.add(weightedSampleWithoutReplacement(items, w, 4, seeded(s)).map((x) => x.id).join(","));
    }
    expect(seen.size).toBeGreaterThan(1);
  });

  it("returns every item when k meets or exceeds the pool size", () => {
    expect(weightedSampleWithoutReplacement(items, w, 4, seeded(3))).toHaveLength(4);
    expect(weightedSampleWithoutReplacement(items, w, 99, seeded(3))).toHaveLength(4);
  });

  it("returns nothing for a non-positive k or an empty pool", () => {
    expect(weightedSampleWithoutReplacement(items, w, 0, seeded(1))).toEqual([]);
    expect(weightedSampleWithoutReplacement(items, w, -2, seeded(1))).toEqual([]);
    expect(weightedSampleWithoutReplacement([], w, 3, seeded(1))).toEqual([]);
  });

  it("favours heavier items over many draws", () => {
    const pool = [
      { id: "heavy", weight: 100 },
      { id: "light", weight: 1 },
    ];
    const rng = seeded(11);
    let heavyFirst = 0;
    const N = 2000;
    for (let i = 0; i < N; i++) {
      if (weightedSampleWithoutReplacement(pool, w, 1, rng)[0].id === "heavy") heavyFirst++;
    }
    expect(heavyFirst / N).toBeGreaterThan(0.9);
  });

  it("still returns items when every weight is zero", () => {
    // A pool can go all-zero if scoring ever collapses; the learner must still
    // get cards rather than an empty session.
    const zero = [
      { id: "a", weight: 0 },
      { id: "b", weight: 0 },
    ];
    const picked = weightedSampleWithoutReplacement(zero, w, 2, seeded(5));
    expect(picked).toHaveLength(2);
    expect(new Set(picked.map((p) => p.id)).size).toBe(2);
  });

  it("does not pick an item whose weight is negative or NaN over a valid one", () => {
    const pool = [
      { id: "bad", weight: Number.NaN },
      { id: "worse", weight: -5 },
      { id: "good", weight: 10 },
    ];
    expect(weightedSampleWithoutReplacement(pool, w, 1, seeded(2))[0].id).toBe("good");
  });

  it("leaves the caller's array untouched", () => {
    const before = items.map((i) => i.id);
    weightedSampleWithoutReplacement(items, w, 2, seeded(9));
    expect(items.map((i) => i.id)).toEqual(before);
  });
});
