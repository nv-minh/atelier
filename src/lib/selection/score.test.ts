import { describe, expect, it } from "vitest";
import { SELECTION } from "./constants";
import { type Candidate, scoreCandidate } from "./score";

// A1=0 … C1=4 on the continuous band scale.
const A1 = 0;
const C1 = 4;

function candidate(over: Partial<Candidate> = {}): Candidate {
  return { id: "w1", cefr: "B1", freqPct: null, topics: [], known: false, ...over };
}

const ctx = (over: Partial<Parameters<typeof scoreCandidate>[1]> = {}) => ({
  band: 2,
  topics: [] as string[],
  useTopicBoost: true,
  ...over,
});

describe("bandFit", () => {
  it("scores an A1 word essentially zero for a C1 learner", () => {
    // This is the whole point of the feature: `hello` must not reach a C1 user.
    const score = scoreCandidate(candidate({ cefr: "A1" }), ctx({ band: C1 }));
    expect(score).toBeLessThan(1e-4);
    // Small, but never zero — zero is removal, and removal is unrecoverable.
    expect(score).toBeGreaterThan(0);
  });

  it("scores an A1 word far higher than a C1 word for an A1 learner", () => {
    const a1 = scoreCandidate(candidate({ cefr: "A1" }), ctx({ band: A1 }));
    const c1 = scoreCandidate(candidate({ cefr: "C1" }), ctx({ band: A1 }));
    expect(a1).toBeGreaterThan(c1 * 100);
  });

  it("leans upward: the band above the learner beats the band below", () => {
    // The skew shifts the peak to band + 0.3, which does NOT make B2 outscore
    // B1 for a B1 learner (0.68 vs 0.93) — the learner's own band still wins.
    // What it does is break the symmetry, so stretching up is preferred to
    // falling back. That asymmetry is the assertion worth pinning.
    const below = scoreCandidate(candidate({ cefr: "A2" }), ctx({ band: 2 }));
    const atBand = scoreCandidate(candidate({ cefr: "B1" }), ctx({ band: 2 }));
    const above = scoreCandidate(candidate({ cefr: "B2" }), ctx({ band: 2 }));
    expect(atBand).toBeGreaterThan(above);
    expect(above).toBeGreaterThan(below);
  });

  it("treats an unknown CEFR value as no band information rather than crashing", () => {
    const score = scoreCandidate(candidate({ cefr: "ZZ" }), ctx({ band: 2 }));
    expect(Number.isFinite(score)).toBe(true);
    expect(score).toBeGreaterThan(0);
  });
});

describe("topicBoost", () => {
  it("boosts a word carrying a topic the learner chose", () => {
    const on = scoreCandidate(candidate({ topics: ["medical"] }), ctx({ topics: ["medical"] }));
    const off = scoreCandidate(candidate({ topics: [] }), ctx({ topics: ["medical"] }));
    expect(on).toBeGreaterThan(off);
  });

  it("boosts a pack-only topic more than a keyword-matched one", () => {
    // `medical` is curated with no keywords: the slug can only have been written
    // deliberately at import. `food` is keyword-matched, so its slug is noisier
    // and must not be amplified as hard.
    const curated = scoreCandidate(candidate({ topics: ["medical"] }), ctx({ topics: ["medical"] }));
    const keyword = scoreCandidate(candidate({ topics: ["food"] }), ctx({ topics: ["food"] }));
    expect(curated).toBeGreaterThan(keyword);
  });

  it("treats a hybrid topic as keyword-grade, because its slug proves nothing", () => {
    // `travel` is curated AND keyword-matched, so a travel tag does not prove
    // the word was deliberately assigned. Score it conservatively.
    const travel = scoreCandidate(candidate({ topics: ["travel"] }), ctx({ topics: ["travel"] }));
    const food = scoreCandidate(candidate({ topics: ["food"] }), ctx({ topics: ["food"] }));
    const medical = scoreCandidate(candidate({ topics: ["medical"] }), ctx({ topics: ["medical"] }));
    expect(travel).toBeCloseTo(food, 10);
    expect(travel).toBeLessThan(medical);
  });

  it("takes the max across matched topics instead of multiplying them", () => {
    const both = scoreCandidate(
      candidate({ topics: ["medical", "food"] }),
      ctx({ topics: ["medical", "food"] })
    );
    const curatedOnly = scoreCandidate(candidate({ topics: ["medical"] }), ctx({ topics: ["medical"] }));
    const noTopic = scoreCandidate(candidate({ topics: [] }), ctx({ topics: [] }));
    // Multiplying would compound 2.6 x 1.8; max keeps it at 2.6.
    expect(both).toBeCloseTo(curatedOnly, 10);
    expect(both).toBeGreaterThan(noTopic);
  });

  it("applies no boost at all when the widen path switched it off", () => {
    const withBoost = scoreCandidate(candidate({ topics: ["medical"] }), ctx({ topics: ["medical"] }));
    const without = scoreCandidate(
      candidate({ topics: ["medical"] }),
      ctx({ topics: ["medical"], useTopicBoost: false })
    );
    const noTopic = scoreCandidate(candidate({ topics: [] }), ctx({ topics: [] }));
    expect(without).toBeLessThan(withBoost);
    expect(without).toBeCloseTo(noTopic, 10);
  });

  it("ignores a chosen slug that no longer exists in the taxonomy", () => {
    // Crawl batches add and rename topics; a stale slug in a saved profile must
    // not throw and must not silently score as a curated match.
    const stale = scoreCandidate(candidate({ topics: ["gone"] }), ctx({ topics: ["gone"] }));
    const noTopic = scoreCandidate(candidate({ topics: [] }), ctx({ topics: [] }));
    const curated = scoreCandidate(candidate({ topics: ["medical"] }), ctx({ topics: ["medical"] }));
    expect(stale).toBeCloseTo(noTopic, 10);
    expect(stale).toBeLessThan(curated);
  });
});

