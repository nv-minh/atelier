/**
 * Split a requested session size into a due-card limit and a new-card limit.
 *
 * Due cards are prioritized for recall, but a FLOOR of ⌊size/3⌋ slots is
 * reserved for new cards (capped by the day's remaining new allowance) so a
 * backlog day still teaches some new words. If fewer new cards exist than the
 * floor, review fills the gap — see the second call in buildSessionPlan, which
 * re-derives with the real count of new cards fetched.
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
  // Reserve up to a third of the session for new cards, but never more than the
  // day's remaining new allowance. This is a FLOOR on new, not a cap on review:
  // if new cards run short, reviewLimit grows to fill the session (see the
  // second deriveSessionLimits call in buildSessionPlan, which re-derives with
  // the REAL count of new cards that exist).
  const newFloor = Math.min(Math.floor(size / 3), newAllowance);
  const reviewLimit = Math.min(size - newFloor, due, dailyReview);
  const newLimit = Math.max(0, Math.min(size - reviewLimit, newAllowance));
  return { reviewLimit, newLimit };
}
