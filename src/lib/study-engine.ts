import "server-only";
import { prisma } from "./db";
import { previewCard, Rating, STATES } from "./fsrs";
import { addDays, formatInterval, pick, shuffle, todayStr } from "./utils";

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

function mapWord(w: any): StudyWord {
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

function safeJson(s: string | null): string[] {
  if (!s) return [];
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

// Build the study queue: due reviews first, then new cards up to the daily limit.
export async function buildStudyQueue(
  userId: string,
  opts?: {
    cefr?: string;
    topic?: string;
    newLimit?: number;
    reviewLimit?: number;
  }
): Promise<{ queue: StudyCard[]; counts: { new: number; due: number; total: number } }> {
  const settings = await getSettings(userId);
  const newLimit = opts?.newLimit ?? settings.newCardsPerDay;
  const reviewLimit = opts?.reviewLimit ?? settings.reviewsPerDay;
  const cefr = opts?.cefr && opts.cefr !== "ALL" ? opts.cefr : undefined;
  const topic = opts?.topic && opts.topic !== "ALL" ? opts.topic : undefined;
  const now = new Date();

  // build the word sub-filter (cefr + topic) once
  const wordFilter: any = {};
  if (cefr) wordFilter.cefr = cefr;
  if (topic) wordFilter.topics = { contains: `"${topic}"` };
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

    const freshWords = await prisma.word.findMany({
      where: { ...wordFilter, id: { notIn: seenWordIds } },
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

  // Update daily stats
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

  return updated;
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

function truncateDef(d: string): string {
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
}): Promise<StudyWord[]> {
  const cefr = opts?.cefr && opts.cefr !== "ALL" ? opts.cefr : undefined;
  const topic = opts?.topic && opts.topic !== "ALL" ? opts.topic : undefined;
  const where: any = {};
  if (cefr) where.cefr = cefr;
  if (topic) where.topics = { contains: `"${topic}"` };
  const rows = await prisma.word.findMany({
    where,
    orderBy: [{ cefr: "asc" }, { word: "asc" }],
    take: opts?.limit ?? 30,
  });
  return rows.map(mapWord);
}

// ── Session tracking ─────────────────────────────────────────────────
export async function startSession(userId: string, mode: string, cefrFilter?: string | null) {
  return prisma.studySession.create({
    data: { userId, mode, cefrFilter: cefrFilter ?? null, startedAt: new Date() },
  });
}

export async function endSession(sessionId: string, totals: { cardsReviewed: number; correctCount: number; durationSec: number }) {
  return prisma.studySession.update({
    where: { id: sessionId },
    data: { ...totals, endedAt: new Date() },
  });
}

export async function updateSettings(
  userId: string,
  data: {
    requestRetention?: number;
    newCardsPerDay?: number;
    reviewsPerDay?: number;
    theme?: string;
  }
) {
  return prisma.settings.upsert({
    where: { userId },
    update: data,
    create: { userId, ...data },
  });
}
