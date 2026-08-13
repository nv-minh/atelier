import { PACE_MIN_ACTIVE_DAYS } from "./constants";

function median(sorted: number[]): number {
  if (sorted.length === 0) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// Median over the days the user ACTUALLY studied, not over all seven. Including
// rest days as zeros drags the median to 0 for anyone who studies 3-4 days a
// week — which is most people — and rival XP scaled from 0 makes an empty board.
// activeDays is returned alongside pace and is currently only consulted for the
// < PACE_MIN_ACTIVE_DAYS fallback below — it is NOT fed into rival scaling, so
// a user's rest days have no separate effect on how hard the rivals are. That's
// available for a future calibration change, not forgotten.
export function derivePace(
  dailyXps: number[],
  dailyGoalXp: number
): { pace: number; activeDays: number } {
  const active = dailyXps.filter((x) => x > 0).sort((a, b) => a - b);
  const activeDays = active.length;
  if (activeDays < PACE_MIN_ACTIVE_DAYS) {
    return { pace: Math.max(0, dailyGoalXp), activeDays };
  }
  return { pace: Math.max(0, median(active)), activeDays };
}
