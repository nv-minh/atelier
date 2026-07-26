import "server-only";
import { prisma } from "./db";
import { todayStr, addDays } from "./utils";
import { computeStreakFromDb } from "./gamification-checks";

export async function getDashboardStats(userId: string) {
  const now = new Date();
  const totalWords = await prisma.word.count();

  // Cards by state
  const cardsByState = await prisma.card.groupBy({
    by: ["state"],
    _count: true,
    where: { userId },
  });
  const stateCount: Record<number, number> = {};
  for (const s of cardsByState) stateCount[s.state] = s._count;
  const totalCards = await prisma.card.count({ where: { userId } });
  const learnedCards = (stateCount[2] ?? 0) + (stateCount[3] ?? 0); // Review + Relearning
  const learningCards = stateCount[1] ?? 0;
  const newCardsSeen = stateCount[0] ?? 0; // still new (seen but not graduated)

  // Due today
  const dueToday = await prisma.card.count({
    where: { userId, due: { lte: now }, state: { gte: 1 } },
  });

  // CEFR breakdown — 2 queries instead of 12 (was N+1 loop).
  const cefrLevels = ["A1", "A2", "B1", "B2"];
  const [wordByCefr, cardsWithCefr] = await Promise.all([
    prisma.word.groupBy({ by: ["cefr"], _count: true }),
    prisma.card.findMany({
      where: { userId },
      select: { state: true, word: { select: { cefr: true } } },
    }),
  ]);
  const wordTotals: Record<string, number> = {};
  for (const g of wordByCefr) wordTotals[g.cefr] = g._count;
  const learnedByCefr: Record<string, number> = {};
  const learningByCefr: Record<string, number> = {};
  for (const c of cardsWithCefr) {
    const lvl = c.word.cefr;
    if (c.state === 2 || c.state === 3) learnedByCefr[lvl] = (learnedByCefr[lvl] ?? 0) + 1;
    else learningByCefr[lvl] = (learningByCefr[lvl] ?? 0) + 1;
  }
  const cefrStats = cefrLevels.map((level) => {
    const total = wordTotals[level] ?? 0;
    const learned = learnedByCefr[level] ?? 0;
    const learning = learningByCefr[level] ?? 0;
    return { level, total, learned, learning, unseen: total - learned - learning };
  });

  // Today's stats
  const today = todayStr();
  const todayStat = await prisma.dailyStat.findUnique({
    where: { userId_dateStr: { userId, dateStr: today } },
  });

  // Streak: count consecutive days with activity ending today or yesterday
  const streak = await computeStreak(userId);

  // Accuracy (last 100 reviews)
  const recentReviews = await prisma.reviewLog.findMany({
    where: { userId },
    orderBy: { reviewedAt: "desc" },
    take: 100,
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

// Monday of the ISO week containing `d`, in UTC (matches todayStr's UTC
// convention). getUTCDay: Sun=0..Sat=6; shift so Monday is the anchor.
function isoWeekMonday(d = new Date()): Date {
  const base = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dow = base.getUTCDay(); // 0=Sun
  const back = dow === 0 ? 6 : dow - 1; // days since Monday
  return addDays(base, -back);
}

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
    bucket.xp += s.xp;
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
