import "server-only";
import { prisma } from "./db";
import { todayStr, addDays, isoWeekMonday } from "./utils";
import { totalXp } from "./gamification-defs";
import { computeStreakFromDb } from "./gamification-checks";
import { CEFR_LEVELS } from "./export-format";
import { LEARNED_STATES } from "./fsrs";

// One row per (cefr, state) combination the user has any cards in — at most
// ~6 CEFR levels x 4 states, never O(cards). Replaces a `findMany` that used
// to return every Card the user has ever touched (up to the full vocabulary
// size) just to bucket it by cefr+state in JS. userId is passed as a tagged-
// template parameter, so Prisma parameterizes it — not string interpolation.
type CefrStateCount = { cefr: string; state: number; count: number };
async function cardCountsByCefrAndState(userId: string): Promise<CefrStateCount[]> {
  const rows = await prisma.$queryRaw<{ cefr: string; state: number; count: bigint }[]>`
    SELECT w.cefr AS cefr, c.state AS state, COUNT(*)::int AS count
    FROM "Card" c
    JOIN "Word" w ON w.id = c."wordId"
    WHERE c."userId" = ${userId}
    GROUP BY w.cefr, c.state
  `;
  return rows.map((r) => ({ cefr: r.cefr, state: r.state, count: Number(r.count) }));
}

export async function getDashboardStats(userId: string) {
  const now = new Date();
  const today = todayStr();
  const cefrLevels = [...CEFR_LEVELS];

  // Every query below is independent of the others — run them together instead
  // of as 9 sequential awaits. Each round trip to serverless Postgres is paid
  // in full on the home page's first paint.
  const [
    totalWords,
    cardsByState,
    totalCards,
    dueToday,
    wordByCefr,
    cefrStateCounts,
    todayStat,
    streak,
    recentReviews,
  ] = await Promise.all([
    prisma.word.count(),
    prisma.card.groupBy({ by: ["state"], _count: true, where: { userId } }),
    prisma.card.count({ where: { userId } }),
    prisma.card.count({ where: { userId, due: { lte: now }, state: { gte: 1 } } }),
    prisma.word.groupBy({ by: ["cefr"], _count: true }),
    cardCountsByCefrAndState(userId),
    prisma.dailyStat.findUnique({ where: { userId_dateStr: { userId, dateStr: today } } }),
    computeStreak(userId),
    // Accuracy (last 100 reviews)
    prisma.reviewLog.findMany({ where: { userId }, orderBy: { reviewedAt: "desc" }, take: 100 }),
  ]);

  const stateCount: Record<number, number> = {};
  for (const s of cardsByState) stateCount[s.state] = s._count;
  const learnedCards = LEARNED_STATES.reduce((n, s) => n + (stateCount[s] ?? 0), 0);
  const learningCards = stateCount[1] ?? 0;
  const newCardsSeen = stateCount[0] ?? 0; // still new (seen but not graduated)

  // CEFR breakdown
  const wordTotals: Record<string, number> = {};
  for (const g of wordByCefr) wordTotals[g.cefr] = g._count;
  const learnedByCefr: Record<string, number> = {};
  const learningByCefr: Record<string, number> = {};
  const LEARNED = new Set<number>(LEARNED_STATES);
  for (const c of cefrStateCounts) {
    if (LEARNED.has(c.state)) learnedByCefr[c.cefr] = (learnedByCefr[c.cefr] ?? 0) + c.count;
    else learningByCefr[c.cefr] = (learningByCefr[c.cefr] ?? 0) + c.count;
  }
  const cefrStats = cefrLevels.map((level) => {
    const total = wordTotals[level] ?? 0;
    const learned = learnedByCefr[level] ?? 0;
    const learning = learningByCefr[level] ?? 0;
    return { level, total, learned, learning, unseen: total - learned - learning };
  });

  const accuracy =
    recentReviews.length > 0
      ? (recentReviews.filter((r) => r.rating >= 3).length / recentReviews.length) * 100
      : 0;

  return {
    totalWords,
    totalCards,
    learnedCards,
    learningCards,
    newCardsSeen,
    dueToday,
    cefrStats,
    today: {
      newCards: todayStat?.newCards ?? 0,
      reviews: todayStat?.reviews ?? 0,
      correctCount: todayStat?.correctCount ?? 0,
      totalCount: todayStat?.totalCount ?? 0,
      accuracy:
        todayStat && todayStat.totalCount > 0
          ? (todayStat.correctCount / todayStat.totalCount) * 100
          : 0,
    },
    streak,
    accuracy,
  };
}

