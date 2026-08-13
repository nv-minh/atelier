import "server-only";
import { prisma } from "./db";
import { previewCard, Rating, STATES } from "./fsrs";
import { addDays, formatInterval, normalizeWord, shuffle, todayStr } from "./utils";
import { awardForReview, awardForSessionEnd } from "./gamification";
import { selectNewWordIds } from "./selection/candidates";

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

// The cefr/topic word sub-filter, shared by buildStudyQueue and buildSessionPlan
// so the "how many are due" count and the actual fetch can never disagree.
export function studyWordFilter(opts: { cefr?: string; topic?: string }): Record<string, unknown> {
  const f: Record<string, unknown> = {};
  const cefr = opts.cefr && opts.cefr !== "ALL" ? opts.cefr : undefined;
  const topic = opts.topic && opts.topic !== "ALL" ? opts.topic : undefined;
  if (cefr) f.cefr = cefr;
  if (topic) f.topics = { contains: `"${topic}"` };
  return f;
}

// How many NEW cards the user has already studied today. Counted from ReviewLog
// (state 0), not from Card rows — a card stub can exist without having been seen.
export async function countNewStudiedToday(userId: string): Promise<number> {
  const today = todayStr();
  return prisma.reviewLog.count({
    where: {
      userId,
      state: 0,
      reviewedAt: { gte: new Date(today + "T00:00:00"), lte: new Date(today + "T23:59:59") },
    },
  });
}

// Due review cards (state >= 1, due <= now), soonest first.
export async function fetchDueCards(where: any, limit: number): Promise<StudyCard[]> {
  if (limit <= 0) return [];
  const rows = await prisma.card.findMany({
    where: { ...where, due: { lte: new Date() }, state: { gte: 1 } },
    include: { word: true },
    take: limit,
    orderBy: { due: "asc" },
  });
  return rows.map((c) => toStudyCard(c, false));
}

// New cards, up to `limit`: first any card already sitting in New state and due,
// then freshly created stubs for words never seen.
//
// `limit` is ABSOLUTE — this function does no daily-allowance accounting. The
// caller subtracts countNewStudiedToday. That split is what lets buildSessionPlan
// pass an already-net limit without it being subtracted a second time.
export async function fetchNewCards(
  userId: string,
  where: any,
  wordFilter: Record<string, unknown>,
  starredIds: string[] | null,
  limit: number,
  // The raw filter the learner applied, needed because it must WIN over their
  // stored profile (a C1 learner clicking cefr=A1 gets A1 words). It cannot be
  // recovered from `wordFilter`, which is already compiled to Prisma clauses.
  filter: { cefr?: string; topic?: string } = {}
): Promise<StudyCard[]> {
  if (limit <= 0) return [];
  const now = new Date();
  const out: StudyCard[] = [];

  const existingNew = await prisma.card.findMany({
    where: { ...where, state: 0, due: { lte: now } },
    include: { word: true },
    take: limit,
  });
  for (const c of existingNew) out.push(toStudyCard(c, true));

  const stillNeeded = limit - existingNew.length;
  if (stillNeeded > 0) {
    let freshIds: string[];

    if (starredIds) {
      // scope=starred keeps its original behaviour verbatim, including the
      // intersect of "starred" with "not yet seen" — spreading wordFilter would
      // let `id: { notIn }` clobber `id: { in: starredIds }`.
      const seenWordIds = (
        await prisma.card.findMany({ where: { userId }, select: { wordId: true } })
      ).map((c) => c.wordId);
      const seen = new Set(seenWordIds);
      const freshWordFilter: any = { ...wordFilter };
      freshWordFilter.id = { in: starredIds.filter((id) => !seen.has(id)) };
      const freshWords = await prisma.word.findMany({
        where: freshWordFilter,
        take: stillNeeded,
        orderBy: [{ cefr: "asc" }, { word: "asc" }],
      });
      freshIds = freshWords.map((w) => w.id);
    } else {
      // Level- and interest-aware selection. Replaces the old
      // `orderBy: [{ cefr: "asc" }, { word: "asc" }]`, which handed every
      // learner `a`, `abandon`, `ability`… regardless of their level.
      freshIds = await selectNewWordIds({
        userId,
        limit: stillNeeded,
        filter,
        baseWhere: wordFilter,
      });
    }

    for (const wordId of freshIds) {
      const card = await prisma.card.create({
        data: { userId, wordId, due: now, state: 0 },
        include: { word: true },
      });
      out.push(toStudyCard(card, true));
    }
  }
  return out;
}

