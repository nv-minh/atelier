import "server-only";
import { prisma } from "@/lib/db";
import {
  countNewStudiedToday,
  fetchDueCards,
  fetchNewCards,
  getSettings,
  getStarredWordIds,
  studyWordFilter,
  type StudyCard,
} from "@/lib/study-engine";
import { deriveSessionLimits } from "./session-limits";
import type { PracticeItem, PracticeMode, SessionPlan } from "./types";

export const DEFAULT_SESSION_SIZE = 15;
const MAX_SESSION_SIZE = 200;

// Parse ?size= from a URL. Anything unparseable falls back to the default rather
// than to "all" — a typo must never hand the user a 220-card session (defect D5).
export function parseSize(raw: string | undefined): number | "all" {
  if (raw === "all") return "all";
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_SESSION_SIZE;
  return Math.min(MAX_SESSION_SIZE, Math.floor(n));
}

function toPracticeItem(c: StudyCard, starred: boolean): PracticeItem {
  return {
    cardId: c.cardId,
    wordId: c.id,
    word: c.word,
    cefr: c.cefr,
    typeEn: c.typeEn,
    typeVi: c.typeVi,
    ipaUk: c.ipaUk,
    ipaUs: c.ipaUs,
    definitionEn: c.definitionEn,
    definitionVi: c.definitionVi,
    extraDefs: c.extraDefs,
    example: c.example,
    exampleVi: c.exampleVi,
    synonyms: c.synonyms,
    antonyms: c.antonyms,
    imageUrl: c.imageUrl,
    audioUk: c.audioUk,
    audioUs: c.audioUs,
    starred,
    isNew: c.isNew,
    state: c.state,
    reps: c.reps,
    lapses: c.lapses,
    stability: c.stability,
    difficulty: c.difficulty,
    elapsedDays: c.elapsedDays,
    scheduledDays: c.scheduledDays,
    due: c.due.toISOString(),
    lastReview: c.lastReview ? c.lastReview.toISOString() : null,
  };
}

/**
 * Build a BOUNDED practice session: at most `size` cards, due-first.
 *
 * This is a layer ON TOP of the FSRS daily budget, not a replacement for it —
 * newCardsPerDay / reviewsPerDay still cap the day. It counts what is available
 * first and only then fetches, so the card-stub creation inside fetchNewCards
 * never runs for cards this session will not show (defect D5).
 */
export async function buildSessionPlan(
  userId: string,
  opts: {
    mode: PracticeMode;
    cefr?: string;
    topic?: string;
    size: number | "all";
    scope?: "starred";
  }
): Promise<SessionPlan> {
  const settings = await getSettings(userId);

  const wordFilter = studyWordFilter(opts);
  let starredIds: string[] | null = null;
  if (opts.scope === "starred") {
    starredIds = await getStarredWordIds(userId);
    wordFilter.id = { in: starredIds };
  }
  const where = Object.keys(wordFilter).length ? { userId, word: wordFilter } : { userId };

  const dueAvailable = await prisma.card.count({
    where: { ...where, due: { lte: new Date() }, state: { gte: 1 } },
  });
  const newAllowanceToday = Math.max(
    0,
    settings.newCardsPerDay - (await countNewStudiedToday(userId))
  );

  // Two-pass derive: the floor can promise new slots that no new cards exist
  // to fill (user has learned every word in the filter scope). Fetch new
  // FIRST with the budget, then re-derive with the REAL count so review fills
  // any slots the new cards couldn't — a floor must never shrink a session.
  const budget = deriveSessionLimits({
    size: opts.size,
    dueAvailable,
    newAllowanceToday,
    dailyReviewLimit: settings.reviewsPerDay,
  });
  const newCards = await fetchNewCards(userId, where, wordFilter, starredIds, budget.newLimit);
  const actual = deriveSessionLimits({
    size: opts.size,
    dueAvailable,
    newAllowanceToday: newCards.length,
    dailyReviewLimit: settings.reviewsPerDay,
  });
  const dueCards = await fetchDueCards(where, actual.reviewLimit);
  // Display order is due-first: the join order decides what the user sees,
  // not the fetch order. (`size: "all"` is safe here — its branch ignores
  // newAllowanceToday when computing reviewLimit, so actual.reviewLimit equals
  // budget.reviewLimit; actual.newLimit is never read. No special-case needed.)
  const queue = [...dueCards, ...newCards];

  const starred = new Set(
    (
      await prisma.wordMark.findMany({
        where: { userId, starred: true, wordId: { in: queue.map((c) => c.id) } },
        select: { wordId: true },
      })
    ).map((m) => m.wordId)
  );

  return {
    items: queue.map((c) => toPracticeItem(c, starred.has(c.id))),
    remaining: {
      due: Math.max(0, dueAvailable - dueCards.length),
      new: Math.max(0, newAllowanceToday - newCards.length),
    },
    sizeUsed: queue.length,
  };
}
