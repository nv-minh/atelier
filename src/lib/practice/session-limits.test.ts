import { describe, it, expect } from "vitest";
import { deriveSessionLimits } from "./session-limits";

describe("deriveSessionLimits", () => {
  it("reserves a new-card floor even when due cards could fill the session", () => {
    // Backlog day: 45 due, but a 15-card session still teaches 5 new words.
    // ⌊15/3⌋ = 5 floor, capped by the 20-card daily allowance.
    expect(
      deriveSessionLimits({ size: 15, dueAvailable: 45, newAllowanceToday: 20, dailyReviewLimit: 200 })
    ).toEqual({ reviewLimit: 10, newLimit: 5 });
  });

  it("tops up with new cards when due cards run short", () => {
    expect(
      deriveSessionLimits({ size: 15, dueAvailable: 3, newAllowanceToday: 20, dailyReviewLimit: 200 })
    ).toEqual({ reviewLimit: 3, newLimit: 12 });
  });

  it("never exceeds the remaining daily new allowance", () => {
    expect(
      deriveSessionLimits({ size: 15, dueAvailable: 3, newAllowanceToday: 5, dailyReviewLimit: 200 })
    ).toEqual({ reviewLimit: 3, newLimit: 5 });
  });

  it("respects the daily review limit and still tops up with new", () => {
    expect(
      deriveSessionLimits({ size: 15, dueAvailable: 45, newAllowanceToday: 20, dailyReviewLimit: 10 })
    ).toEqual({ reviewLimit: 10, newLimit: 5 });
  });

  it('size "all" falls back to the daily budget', () => {
    expect(
      deriveSessionLimits({ size: "all", dueAvailable: 999, newAllowanceToday: 20, dailyReviewLimit: 200 })
    ).toEqual({ reviewLimit: 200, newLimit: 20 });
  });

  it("returns zeros when nothing is available", () => {
    expect(
      deriveSessionLimits({ size: 15, dueAvailable: 0, newAllowanceToday: 0, dailyReviewLimit: 200 })
    ).toEqual({ reviewLimit: 0, newLimit: 0 });
  });

  it("clamps negative and fractional inputs instead of propagating them", () => {
    expect(
      deriveSessionLimits({ size: 10.7, dueAvailable: -5, newAllowanceToday: -3, dailyReviewLimit: 200 })
    ).toEqual({ reviewLimit: 0, newLimit: 0 });
  });

  it("clamps the new floor to the remaining daily new allowance", () => {
    // Only 2 new cards left for the day: floor is 2, not 5. Due takes 13.
    expect(
      deriveSessionLimits({ size: 15, dueAvailable: 45, newAllowanceToday: 2, dailyReviewLimit: 200 })
    ).toEqual({ reviewLimit: 13, newLimit: 2 });
  });

  it("collapses to review-only when no new cards are available", () => {
    // The second deriveSessionLimits call in buildSessionPlan hits this shape:
    // newAllowance is the REAL count of new cards fetched (0), so the floor
    // vanishes and due fills the whole session — the session must NOT shrink.
    expect(
      deriveSessionLimits({ size: 15, dueAvailable: 45, newAllowanceToday: 0, dailyReviewLimit: 200 })
    ).toEqual({ reviewLimit: 15, newLimit: 0 });
  });

  it("yields no new cards for sessions smaller than 3", () => {
    // ⌊2/3⌋ = 0: a 1–2 card session is too short to reserve new-card space.
    expect(
      deriveSessionLimits({ size: 2, dueAvailable: 45, newAllowanceToday: 20, dailyReviewLimit: 200 })
    ).toEqual({ reviewLimit: 2, newLimit: 0 });
  });
});