// Build the study queue: due reviews first, then new cards up to the daily limit.
// Now a thin composition of the primitives above — public behaviour unchanged.
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

  const wordFilter = studyWordFilter(opts ?? {});
  // "leeches" scope has no SRS path by design — leeches are usually not due, and
  // off-schedule Good ratings would corrupt FSRS stability. Leech review is
  // cram-only (see buildCramQueue); no-op fallthrough here on purpose.
  let starredIds: string[] | null = null;
  if (opts?.scope === "starred") {
    starredIds = await getStarredWordIds(userId);
    wordFilter.id = { in: starredIds };
  }
  const where = Object.keys(wordFilter).length ? { userId, word: wordFilter } : { userId };

  const newRemaining = Math.max(0, newLimit - (await countNewStudiedToday(userId)));
  const dueStudy = await fetchDueCards(where, reviewLimit);
  const newCards = await fetchNewCards(userId, where, wordFilter, starredIds, newRemaining, {
    cefr: opts?.cefr,
    topic: opts?.topic,
  });

  const queue = [...dueStudy, ...newCards].slice(0, reviewLimit + newLimit);
  return {
    queue,
    counts: { new: newCards.length, due: dueStudy.length, total: queue.length },
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

// Canonical short definition for quiz options and matching tiles: first clause,
// trimmed, capped at 70 chars. Single source of truth — do NOT re-copy this into
// routes/components; import it.
export function truncateDef(d: string): string {
  const first = d.split(/[,.;]/)[0].trim();
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
// Selection prefers the user's due/learning words (state >= 1) that match the
// cefr/topic filter, then tops up with random words from the same filter. Within
// a single round no two items may share the same word or the same normalized
// truncated definition (that would make a tile pairing ambiguous), so we fetch a
// surplus (~3× the target) and greedily fill rounds, skipping any item that would
// collide inside the round being filled.
//
// Non-determinism is deliberate: consecutive plays (Play again / refresh) should
// not hand back the exact same tiles. The due tier is shuffled after fetch (still
// a TIER — due/learning words are drawn first — but not in strict due order), and
// the top-up samples a random window of the filtered table rather than the same
// heap-ordered head every time.
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

  // 1. Preferred: due/learning cards (state >= 1). Fetch the soonest-due window
  //    (so the drill leans toward words actually up for review), then shuffle
  //    that window so a replay isn't an identical board.
  const dueCards = await prisma.card.findMany({
    where: { userId, state: { gte: 1 }, word: wordFilter },
    include: { word: true },
    orderBy: { due: "asc" },
    take: surplus,
  });
  const dueWords = shuffle(dueCards.map((c) => mapWord(c.word)));

  // 2. Top up with random words from the filter. A bare findMany with no orderBy
  //    returns the same heap-ordered head every call and never samples the rest
  //    of the table — so pick a RANDOM offset into the (deterministically ordered)
  //    filtered set and take a surplus window from there, then shuffle it. Words
  //    already pulled from the due set are excluded so candidates don't duplicate.
  const dueWordIds = new Set(dueCards.map((c) => c.wordId));
  const fillWhere = { ...wordFilter, id: { notIn: [...dueWordIds] } };
  const fillTotal = await prisma.word.count({ where: fillWhere });
  const maxOffset = Math.max(0, fillTotal - surplus);
  const offset = maxOffset > 0 ? Math.floor(Math.random() * (maxOffset + 1)) : 0;
  const fillWords = await prisma.word.findMany({
    where: fillWhere,
    orderBy: { id: "asc" },
    skip: offset,
    take: surplus,
  });

  // Candidate order: shuffled due tier first, then the shuffled random top-up.
  const candidates: StudyWord[] = [...dueWords, ...shuffle(fillWords).map(mapWord)];

  // 3. Greedily fill rounds. A candidate can only enter a round if neither its
  //    word nor its normalized truncated def already appears in that round. Only
  //    PLACED candidates are consumed (marked used) — a candidate skipped for a
  //    round-1 collision remains available for a later round. Each round scans the
  //    still-unused candidates from the front.
  const used = new Array<boolean>(candidates.length).fill(false);
  const roundsOut: MatchingItem[][] = [];
  for (let r = 0; r < rounds; r++) {
    const round: MatchingItem[] = [];
    const usedWords = new Set<string>();
    const usedDefs = new Set<string>();
    for (let i = 0; i < candidates.length && round.length < pairs; i++) {
      if (used[i]) continue;
      const c = candidates[i];
      if (!c.definitionEn) continue;
      const def = truncateDef(c.definitionEn);
      const defKey = normalizeWord(def);
      const wordKey = normalizeWord(c.word);
      if (!def || !defKey || usedWords.has(wordKey) || usedDefs.has(defKey)) continue;
      usedWords.add(wordKey);
      usedDefs.add(defKey);
      used[i] = true;
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
