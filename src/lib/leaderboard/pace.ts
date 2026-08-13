import { PACE_MIN_ACTIVE_DAYS, PACE_WINDOW_DAYS } from "./constants";

function median(sorted: number[]): number {
  if (sorted.length === 0) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// Two different paces come out of the same week of DailyStat rows, and
// callers must hand the right one to the board:
//
// - sessionPace: median XP over the days the user ACTUALLY studied, not over
//   all seven. Including rest days as zeros drags the median to 0 for anyone
//   who studies 3-4 days a week — which is most people — and rival XP scaled
//   from 0 makes an empty board. This measures per-SESSION intensity: how
//   hard a typical study session is, independent of how often it happens.
//
// - dailyPace: sessionPace spread back over the full PACE_WINDOW_DAYS —
//   sessionPace × activeDays / PACE_WINDOW_DAYS — i.e. the user's actual
//   WEEKLY OUTPUT expressed as a daily figure. THIS is what rivals should be
//   calibrated to (hand it to buildBoard's `pace`), because someone who
//   studies twice a week with intense sessions and someone who studies
//   lightly every day can share a sessionPace while producing very different
//   weekly totals — and it's the weekly total the board ranks on. Calibrating
//   rivals to sessionPace instead punishes the twice-a-week user (rivals run
//   at session intensity every day, 7x their real output) and hands the
//   every-day user a systematic edge (rivals actually running a bit under
//   sessionPace even every day).
//
// activeDays is returned alongside both — it is what dailyPace is built
// from, and the low-data fallback below also consults it directly.
export function derivePace(
  dailyXps: number[],
  dailyGoalXp: number
): { sessionPace: number; dailyPace: number; activeDays: number } {
  const active = dailyXps.filter((x) => x > 0).sort((a, b) => a - b);
  const activeDays = active.length;
  if (activeDays < PACE_MIN_ACTIVE_DAYS) {
    // Too little data for a real rhythm reading. dailyGoalXp already IS a
    // per-day target, so — unlike the real formula above — it must NOT be
    // scaled down by activeDays here: a new user with one 60-XP day would
    // otherwise get dailyPace = round(60 * 1 / 7) = 9, making their rivals
    // almost free instead of matched to their stated goal.
    const fallback = Math.max(0, dailyGoalXp);
    return { sessionPace: fallback, dailyPace: fallback, activeDays };
  }
  const sessionPace = Math.max(0, median(active));
  const dailyPace = Math.round((sessionPace * activeDays) / PACE_WINDOW_DAYS);
  return { sessionPace, dailyPace, activeDays };
}
