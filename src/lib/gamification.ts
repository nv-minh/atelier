import "server-only";
import { prisma } from "./db";
import { computeStreak } from "./stats";
import {
  XP_PER_RATING,
  XP_PER_NONSRS_CORRECT,
  NONSRS_XP_CAP,
  ACHIEVEMENTS,
  levelFromXp,
  levelInfo,
} from "./gamification-defs";
import {
  masteredCount,
  totalReviews,
  fullyStartedCefrLevels,
} from "./gamification-checks";
import { runBackfillForUser } from "./gamification-backfill";
import { todayStr } from "./utils";

// SRS modes score XP per rating (via XP_PER_RATING inside recordReview). Any
// other mode is a non-SRS drill that earns a small capped correct-answer bonus
// at session end instead. `cram` records no session at all, so it stays XP-less
// by design — that's intentional, not an oversight.
const SRS_MODES = new Set(["flashcard", "quiz", "typing", "dictation"]);

// ── Race-safe unlock ─────────────────────────────────────────────────
// Insert one row per key, catching P2002 (unique [userId,key] violation) so a
// concurrent request racing the same unlock can never double-report or double-
// grant a badge. Only keys whose insert actually succeeded are returned. Volume
// is tiny (a handful of unlocks per user lifetime), so per-key inserts are fine.
//
// Callers pass `existing` (the user's already-unlocked keys, read once) so we
// filter those out BEFORE attempting inserts — otherwise every session would
// re-attempt inserts for badges the user earned long ago (a doomed P2002 per
// already-owned badge, forever). The P2002 catch still covers the concurrent
// race where two requests unlock the same new key at the same instant.
async function unlockKeys(
  userId: string,
  candidates: string[],
  existing: Set<string>
): Promise<string[]> {
  const fresh = candidates.filter((k) => !existing.has(k));
  if (fresh.length === 0) return [];
  const inserted: string[] = [];
  for (const key of fresh) {
    try {
      await prisma.achievement.create({ data: { userId, key } });
      inserted.push(key);
    } catch (e: any) {
      // P2002 = a concurrent request just unlocked the same key. Swallow;
      // rethrow anything else so real DB errors aren't hidden.
      if (e?.code !== "P2002") throw e;
    }
  }
  return inserted;
}

// The user's already-unlocked achievement keys, read once per award pass.
async function existingKeys(userId: string): Promise<Set<string>> {
  const rows = await prisma.achievement.findMany({ where: { userId }, select: { key: true } });
  return new Set(rows.map((r) => r.key));
}

// ── awardForReview: called from inside recordReview (study-engine) ────
// Owns BOTH xp ledgers for a review — DailyStat.xp and UserProgress.xp — and
// increments them inside one $transaction so the daily total and the lifetime
// total can never drift (e.g. one write landing while the other fails). Then the
// CHEAP checks only: total-review milestones (one indexed count) and level-up
// detection. Expensive/contextual families run at session end instead.
//
// `dateStr` is passed in so it matches the exact day recordReview stamped on the
// rest of the DailyStat row (avoids a midnight-boundary split between the two).
export async function awardForReview(
  userId: string,
  rating: number,
  dateStr: string
): Promise<{ xpGained: number; unlocked: string[]; leveledUp: number | null }> {
  const xpGained = XP_PER_RATING[rating] ?? 0;

  const beforeProgress = await prisma.userProgress.findUnique({ where: { userId } });
  const beforeXp = beforeProgress?.xp ?? 0;

  // Both xp increments in one transaction — atomic, no read-modify-write.
  const [, after] = await prisma.$transaction([
    prisma.dailyStat.upsert({
      where: { userId_dateStr: { userId, dateStr } },
      update: { xp: { increment: xpGained } },
      create: { userId, dateStr, xp: xpGained },
    }),
    prisma.userProgress.upsert({
      where: { userId },
      update: { xp: { increment: xpGained } },
      create: { userId, xp: xpGained },
    }),
  ]);

  const leveledUp = levelFromXp(after.xp) > levelFromXp(beforeXp) ? levelFromXp(after.xp) : null;

  // Total-review milestones: one indexed count. Filter against already-owned
  // keys before attempting any insert (see unlockKeys / existingKeys).
  const total = await totalReviews(prisma, userId);
  const candidates = ACHIEVEMENTS.filter(
    (a) => a.family === "reviews" && a.threshold && total >= a.threshold
  ).map((a) => a.key);
  const unlocked = candidates.length
    ? await unlockKeys(userId, candidates, await existingKeys(userId))
    : [];

  return { xpGained, unlocked, leveledUp };
}

