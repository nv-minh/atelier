// Pure gamification definitions — XP economy, level curve, achievement catalog.
// NO server-only / NO Prisma import so this can be shared by client components
// (badge gallery, level card, toasts) AND the server awarder AND the tsx
// backfill script — mirroring the pure/server split of export-format.ts.

// XP awarded per FSRS rating on an SRS review: Again/Hard/Good/Easy.
// Rating the same card higher earns more, so honest self-rating is rewarded.
export const XP_PER_RATING: Record<number, number> = { 1: 2, 2: 4, 3: 6, 4: 8 };

// XP awarded per correct answer in a non-SRS mode (matching, pronunciation, …),
// capped per session in the awarder. SRS modes use XP_PER_RATING instead.
export const XP_PER_NONSRS_CORRECT = 1;
export const NONSRS_XP_CAP = 30;

// Total XP for a DailyStat/UserProgress row = the ReviewLog-derived `xp` ledger
// PLUS the non-SRS `bonusXp` ledger. This is the ONE place that sum is defined —
// every display, level, goal-check, and recap total routes through it so the two
// ledgers can never be added inconsistently (a bare `xp` where total was meant).
export function totalXp(row: { xp?: number | null; bonusXp?: number | null }): number {
  return (row.xp ?? 0) + (row.bonusXp ?? 0);
}

// ── Level curve ──────────────────────────────────────────────────────
// xpForLevel(n) = cumulative XP required to REACH level n. Level 0 sits at 0 XP.
// 50·n·(n+1): reaching L1 costs 100, L2 costs 300, L3 costs 600, L10 costs 5500 …
// — a gentle super-linear ramp so early levels come fast and later ones earn.
export function xpForLevel(n: number): number {
  return 50 * n * (n + 1);
}

// Invert the curve: highest level whose threshold is <= xp. Closed-form via the
// quadratic 50n² + 50n − xp = 0, floored, then nudged to stay exact against
// integer rounding at boundaries.
export function levelFromXp(xp: number): number {
  if (!Number.isFinite(xp) || xp <= 0) return 0;
  let n = Math.floor((-1 + Math.sqrt(1 + xp / 12.5)) / 2);
  if (n < 0) n = 0;
  while (xpForLevel(n + 1) <= xp) n += 1;
  while (n > 0 && xpForLevel(n) > xp) n -= 1;
  return n;
}

// Everything the level bar needs in one call: current level, XP into the
// current level, XP the current level spans, and 0..1 progress toward the next.
export function levelInfo(xp: number): {
  level: number;
  currentLevelXp: number;
  nextLevelXp: number;
  progress01: number;
} {
  const level = levelFromXp(xp);
  const floor = xpForLevel(level);
  const ceil = xpForLevel(level + 1);
  const span = ceil - floor;
  const into = xp - floor;
  return {
    level,
    currentLevelXp: into,
    nextLevelXp: span,
    progress01: span > 0 ? Math.min(1, Math.max(0, into / span)) : 0,
  };
}

// ── Achievement catalog ──────────────────────────────────────────────
// Titles/descriptions live in i18n (achievements.<key>.title / .desc), NOT here,
// so this stays a pure data table. `icon` is a lucide icon NAME; the client maps
// name → component (see badge-gallery). `threshold` drives the server check for
// count-based families; absent for one-shot achievements (perfect_session, goal).
export type AchievementFamily =
  | "streak"
  | "reviews"
  | "mastered"
  | "cefr"
  | "session"
  | "goal";

export type AchievementDef = {
  key: string;
  family: AchievementFamily;
  threshold?: number;
  icon: string;
};

export const ACHIEVEMENTS: AchievementDef[] = [
  // Streaks — consecutive active days.
  { key: "streak_3", family: "streak", threshold: 3, icon: "Flame" },
  { key: "streak_7", family: "streak", threshold: 7, icon: "Flame" },
  { key: "streak_30", family: "streak", threshold: 30, icon: "Flame" },
  { key: "streak_100", family: "streak", threshold: 100, icon: "Flame" },

  // Lifetime reviews logged.
  { key: "reviews_100", family: "reviews", threshold: 100, icon: "Repeat" },
  { key: "reviews_1000", family: "reviews", threshold: 1000, icon: "Repeat" },
  { key: "reviews_10000", family: "reviews", threshold: 10000, icon: "Repeat" },

  // Cards mastered (Review state, interval >= 21 days).
  { key: "mastered_50", family: "mastered", threshold: 50, icon: "GraduationCap" },
  { key: "mastered_500", family: "mastered", threshold: 500, icon: "GraduationCap" },

  // Every word of a CEFR level started (a card exists in state >= 1).
  { key: "cefr_A1", family: "cefr", icon: "BookOpen" },
  { key: "cefr_A2", family: "cefr", icon: "BookOpen" },
  { key: "cefr_B1", family: "cefr", icon: "BookOpen" },
  { key: "cefr_B2", family: "cefr", icon: "BookOpen" },

  // One-shots.
  { key: "perfect_session", family: "session", icon: "Target" },
  { key: "goal_reached", family: "goal", icon: "CircleCheck" },
];

// The CEFR level a cefr_* achievement key targets ("cefr_A1" -> "A1").
export const CEFR_ACHIEVEMENT_LEVELS = ["A1", "A2", "B1", "B2"] as const;

// Fast lookup for the client (name → def) when rendering a toast from a key.
export const ACHIEVEMENT_BY_KEY: Record<string, AchievementDef> = Object.fromEntries(
  ACHIEVEMENTS.map((a) => [a.key, a])
);