describe("freqScore", () => {
  it("prefers a frequent word over a rare one in the same band", () => {
    const frequent = scoreCandidate(candidate({ freqPct: 0.95 }), ctx());
    const rare = scoreCandidate(candidate({ freqPct: 0.05 }), ctx());
    expect(frequent).toBeGreaterThan(rare);
  });

  it("never zeroes a rare word out, so an on-topic rare word still has a chance", () => {
    const rare = scoreCandidate(candidate({ freqPct: 0 }), ctx());
    expect(rare).toBeGreaterThan(0);
  });

  it("scores a null freqPct neutrally, between the rarest and the most frequent", () => {
    // 4,871 of 8,011 rows have no frequency data. They must not be pushed to the
    // back of every pool, and must not be invented into frequent words either.
    const unknown = scoreCandidate(candidate({ freqPct: null }), ctx());
    const rarest = scoreCandidate(candidate({ freqPct: 0 }), ctx());
    const frequent = scoreCandidate(candidate({ freqPct: 1 }), ctx());
    expect(unknown).toBeGreaterThan(rarest);
    expect(unknown).toBeLessThan(frequent);
  });
});

describe("knownPenalty", () => {
  it("de-prioritizes a known word without eliminating it", () => {
    // Deliberately not 0: eliminating a known word means a wrong "I know this"
    // can never be probed back up, and the gap stays invisible forever.
    const known = scoreCandidate(candidate({ known: true }), ctx());
    const unknown = scoreCandidate(candidate({ known: false }), ctx());
    expect(known).toBeGreaterThan(0);
    expect(known).toBeLessThan(unknown);
    expect(known / unknown).toBeCloseTo(SELECTION.knownPenalty, 10);
  });

  it("keeps a known word below an unknown word even when it is better on every other factor", () => {
    const knownIdeal = scoreCandidate(
      candidate({ cefr: "B2", freqPct: 1, topics: ["medical"], known: true }),
      ctx({ topics: ["medical"] })
    );
    const unknownPoor = scoreCandidate(candidate({ cefr: "B2", freqPct: 0 }), ctx());
    expect(knownIdeal).toBeLessThan(unknownPoor);
  });
});

describe("score composition", () => {
  it("is always finite and strictly positive, for every band and CEFR pairing", () => {
    for (const cefr of ["A1", "A2", "B1", "B2", "C1"]) {
      for (const band of [0, 1, 2, 2.5, 4]) {
        for (const freqPct of [null, 0, 0.5, 1]) {
          const s = scoreCandidate(candidate({ cefr, freqPct }), ctx({ band }));
          expect(Number.isFinite(s), `${cefr}/${band}/${freqPct}`).toBe(true);
          expect(s, `${cefr}/${band}/${freqPct}`).toBeGreaterThan(0);
        }
      }
    }
  });
});