// ── awardForSessionEnd: the expensive/contextual families ─────────────
export async function awardForSessionEnd(
  userId: string,
  session: {
    mode: string;
    cardsReviewed: number;
    correctCount: number;
  }
): Promise<{ xpGained: number; unlocked: string[] }> {
  let xpGained = 0;

  // Non-SRS modes (matching, pronunciation, …) earn a small capped bonus that
  // SRS reviews already earned per-rating. cram records no session, so it never
  // reaches here — intentional (see SRS_MODES note above). Both xp ledgers are
  // incremented in one transaction so they can't drift.
  if (!SRS_MODES.has(session.mode)) {
    xpGained = Math.min(session.correctCount, NONSRS_XP_CAP) * XP_PER_NONSRS_CORRECT;
    if (xpGained > 0) {
      const dateStr = todayStr();
      await prisma.$transaction([
        prisma.dailyStat.upsert({
          where: { userId_dateStr: { userId, dateStr } },
          update: { xp: { increment: xpGained } },
          create: { userId, dateStr, xp: xpGained },
        }),
        prisma.userProgress.upsert({
          where: { userId },
          update: { xp: { increment: xpGained } },
          create: { userId, xp: xpGained },
        }),
      ]);
    }
  }

  const candidates: string[] = [];

  // Streak milestones — reuse stats.computeStreak (single source of truth).
  const streak = await computeStreak(userId);
  for (const a of ACHIEVEMENTS) {
    if (a.family === "streak" && a.threshold && streak >= a.threshold) candidates.push(a.key);
  }

  // Mastered count.
  const mastered = await masteredCount(prisma, userId);
  for (const a of ACHIEVEMENTS) {
    if (a.family === "mastered" && a.threshold && mastered >= a.threshold) candidates.push(a.key);
  }

  // Per-CEFR completion.
  const cefrDone = await fullyStartedCefrLevels(prisma, userId);
  for (const lvl of cefrDone) candidates.push(`cefr_${lvl}`);

  // Perfect session — every card correct, and a real session (>= 10 cards).
  if (session.correctCount === session.cardsReviewed && session.cardsReviewed >= 10) {
    candidates.push("perfect_session");
  }

  // Daily goal reached — today's XP has met the goal. The [userId,key] unique
  // constraint means it only ever reports the FIRST time (later sessions the same
  // day hit P2002 in unlockKeys and are dropped).
  const dateStr = todayStr();
  const [todayStat, settings] = await Promise.all([
    prisma.dailyStat.findUnique({ where: { userId_dateStr: { userId, dateStr } } }),
    prisma.settings.findUnique({ where: { userId } }),
  ]);
  const dailyGoalXp = settings?.dailyGoalXp ?? 60;
  if ((todayStat?.xp ?? 0) >= dailyGoalXp) candidates.push("goal_reached");

  // Filter against already-owned keys before inserting (no doomed re-inserts for
  // badges earned in a prior session). goal_reached is the one intentional
  // repeat-candidate: already-owned means it stays filtered, so it fires once.
  const unlocked = candidates.length
    ? await unlockKeys(userId, candidates, await existingKeys(userId))
    : [];
  return { xpGained, unlocked };
}

// ── Summary for pages/UI ─────────────────────────────────────────────
export type GamificationSummary = {
  xp: number;
  level: number;
  currentLevelXp: number;
  nextLevelXp: number;
  progress01: number;
  todayXp: number;
  dailyGoalXp: number;
  unlockedKeys: string[];
  unlockedAt: Record<string, string>;
};

export async function getGamificationSummary(userId: string): Promise<GamificationSummary> {
  // Lazy backfill: a user who reviewed before gamification existed has ReviewLogs
  // but no UserProgress.backfilledAt. Run the one-time reconstruction inline
  // before reading — acceptable one-off cost at hobby scale.
  //
  // Accepted race: if a review lands in the sub-second window between this guard
  // and the backfill writing backfilledAt, that review's live increment could be
  // double-counted by the backfill's absolute SET. The window is tiny, one-time
  // per user, and the drift is a few XP — not worth locking for at this scale.
  const progress = await prisma.userProgress.findUnique({ where: { userId } });
  if (!progress?.backfilledAt) {
    const hasLogs = (await prisma.reviewLog.count({ where: { userId } })) > 0;
    if (hasLogs) await runBackfillForUser(prisma, userId);
  }

  const [fresh, settings, achievements, todayStat] = await Promise.all([
    prisma.userProgress.findUnique({ where: { userId } }),
    prisma.settings.findUnique({ where: { userId } }),
    prisma.achievement.findMany({ where: { userId }, select: { key: true, unlockedAt: true } }),
    prisma.dailyStat.findUnique({ where: { userId_dateStr: { userId, dateStr: todayStr() } } }),
  ]);

  const xp = fresh?.xp ?? 0;
  const info = levelInfo(xp);
  const unlockedAt: Record<string, string> = {};
  for (const a of achievements) unlockedAt[a.key] = a.unlockedAt.toISOString();

  return {
    xp,
    level: info.level,
    currentLevelXp: info.currentLevelXp,
    nextLevelXp: info.nextLevelXp,
    progress01: info.progress01,
    todayXp: todayStat?.xp ?? 0,
    dailyGoalXp: settings?.dailyGoalXp ?? 60,
    unlockedKeys: achievements.map((a) => a.key),
    unlockedAt,
  };
}
