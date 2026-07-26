import "server-only";
import { prisma } from "./db";
import { previewCard, Rating, STATES } from "./fsrs";
import { addDays, formatInterval, normalizeWord, pick, shuffle, todayStr } from "./utils";
import { awardForReview, awardForSessionEnd } from "./gamification";

export type StudyWord = {
  id: string;
  word: string;
  cefr: string;
  typeEn: string | null;
  typeVi: string | null;
  ipaUk: string | null;
  ipaUs: string | null;
  definitionEn: string | null;
  definitionVi: string | null;
  extraDefs: string[];
  example: string | null;
  exampleVi: string | null;
  synonyms: string[];
  antonyms: string[];
  imageUrl: string | null;
  audioUk: string | null;
  audioUs: string | null;
};

export type StudyCard = StudyWord & {
  cardId: string;
  isNew: boolean;
  due: Date;
  stability: number;
  difficulty: number;
  state: number;
  reps: number;
  lapses: number;
  elapsedDays: number;
  scheduledDays: number;
  lastReview: Date | null;
};

export type RatingPreview = {
  rating: Rating;
  label: string;
  key: string;
  interval: string;
  due: Date;
};

export function mapWord(w: any): StudyWord {
  return {
    id: w.id,
    word: w.word,
    cefr: w.cefr,
    typeEn: w.typeEn,
    typeVi: w.typeVi,
    ipaUk: w.ipaUk,
    ipaUs: w.ipaUs,
    definitionEn: w.definitionEn,
    definitionVi: w.definitionVi,
    extraDefs: safeJson(w.extraDefs),
    example: w.example,
    exampleVi: w.exampleVi,
    synonyms: safeJson(w.synonyms),
    antonyms: safeJson(w.antonyms),
    imageUrl: w.imageUrl,
    audioUk: w.audioUk,
    audioUs: w.audioUs,
  };
}

