import { describe, it, expect } from "vitest";
import { Rating as FsrsRating } from "ts-fsrs";
import { gradeAnswer } from "./grading";
import { RATING } from "./types";
import type { GradeSignals } from "./types";

const sig = (over: Partial<GradeSignals> = {}): GradeSignals => ({
  correct: true,
  elapsedMs: 4000,
  wordLength: 7,
  cardState: 2,
  wasHidden: false,
  ...over,
});

describe("RATING", () => {
  // lib/practice declares the grades locally to stay free of ts-fsrs. If ts-fsrs
  // ever renumbers its enum, every review we write would land on the wrong FSRS
  // step — so the two must be pinned together here.
  it("matches the numeric values of ts-fsrs Rating", () => {
    expect(RATING.Again).toBe(FsrsRating.Again);
    expect(RATING.Hard).toBe(FsrsRating.Hard);
    expect(RATING.Good).toBe(FsrsRating.Good);
    expect(RATING.Easy).toBe(FsrsRating.Easy);
  });
});

describe("gradeAnswer", () => {
  it("returns Again for a wrong answer", () => {
    expect(gradeAnswer("quiz", sig({ correct: false }))).toBe(RATING.Again);
  });

  it("returns Again for a wrong answer even when every easy signal is present", () => {
    expect(
      gradeAnswer("typing", sig({ correct: false, elapsedMs: 1, cardState: 2, wasHidden: false }))
    ).toBe(RATING.Again);
  });

  it("returns Good for a correct answer", () => {
    expect(gradeAnswer("quiz", sig())).toBe(RATING.Good);
  });

  it("passes a self-rating straight through (flashcard)", () => {
    expect(gradeAnswer("flashcard", sig({ selfRated: RATING.Hard }))).toBe(RATING.Hard);
    expect(gradeAnswer("flashcard", sig({ selfRated: RATING.Easy }))).toBe(RATING.Easy);
  });

  it("lets a self-rated Again through even though correct is true", () => {
    expect(gradeAnswer("flashcard", sig({ correct: true, selfRated: RATING.Again }))).toBe(
      RATING.Again
    );
  });

  it("never returns a grade outside 1..4", () => {
    const cases: GradeSignals[] = [
      sig(),
      sig({ correct: false }),
      sig({ hintUsed: true }),
      sig({ elapsedMs: 0 }),
      sig({ cardState: 3 }),
      sig({ wasHidden: true }),
    ];
    for (const c of cases) {
      const r = gradeAnswer("dictation", c);
      expect(r).toBeGreaterThanOrEqual(1);
      expect(r).toBeLessThanOrEqual(4);
      expect(Number.isInteger(r)).toBe(true);
    }
  });
});
