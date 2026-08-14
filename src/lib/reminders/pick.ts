// Reminder policy: learner state → ONE reminder, or none at all.
//
// This is the single brain for both channels — the push cron and the in-app
// banner both call it, so the priority order and the wording cannot drift apart.
//
// PURE module: no prisma, no server-only, never reads Date.now().
export type ReminderKind = "streak-risk" | "due" | "leech" | "winback";

export type ReminderInput = {
  studiedToday: boolean; // by app-day (UTC) — see §4 of the spec
  streak: number;
  dueCount: number;
  leechCount: number;
  daysInactive: number;
  isSaturday: boolean;
};

// `n` is the one number the wording needs (streak days, words due, …). Kept here
// so copy.ts only interpolates and never recomputes it.
export type Reminder = { kind: ReminderKind; url: string; n: number };

export const LEECH_NUDGE_MIN = 5;
export const WINBACK_DAYS = [3, 7, 14] as const;

export function pickReminder(input: ReminderInput): Reminder | null {
  // Leech is the only reminder allowed to fire at someone who already studied
  // today: it is about a different job (drilling the hard words on their own),
  // not about "go study".
  const leechReady = input.isSaturday && input.leechCount >= LEECH_NUDGE_MIN;

  if (input.studiedToday) {
    return leechReady ? { kind: "leech", url: "/study/cram?scope=leeches", n: input.leechCount } : null;
  }

  if (input.streak >= 1) return { kind: "streak-risk", url: "/study", n: input.streak };
  if (input.dueCount > 0) return { kind: "due", url: "/study", n: input.dueCount };
  if (leechReady) return { kind: "leech", url: "/study/cram?scope=leeches", n: input.leechCount };
  if ((WINBACK_DAYS as readonly number[]).includes(input.daysInactive)) {
    return { kind: "winback", url: "/study", n: input.daysInactive };
  }
  return null;
}

// How many consecutive app-days back from `today` had no activity.
// `activeDateStrs` are the DailyStat.dateStr values with totalCount > 0 — the same
// predicate computeStreakFromDb uses.
export function countDaysInactive(activeDateStrs: string[], today: string): number {
  if (activeDateStrs.length === 0) return 0; // brand new user, not someone who left
  const active = new Set(activeDateStrs);
  const start = Date.parse(today + "T00:00:00Z");
  if (Number.isNaN(start)) return 0;

  for (let d = 0; d <= 400; d++) {
    const iso = new Date(start - d * 86_400_000).toISOString().slice(0, 10);
    if (active.has(iso)) return d;
  }
  return 0; // last activity too far back — no longer a win-back candidate
}

// Saturday by APP-DAY, i.e. the UTC boundary (the day flips at 07:00 Vietnam
// time) — the same boundary todayStr(), DailyStat, streak and the daily goal use.
// It lives in the pure module instead of being computed as now.getUTCDay() inside
// state-server so a test can pin it: reaching for getDay() (the host machine's
// local time) is a silent bug that only shows up on two boundary days.
export function isSaturdayAppDay(now: Date): boolean {
  return now.getUTCDay() === 6;
}
