import { describe, it, expect } from "vitest";
import { initialSessionState, reduceSession, sessionSummary } from "./session-state";
import { RATING } from "./types";
import type { ItemResult } from "./types";

const res = (over: Partial<ItemResult> = {}): ItemResult => ({
  cardId: "c1",
  wordId: "w1",
  word: "abandon",
  correct: true,
  rating: RATING.Good,
  ...over,
});

describe("reduceSession", () => {
  it("stores an answer as pending, not as a result", () => {
    const s = reduceSession(initialSessionState, { type: "answer", result: res() });
    expect(s.pending).toEqual(res());
    expect(s.results).toEqual([]);
    expect(s.index).toBe(0);
  });

  it("ignores a second answer while one is pending (double-submit guard)", () => {
    const s1 = reduceSession(initialSessionState, { type: "answer", result: res() });
    const s2 = reduceSession(s1, { type: "answer", result: res({ cardId: "c2", correct: false }) });
    expect(s2).toBe(s1);
  });

  it("commit moves pending into results and advances the index", () => {
    const s1 = reduceSession(initialSessionState, { type: "answer", result: res() });
    const s2 = reduceSession(s1, { type: "commit" });
    expect(s2.results).toEqual([res()]);
    expect(s2.pending).toBeNull();
    expect(s2.index).toBe(1);
  });

  it("commit with nothing pending still advances", () => {
    const s = reduceSession(initialSessionState, { type: "commit" });
    expect(s.index).toBe(1);
    expect(s.results).toEqual([]);
  });

  it("adjust rewrites the pending rating and nothing else", () => {
    const s1 = reduceSession(initialSessionState, { type: "answer", result: res() });
    const s2 = reduceSession(s1, { type: "adjust", rating: RATING.Easy });
    expect(s2.pending?.rating).toBe(RATING.Easy);
    expect(s2.pending?.cardId).toBe("c1");
  });

  it("adjust with nothing pending is a no-op", () => {
    const s = reduceSession(initialSessionState, { type: "adjust", rating: RATING.Easy });
    expect(s).toBe(initialSessionState);
  });

  it("builds a combo on correct answers and keeps the best", () => {
    let s = initialSessionState;
    for (let i = 0; i < 3; i++) {
      s = reduceSession(s, { type: "answer", result: res({ cardId: `c${i}` }) });
      s = reduceSession(s, { type: "commit" });
    }
    expect(s.combo).toBe(3);
    expect(s.bestCombo).toBe(3);
  });

  it("resets combo to 0 on a wrong answer but keeps bestCombo", () => {
    let s = initialSessionState;
    s = reduceSession(s, { type: "answer", result: res({ cardId: "a" }) });
    s = reduceSession(s, { type: "commit" });
    s = reduceSession(s, { type: "answer", result: res({ cardId: "b" }) });
    s = reduceSession(s, { type: "commit" });
    s = reduceSession(s, { type: "answer", result: res({ cardId: "c", correct: false, rating: RATING.Again }) });
    expect(s.combo).toBe(0);
    expect(s.bestCombo).toBe(2);
  });

  it("skip advances, records the card, and drops any pending answer", () => {
    const s1 = reduceSession(initialSessionState, { type: "answer", result: res() });
    const s2 = reduceSession(s1, { type: "skip", cardId: "c1" });
    expect(s2.skipped).toEqual(["c1"]);
    expect(s2.index).toBe(1);
    expect(s2.pending).toBeNull();
  });
});

describe("sessionSummary", () => {
  it("computes totals and rounds the percentage", () => {
    let s = initialSessionState;
    const answers: ItemResult[] = [
      res({ cardId: "a" }),
      res({ cardId: "b", correct: false, rating: RATING.Again }),
      res({ cardId: "c" }),
    ];
    for (const a of answers) {
      s = reduceSession(s, { type: "answer", result: a });
      s = reduceSession(s, { type: "commit" });
    }
    const sum = sessionSummary(s);
    expect(sum.total).toBe(3);
    expect(sum.correct).toBe(2);
    expect(sum.pct).toBe(67);
    expect(sum.counts[RATING.Good]).toBe(2);
    expect(sum.counts[RATING.Again]).toBe(1);
  });

  it("lists missed words once each, in order first missed", () => {
    let s = initialSessionState;
    const answers: ItemResult[] = [
      res({ cardId: "b", word: "brief", correct: false, rating: RATING.Again }),
      res({ cardId: "a", word: "abandon" }),
      res({ cardId: "b", word: "brief", correct: false, rating: RATING.Again }),
      res({ cardId: "c", word: "cope", correct: false, rating: RATING.Again }),
    ];
    for (const a of answers) {
      s = reduceSession(s, { type: "answer", result: a });
      s = reduceSession(s, { type: "commit" });
    }
    expect(sessionSummary(s).missed.map((m) => m.word)).toEqual(["brief", "cope"]);
  });

  it("reports 0% for an empty session without dividing by zero", () => {
    const sum = sessionSummary(initialSessionState);
    expect(sum.total).toBe(0);
    expect(sum.pct).toBe(0);
  });
});
