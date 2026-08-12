import { describe, it, expect } from "vitest";
import { deriveSessionLimits } from "./session-limits";

describe("deriveSessionLimits", () => {
  it("fills the whole session from due cards when there are enough", () => {
    expect(
      deriveSessionLimits({ size: 15, dueAvailable: 45, newAllowanceToday: 20, dailyReviewLimit: 200 })
    ).toEqual({ reviewLimit: 15, newLimit: 0 });
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
});
