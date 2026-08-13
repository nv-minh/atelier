import { describe, expect, it } from "vitest";
import { PACK_FREQ_SOURCE, freqPctFromRank, freqForPackWord } from "./freq";

describe("freqPctFromRank", () => {
  it("puts the top of a list at ~1 and the bottom at 0", () => {
    expect(freqPctFromRank(1, 1000)).toBeCloseTo(0.999, 3);
    expect(freqPctFromRank(500, 1000)).toBeCloseTo(0.5, 6);
    expect(freqPctFromRank(1000, 1000)).toBe(0);
  });

  it("clamps rank 0 to 1 — NGSL-Spoken starts at 0, the service lists at 1", () => {
    expect(freqPctFromRank(0, 721)).toBe(1);
  });

  it("clamps a rank past the end of its list instead of going negative", () => {
    expect(freqPctFromRank(1500, 1000)).toBe(0);
  });

  it("returns null rather than a made-up number for unusable input", () => {
    expect(freqPctFromRank(null, 1000)).toBeNull();
    expect(freqPctFromRank(undefined, 1000)).toBeNull();
    expect(freqPctFromRank(NaN, 1000)).toBeNull();
    expect(freqPctFromRank(-3, 1000)).toBeNull();
    expect(freqPctFromRank(5, 0)).toBeNull();
    expect(freqPctFromRank(5, -10)).toBeNull();
  });
});

describe("freqForPackWord", () => {
  // The bug this module exists to prevent: `mister` is rank 1 in BOTH the
  // Business Service List (1744 words) and the TOEIC Service List (1250). A
  // shared raw-rank column would make it the most frequent word in English.
  // Percentiles keep the two scales separate and comparable.
  it("normalizes the same raw rank differently per list, and never exposes the rank", () => {
    const bsl = freqForPackWord("business", 1, 1744);
    const tsl = freqForPackWord("toeic", 1, 1250);

    expect(bsl.freqSource).toBe("bsl");
    expect(tsl.freqSource).toBe("tsl");
    // Both are near the top of their own list — that is the honest statement.
    expect(bsl.freqPct).toBeGreaterThan(0.99);
    expect(tsl.freqPct).toBeGreaterThan(0.99);
    // …and neither leaks the raw rank.
    expect(bsl.freqPct).not.toBe(1);
    expect(tsl.freqPct).not.toBe(1);
  });

  it("ranks a mid-list word below a top-of-list word on the same scale", () => {
    const top = freqForPackWord("business", 10, 1744).freqPct!;
    const mid = freqForPackWord("business", 900, 1744).freqPct!;
    expect(top).toBeGreaterThan(mid);
  });

  it("gives a pack with no rank source null on BOTH fields", () => {
    // oxford-c1, it-programming and every pack in the 2026-08-13 crawl batch
    // carry no rank; null must not be paired with a guessed source, or a later
    // reader cannot tell which scale a percentile came from.
    for (const pack of ["oxford-c1", "it-programming", "medical", "daily-communication"]) {
      expect(freqForPackWord(pack, 5, 500)).toEqual({ freqPct: null, freqSource: null });
    }
  });

  it("gives null when the pack has a source but the word has no rank", () => {
    expect(freqForPackWord("business", undefined, 1744)).toEqual({ freqPct: null, freqSource: null });
    expect(freqForPackWord("business", null, 1744)).toEqual({ freqPct: null, freqSource: null });
  });

  it("only claims a scale for packs actually built from a ranked list", () => {
    expect(Object.keys(PACK_FREQ_SOURCE).sort()).toEqual(["business", "conversation", "toeic"]);
  });
});
