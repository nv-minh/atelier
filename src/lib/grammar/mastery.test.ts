import { describe, expect, it } from "vitest";
import { MASTERY_MIN_ANSWERED, RECENT_WINDOW, masteryPct, pushRecent, sanitizeRecent } from "./mastery";

describe("sanitizeRecent", () => {
  it("accepts a boolean array and coerces truthiness", () => {
    expect(sanitizeRecent([true, false, 1, 0, "x"])).toEqual([true, false, true, false, true]);
  });
  it("returns [] for null/garbage json values", () => {
    expect(sanitizeRecent(null)).toEqual([]);
    expect(sanitizeRecent("not an array")).toEqual([]);
    expect(sanitizeRecent({ a: 1 })).toEqual([]);
  });
});

describe("pushRecent", () => {
  it("appends newest at the END", () => {
    expect(pushRecent([true], false)).toEqual([true, false]);
  });
  it("caps at RECENT_WINDOW, dropping the oldest", () => {
    const full = Array.from({ length: RECENT_WINDOW }, () => false);
    const out = pushRecent(full, true);
    expect(out).toHaveLength(RECENT_WINDOW);
    expect(out[RECENT_WINDOW - 1]).toBe(true);
  });
  it("tolerates garbage stored json", () => {
    expect(pushRecent(null, true)).toEqual([true]);
  });
});

describe("masteryPct", () => {
  it("returns null below MASTERY_MIN_ANSWERED answers", () => {
    expect(
      masteryPct({ lessonsRead: 3, lessonsTotal: 10, recent: [true, true], answered: MASTERY_MIN_ANSWERED - 1 })
    ).toBeNull();
  });
  it("computes 30% read + 70% recent accuracy, rounded", () => {
    // read 5/10 = 0.5 → 15 điểm; recent 8/10 đúng = 0.8 → 56 điểm; tổng 71
    const recent = [true, true, true, true, true, true, true, true, false, false];
    expect(masteryPct({ lessonsRead: 5, lessonsTotal: 10, recent, answered: 10 })).toBe(71);
  });
  it("clamps lessonsRead above total and handles lessonsTotal=0", () => {
    const recent = [true, true, true, true, true];
    expect(masteryPct({ lessonsRead: 7, lessonsTotal: 5, recent, answered: 5 })).toBe(100);
    expect(masteryPct({ lessonsRead: 0, lessonsTotal: 0, recent, answered: 5 })).toBe(70);
  });
});
