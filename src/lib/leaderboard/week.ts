// The leaderboard week. Everything here rides the SAME UTC day axis as
// todayStr()/DailyStat.dateStr — see the Global Constraints in the plan. A week
// keyed to Vietnam time would drift from the seven DailyStat rows /stats shows,
// and only at the two boundary days, which is the hardest kind of mismatch to
// trace.

import { addUtcDays, isoWeekMonday, todayStr } from "@/lib/utils";

// First Monday of the Unix epoch (1970-01-05), the anchor for weekIndex.
const EPOCH_MONDAY_MS = Date.UTC(1970, 0, 5);
const WEEK_MS = 7 * 86400000;

// ISO-8601 week: week 01 is the one containing January 4th.
export function weekKey(now: Date): string {
  const monday = isoWeekMonday(now);
  const thursday = addUtcDays(monday, 3); // the week's year is its Thursday's year
  const year = thursday.getUTCFullYear();
  const firstMonday = isoWeekMonday(new Date(Date.UTC(year, 0, 4)));
  const week = Math.round((monday.getTime() - firstMonday.getTime()) / WEEK_MS) + 1;
  return `${year}-W${String(week).padStart(2, "0")}`;
}

// Continuous week counter. Used as the offset of the rival roster's sliding
// window, so it must increase by exactly 1 per week with no year-boundary
// discontinuity — which is why it is NOT derived from weekKey.
export function weekIndex(now: Date): number {
  return Math.round((isoWeekMonday(now).getTime() - EPOCH_MONDAY_MS) / WEEK_MS);
}

export function weekDates(now: Date): string[] {
  const monday = isoWeekMonday(now);
  return Array.from({ length: 7 }, (_, i) => todayStr(addUtcDays(monday, i)));
}

export function isMondayUtc(now: Date): boolean {
  return now.getUTCDay() === 1;
}