export function safeJson(s: string | null): string[] {
  if (!s) return [];
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

// The starred word ids for a user. Kept here (not in notebook.ts) so study-engine
// stays free of a circular import with notebook.ts.
export async function getStarredWordIds(userId: string): Promise<string[]> {
  const rows = await prisma.wordMark.findMany({
    where: { userId, starred: true },
    select: { wordId: true },
  });
  return rows.map((r) => r.wordId);
}

// A "leech" is a word the user keeps forgetting: enough lapses on a card that has
// left the New state. Derived, never stored. Kept here (with getStarredWordIds) so
// notebook.ts and study-engine.ts share the constant without a circular import.
export const LEECH_THRESHOLD = 4;

// Single source of truth for the leech predicate — reused by getLeechWordIds,
// getLeeches, and getLeechCount so the definition never drifts between them.
export const leechWhere = (userId: string) => ({
  userId,
  lapses: { gte: LEECH_THRESHOLD },
  state: { gte: 1 },
});

// Returns leech word ids worst-first (highest lapses), so callers that cap the
// list drill the actual worst offenders rather than an arbitrary slice.
export async function getLeechWordIds(userId: string): Promise<string[]> {
  const rows = await prisma.card.findMany({
    where: leechWhere(userId),
    select: { wordId: true },
    orderBy: { lapses: "desc" },
  });
  return rows.map((r) => r.wordId);
}

// Build the study queue: due reviews first, then new cards up to the daily limit.
export async function buildStudyQueue(
  userId: string,
  opts?: {
    cefr?: string;
    topic?: string;
    newLimit?: number;
    reviewLimit?: number;
    scope?: "starred" | "leeches";
  }
): Promise<{ queue: StudyCard[]; counts: { new: number; due: number; total: number } }> {
  const settings = await getSettings(userId);
  const newLimit = opts?.newLimit ?? settings.newCardsPerDay;
  const reviewLimit = opts?.reviewLimit ?? settings.reviewsPerDay;
  const cefr = opts?.cefr && opts.cefr !== "ALL" ? opts.cefr : undefined;
  const topic = opts?.topic && opts.topic !== "ALL" ? opts.topic : undefined;
  const now = new Date();

  // build the word sub-filter (cefr + topic + scope) once
  const wordFilter: any = {};
  if (cefr) wordFilter.cefr = cefr;
  if (topic) wordFilter.topics = { contains: `"${topic}"` };
  // Track a starred-id restriction separately so the new-card branch can
  // intersect with it instead of overwriting wordFilter.id (see below).
  let starredIds: string[] | null = null;
  if (opts?.scope === "starred") {
    starredIds = await getStarredWordIds(userId);
    wordFilter.id = { in: starredIds };
  }
  // "leeches" scope has no SRS path by design — leeches are usually not due, and
  // off-schedule Good ratings would corrupt FSRS stability. Leech review is
  // cram-only (see buildCramQueue); no-op fallthrough here on purpose.
  const where = Object.keys(wordFilter).length ? { userId, word: wordFilter } : { userId };

  // 1. Due review cards (state >= 1 and due <= now)
  const dueCards = await prisma.card.findMany({
    where: { ...where, due: { lte: now }, state: { gte: 1 } },
    include: { word: true },
    take: reviewLimit,
    orderBy: { due: "asc" },
  });

  // 2. Count how many NEW cards studied today (to respect daily new limit)
  const today = todayStr();
  const newStudiedToday = await prisma.reviewLog.count({
    where: {
      userId,
      state: 0,
      reviewedAt: { gte: new Date(today + "T00:00:00"), lte: new Date(today + "T23:59:59") },
    },
  });
  const newRemaining = Math.max(0, newLimit - newStudiedToday);

  // 3. New cards: words that have no card yet, or cards in New state (state=0) that are due
  const newCards: StudyCard[] = [];

  // Cards already created but still in New state and "due"
  const existingNew = await prisma.card.findMany({
    where: { ...where, state: 0, due: { lte: now } },
    include: { word: true },
    take: newRemaining,
  });

  for (const c of existingNew) {
    newCards.push(toStudyCard(c, true));
  }

  // Still need more new cards? Create card stubs for unseen words
  const stillNeeded = newRemaining - existingNew.length;
  if (stillNeeded > 0) {
    const seenWordIds = (
      await prisma.card.findMany({ where: { userId }, select: { wordId: true } })
    ).map((c) => c.wordId);

    // Intersect the scope's starred ids with "not yet seen" so scope=starred
    // never gets padded with arbitrary unseen words (spreading wordFilter would
    // otherwise let `id: { notIn }` clobber the `id: { in: starredIds }` filter).
    const freshWordFilter: any = { ...wordFilter };
    if (starredIds) {
      const seenSet = new Set(seenWordIds);
      freshWordFilter.id = { in: starredIds.filter((id) => !seenSet.has(id)) };
    } else {
      freshWordFilter.id = { notIn: seenWordIds };
    }

    const freshWords = await prisma.word.findMany({
      where: freshWordFilter,
      take: stillNeeded,
      orderBy: [{ cefr: "asc" }, { word: "asc" }],
    });

    for (const w of freshWords) {
      const card = await prisma.card.create({
        data: { userId, wordId: w.id, due: now, state: 0 },
        include: { word: true },
      });
      newCards.push(toStudyCard(card, true));
    }
  }

  const dueStudy: StudyCard[] = dueCards.map((c) => toStudyCard(c, false));
  const queue = [...dueStudy, ...newCards].slice(0, reviewLimit + newLimit);

  return {
    queue,
    counts: {
      new: newCards.length,
      due: dueStudy.length,
      total: queue.length,
    },
  };
}

function toStudyCard(c: any, isNew: boolean): StudyCard {
  return {
    ...mapWord(c.word),
    cardId: c.id,
    isNew,
    due: c.due,
    stability: c.stability,
    difficulty: c.difficulty,
    state: c.state,
    reps: c.reps,
    lapses: c.lapses,
    elapsedDays: c.elapsedDays,
    scheduledDays: c.scheduledDays,
    lastReview: c.lastReview,
  };
}

// Preview the 4 rating options for a card (for Again/Hard/Good/Easy buttons)
export function getRatingPreviews(card: StudyCard, now = new Date()): RatingPreview[] {
  const preview = previewCard(
    {
      due: card.due,
      stability: card.stability,
      difficulty: card.difficulty,
      elapsedDays: card.elapsedDays,
      scheduledDays: card.scheduledDays,
      reps: card.reps,
      lapses: card.lapses,
      state: card.state,
      lastReview: card.lastReview,
    },
    now
  );
  const labels: Record<number, { label: string; key: string }> = {
    [Rating.Again]: { label: "Again", key: "1" },
    [Rating.Hard]: { label: "Hard", key: "2" },
    [Rating.Good]: { label: "Good", key: "3" },
    [Rating.Easy]: { label: "Easy", key: "4" },
  };
  const sched = preview as unknown as Record<number, { card: { due: Date } }>;
  return [Rating.Again, Rating.Hard, Rating.Good, Rating.Easy].map((r) => {
    const s = sched[r].card;
    return {
      rating: r,
      label: labels[r].label,
      key: labels[r].key,
      interval: formatInterval(s.due, now),
      due: s.due,
    };
  });
}

// Record a review: apply FSRS, update card, write log, update daily stats
export async function recordReview(userId: string, cardId: string, rating: Rating, correct = true) {
  const now = new Date();
  const card = await prisma.card.findUnique({ where: { id: cardId } });
  if (!card || card.userId !== userId) return null;

  const { applyRating } = await import("./fsrs");
  const updated = applyRating(
    {
      due: card.due,
      stability: card.stability,
      difficulty: card.difficulty,
      elapsedDays: card.elapsedDays,
      scheduledDays: card.scheduledDays,
      reps: card.reps,
      lapses: card.lapses,
      state: card.state,
      lastReview: card.lastReview,
    },
    rating,
    now
  );

  const wasNew = card.state === 0;
  await prisma.card.update({ where: { id: cardId }, data: updated });

  await prisma.reviewLog.create({
    data: {
      cardId,
      userId,
      rating,
      state: updated.state,
      stability: updated.stability,
      difficulty: updated.difficulty,
      elapsedDays: updated.elapsedDays,
      scheduledDays: updated.scheduledDays,
    },
  });

  // Update daily stats (non-XP fields). The XP ledgers (DailyStat.xp +
  // UserProgress.xp) are incremented together inside awardForReview's
  // transaction, keyed on this SAME dateStr so the day never splits.
  const dateStr = todayStr();
  const isNewContribution = wasNew ? 1 : 0;
  const isReviewContribution = !wasNew ? 1 : 0;
  await prisma.dailyStat.upsert({
    where: { userId_dateStr: { userId, dateStr } },
    update: {
      newCards: { increment: isNewContribution },
      reviews: { increment: isReviewContribution },
      correctCount: { increment: correct ? 1 : 0 },
      totalCount: { increment: 1 },
    },
    create: {
      userId,
      dateStr,
      newCards: isNewContribution,
      reviews: isReviewContribution,
      correctCount: correct ? 1 : 0,
      totalCount: 1,
    },
  });

  // Gamification is best-effort: the review is already committed above, so a
  // gamification failure must never 500 the request or lose the review. Fall
  // back to a zero award and log for diagnosis.
  let award = { xpGained: 0, unlocked: [] as string[], leveledUp: null as number | null };
  try {
    award = await awardForReview(userId, rating, dateStr);
  } catch (e) {
    console.error("awardForReview failed (review already recorded):", e);
  }
  return { ...updated, ...award };
}

// ---------- Quiz distractor generation ----------
export async function getQuizDistractors(correct: StudyWord, n = 3): Promise<string[]> {
  const pool = await prisma.word.findMany({
    where: { cefr: correct.cefr, word: { not: correct.word } },
    select: { definitionEn: true, word: true },
    take: 60,
  });
  const valid = pool.filter((p) => p.definitionEn && p.definitionEn.length > 8);
  return pick(valid, n).map((p) => truncateDef(p.definitionEn!));
}

export function truncateDef(d: string): string {
  const first = d.split(/[,.;]/)[0];
  return first.length > 70 ? first.slice(0, 67) + "…" : first;
}

export async function getSettings(userId: string) {
  const s = await prisma.settings.findUnique({ where: { userId } });
  if (s) return s;
  return await prisma.settings.create({ data: { userId } });
}

// ── Cram mode: free practice, no SRS writes ──────────────────────────
export async function buildCramQueue(opts?: {
  cefr?: string;
  topic?: string;
  limit?: number;
  userId?: string;
  scope?: "starred" | "leeches";
}): Promise<StudyWord[]> {
  const cefr = opts?.cefr && opts.cefr !== "ALL" ? opts.cefr : undefined;
  const topic = opts?.topic && opts.topic !== "ALL" ? opts.topic : undefined;
  const where: any = {};
  if (cefr) where.cefr = cefr;
  if (topic) where.topics = { contains: `"${topic}"` };
  let leechOrder: string[] | null = null;
  if (opts?.scope === "starred" && opts.userId) {
    const ids = await getStarredWordIds(opts.userId);
    where.id = { in: ids };
  } else if (opts?.scope === "leeches" && opts.userId) {
    leechOrder = await getLeechWordIds(opts.userId);
    where.id = { in: leechOrder };
  }
  const limit = opts?.limit ?? 30;

  // Leeches drill worst-first: fetch all matches (findMany can't order by the id
  // list), restore the lapses-desc order from getLeechWordIds, then cap — so >30
  // leeches drill the worst offenders, not an alphabetical slice.
  if (leechOrder) {
    const rows = await prisma.word.findMany({ where });
    const rank = new Map(leechOrder.map((id, i) => [id, i]));
    rows.sort((a, b) => (rank.get(a.id) ?? Infinity) - (rank.get(b.id) ?? Infinity));
    return rows.slice(0, limit).map(mapWord);
  }

  const rows = await prisma.word.findMany({
    where,
    orderBy: [{ cefr: "asc" }, { word: "asc" }],
    take: limit,
  });
  return rows.map(mapWord);
}

// ── Matching game pool ───────────────────────────────────────────────
export type MatchingItem = { wordId: string; word: string; def: string };

// Build `rounds` arrays of `pairs` word↔definition items for the matching game.
// Selection prefers the user's due/learning words (state >= 1, due soonest) that
// match the cefr/topic filter, then tops up with random words from the same
// filter. Within a single round no two items may share the same word or the same
// normalized truncated definition (that would make a tile pairing ambiguous), so
// we fetch a surplus (~3× the target) and greedily fill rounds, skipping any item
// that would collide inside the round being filled.
//
// Degrades gracefully: if the filtered pool is too small (or too many defs
// collide) to fill every round, it returns as many COMPLETE rounds as it could
// build — possibly fewer than `rounds`, possibly zero. The page treats an empty
// result (or a first round smaller than `pairs`) as "not enough words".
export async function buildMatchingPool(
  userId: string,
  opts: { cefr?: string; topic?: string; pairs?: number; rounds?: number } = {}
): Promise<MatchingItem[][]> {
  const pairs = opts.pairs ?? 6;
  const rounds = opts.rounds ?? 4;
  const cefr = opts.cefr && opts.cefr !== "ALL" ? opts.cefr : undefined;
  const topic = opts.topic && opts.topic !== "ALL" ? opts.topic : undefined;

  const wordFilter: any = {};
  if (cefr) wordFilter.cefr = cefr;
  if (topic) wordFilter.topics = { contains: `"${topic}"` };
  // Only words with a usable English definition can produce a definition tile.
  wordFilter.definitionEn = { not: null };

  const need = pairs * rounds;
  const surplus = Math.max(need * 3, need + pairs); // headroom for collisions

  // 1. Preferred: due/learning cards (state >= 1), soonest-due first.
  const dueCards = await prisma.card.findMany({
    where: { userId, state: { gte: 1 }, word: wordFilter },
    include: { word: true },
    orderBy: { due: "asc" },
    take: surplus,
  });

  // 2. Top up with random words from the filter. Fetch a generous slice then
  //    shuffle (same fetch-then-shuffle pattern used elsewhere), excluding words
  //    already pulled from the due set so we don't duplicate candidates.
  const dueWordIds = new Set(dueCards.map((c) => c.wordId));
  const fillWords = await prisma.word.findMany({
    where: { ...wordFilter, id: { notIn: [...dueWordIds] } },
    take: surplus,
  });

  // Candidate order: due words first (already due-sorted), then a shuffled fill.
  const candidates: StudyWord[] = [
    ...dueCards.map((c) => mapWord(c.word)),
    ...shuffle(fillWords).map(mapWord),
  ];

  // 3. Greedily fill rounds. A candidate can only go into a round if neither its
  //    word nor its normalized truncated def already appears in that round. Each
  //    candidate is used at most once across the whole game (consumed on place).
  const roundsOut: MatchingItem[][] = [];
  let cursor = 0;
  for (let r = 0; r < rounds; r++) {
    const round: MatchingItem[] = [];
    const usedWords = new Set<string>();
    const usedDefs = new Set<string>();
    while (round.length < pairs && cursor < candidates.length) {
      const c = candidates[cursor++];
      if (!c.definitionEn) continue;
      const def = truncateDef(c.definitionEn);
      const defKey = normalizeWord(def);
      const wordKey = normalizeWord(c.word);
      if (!def || !defKey || usedWords.has(wordKey) || usedDefs.has(defKey)) continue;
      usedWords.add(wordKey);
      usedDefs.add(defKey);
      round.push({ wordId: c.id, word: c.word, def });
    }
    if (round.length === pairs) roundsOut.push(round);
    else break; // ran out of collision-free candidates — return complete rounds only
  }
  return roundsOut;
}

// ── Session tracking ─────────────────────────────────────────────────
export async function startSession(userId: string, mode: string, cefrFilter?: string | null) {
  return prisma.studySession.create({
    data: { userId, mode, cefrFilter: cefrFilter ?? null, startedAt: new Date() },
  });
}

// End a session and award session-level gamification. Validates ownership: the
// session row carries a userId; a mismatch (or missing row) is refused so one
// user can't end — or earn XP from — another user's session.
export async function endSession(
  userId: string,
  sessionId: string,
  totals: { cardsReviewed: number; correctCount: number; durationSec: number }
): Promise<{ ok: false } | { ok: true; xpGained: number; unlocked: string[] }> {
  const existing = await prisma.studySession.findUnique({ where: { id: sessionId } });
  if (!existing || existing.userId !== userId) return { ok: false };

  const session = await prisma.studySession.update({
    where: { id: sessionId },
    data: { ...totals, endedAt: new Date() },
  });

  // Best-effort: the session is already ended above; a gamification failure must
  // not fail the request. Fall back to a zero award and log.
  let award = { xpGained: 0, unlocked: [] as string[] };
  try {
    award = await awardForSessionEnd(userId, {
      mode: session.mode,
      cardsReviewed: session.cardsReviewed,
      correctCount: session.correctCount,
    });
  } catch (e) {
    console.error("awardForSessionEnd failed (session already ended):", e);
  }
  return { ok: true, xpGained: award.xpGained, unlocked: award.unlocked };
}

export async function updateSettings(
  userId: string,
  data: {
    requestRetention?: number;
    newCardsPerDay?: number;
    reviewsPerDay?: number;
    theme?: string;
    dailyGoalXp?: number;
  }
) {
  return prisma.settings.upsert({
    where: { userId },
    update: data,
    create: { userId, ...data },
  });
}
