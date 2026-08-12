/**
 * Split a requested session size into a due-card limit and a new-card limit.
 *
 * Due cards come first — that is FSRS-correct: a card past its due date is the
 * one whose recall is actually at risk. New cards only fill what is left over,
 * and never more than the day's remaining new allowance.
 *
 * `newAllowanceToday` must already be NET of cards studied today. Callers must
 * not pass the raw `newCardsPerDay` setting.
 */
export function deriveSessionLimits(input: {
  size: number | "all";
  dueAvailable: number;
  newAllowanceToday: number;
  dailyReviewLimit: number;
}): { reviewLimit: number; newLimit: number } {
  const newAllowance = Math.max(0, Math.floor(input.newAllowanceToday));
  const dailyReview = Math.max(0, Math.floor(input.dailyReviewLimit));

  if (input.size === "all") {
    return { reviewLimit: dailyReview, newLimit: newAllowance };
  }

  const size = Math.max(0, Math.floor(input.size));
  const due = Math.max(0, Math.floor(input.dueAvailable));
  const reviewLimit = Math.min(size, due, dailyReview);
  const newLimit = Math.max(0, Math.min(size - reviewLimit, newAllowance));
  return { reviewLimit, newLimit };
}
