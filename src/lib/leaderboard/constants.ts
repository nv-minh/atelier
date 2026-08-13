// Every tunable number for the leaderboard. These are STARTING values chosen by
// the spec author, not measured results — tune here, never inline.

export const RIVAL_COUNT = 10;

// Rival strength relative to the user's own median pace.
export const PACE_FACTOR_MIN = 0.55;
export const PACE_FACTOR_MAX = 1.6;

// No rival's weekly XP may exceed this multiple of (pace × 7). A board where
// first place laps you tenfold does not motivate, it discourages.
export const WEEKLY_CAP_MULTIPLIER = 2.2;

// Roster is a 10-wide window sliding over a per-user permutation of the name
// pool. Step 5 → 5 names shared with last week; step 6 → 4 shared.
export const WINDOW_STEP_MIN = 5;
export const WINDOW_STEP_MAX = 6;

// At most this many rivals may have a small-hours peak, so opening the app at
// 3am never shows ten people who "just studied".
export const NIGHT_PEAK_MAX = 2;
export const NIGHT_HOURS_VN: readonly [number, number] = [0, 5];

// The app's day axis is UTC; rival body clocks are Vietnamese.
export const VN_UTC_OFFSET_HOURS = 7;

// Pace measurement.
export const PACE_WINDOW_DAYS = 7;
export const PACE_MIN_ACTIVE_DAYS = 3;

// Personality ranges.
export const REST_PROB_MIN = 0.05;
export const REST_PROB_MAX = 0.45;
export const REGULARITY_MIN = 0.15;
export const REGULARITY_MAX = 0.6;
export const WEEKEND_BIAS_MAX = 0.45;
export const FORM_TREND_MAX = 0.25;