// Single source of truth lives in gamification-checks.computeStreakFromDb (a
// non-server-only module so the tsx backfill can call it too). This server-only
// wrapper just binds the app's prisma singleton — no duplicated algorithm.
export const computeStreak = (userId: string): Promise<number> =>
  computeStreakFromDb(prisma, userId);

// Activity heatmap data: last 365 days
export async function getActivityHeatmap(userId: string, days = 365) {
  const start = addDays(new Date(), -(days - 1));
  const startStr = todayStr(start);
  const stats = await prisma.dailyStat.findMany({
    where: { userId, dateStr: { gte: startStr } },
    orderBy: { dateStr: "asc" },
  });
  const map = new Map(stats.map((s) => [s.dateStr, s]));
  const out = [];
  for (let i = 0; i < days; i++) {
    const d = addDays(start, i);
    const ds = todayStr(d);
    const s = map.get(ds);
    out.push({
      date: ds,
      count: s ? s.newCards + s.reviews : 0,
      newCards: s?.newCards ?? 0,
      reviews: s?.reviews ?? 0,
      day: d.getDay(),
    });
  }
  return out;
}

// Review forecast for next N days
export async function getForecast(userId: string, days = 30) {
  const now = new Date();
  const due = await prisma.card.findMany({
    where: { userId, state: { gte: 1 }, due: { gte: now } },
    select: { due: true },
    take: 5000,
  });
  const buckets: Record<string, number> = {};
  for (let i = 0; i < days; i++) {
    buckets[todayStr(addDays(now, i))] = 0;
  }
  for (const c of due) {
    const ds = todayStr(c.due);
    if (ds in buckets) buckets[ds] += 1;
  }
  return Object.entries(buckets).map(([date, count]) => ({ date, count }));
}

// ── Weekly recap: this ISO week (Mon–Sun) vs last week ───────────────
export type WeekTotals = {
  reviews: number;
  newCards: number;
  timeSec: number;
  xp: number;
  correct: number;
  total: number;
  accuracy: number; // 0..100
};

export type WeeklyRecap = {
  thisWeek: WeekTotals;
  lastWeek: WeekTotals;
  delta: { reviews: number; newCards: number; timeSec: number; xp: number; accuracy: number };
};

function emptyWeek(): WeekTotals {
  return { reviews: 0, newCards: 0, timeSec: 0, xp: 0, correct: 0, total: 0, accuracy: 0 };
}

export async function getWeeklyRecap(userId: string): Promise<WeeklyRecap> {
  const thisMonday = isoWeekMonday();
  const lastMonday = addDays(thisMonday, -7);
  // Window spans last-week Monday through this-week Sunday (14 days).
  const windowStart = todayStr(lastMonday);
  const stats = await prisma.dailyStat.findMany({
    where: { userId, dateStr: { gte: windowStart } },
    select: {
      dateStr: true,
      reviews: true,
      newCards: true,
      timeSec: true,
      xp: true,
      bonusXp: true,
      correctCount: true,
      totalCount: true,
    },
  });

  const thisWeekStart = todayStr(thisMonday);
  const thisWeek = emptyWeek();
  const lastWeek = emptyWeek();
  for (const s of stats) {
    const bucket = s.dateStr >= thisWeekStart ? thisWeek : lastWeek;
    bucket.reviews += s.reviews;
    bucket.newCards += s.newCards;
    bucket.timeSec += s.timeSec;
    // Total XP for the week = ReviewLog-derived xp + non-SRS bonusXp (matching, …),
    // via totalXp so it matches how the summary/level compute total.
    bucket.xp += totalXp(s);
    bucket.correct += s.correctCount;
    bucket.total += s.totalCount;
  }
  for (const w of [thisWeek, lastWeek]) {
    w.accuracy = w.total > 0 ? (w.correct / w.total) * 100 : 0;
  }

  return {
    thisWeek,
    lastWeek,
    delta: {
      reviews: thisWeek.reviews - lastWeek.reviews,
      newCards: thisWeek.newCards - lastWeek.newCards,
      timeSec: thisWeek.timeSec - lastWeek.timeSec,
      xp: thisWeek.xp - lastWeek.xp,
      accuracy: thisWeek.accuracy - lastWeek.accuracy,
    },
  };
}

// Accuracy over time (per day, last 30 days)
export async function getAccuracyTrend(userId: string, days = 30) {
  const start = addDays(new Date(), -(days - 1));
  const stats = await prisma.dailyStat.findMany({
    where: { userId, dateStr: { gte: todayStr(start) }, totalCount: { gt: 0 } },
    orderBy: { dateStr: "asc" },
  });
  return stats.map((s) => ({
    date: s.dateStr,
    accuracy: (s.correctCount / s.totalCount) * 100,
    count: s.totalCount,
  }));
}
