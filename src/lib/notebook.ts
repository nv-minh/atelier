import "server-only";
import { prisma } from "./db";
import { mapWord, safeJson, getStarredWordIds } from "./study-engine";

export { getStarredWordIds };

export type NotebookCardState = {
  state: number;
  reps: number;
  lapses: number;
  due: Date;
} | null;

export type NotebookEntry = {
  wordId: string;
  word: string;
  cefr: string;
  typeVi: string | null;
  typeEn: string | null;
  definitionEn: string | null;
  definitionVi: string | null;
  imageUrl: string | null;
  note: string;
  card: NotebookCardState;
};

// Upsert a user's mark for a word. When the resulting row carries no signal
// (not starred and no note), delete it to keep the table clean.
export async function setWordMark(
  userId: string,
  wordId: string,
  patch: { starred?: boolean; note?: string }
): Promise<{ starred: boolean; note: string }> {
  const data: { starred?: boolean; note?: string } = {};
  if (typeof patch.starred === "boolean") data.starred = patch.starred;
  if (typeof patch.note === "string") data.note = patch.note;

  const mark = await prisma.wordMark.upsert({
    where: { userId_wordId: { userId, wordId } },
    update: data,
    create: { userId, wordId, starred: data.starred ?? false, note: data.note ?? "" },
  });

  if (!mark.starred && mark.note === "") {
    await prisma.wordMark.delete({ where: { id: mark.id } }).catch(() => {});
    return { starred: false, note: "" };
  }

  return { starred: mark.starred, note: mark.note };
}

// Starred words with the word content + the user's card state per word.
export async function getNotebook(userId: string): Promise<NotebookEntry[]> {
  const marks = await prisma.wordMark.findMany({
    where: { userId, starred: true },
    include: { word: true },
    orderBy: { createdAt: "desc" },
  });

  const wordIds = marks.map((m) => m.wordId);
  const cards = wordIds.length
    ? await prisma.card.findMany({
        where: { userId, wordId: { in: wordIds } },
        select: { wordId: true, state: true, reps: true, lapses: true, due: true },
      })
    : [];
  const cardByWord = new Map(cards.map((c) => [c.wordId, c]));

  return marks.map((m) => {
    const c = cardByWord.get(m.wordId);
    return {
      wordId: m.wordId,
      word: m.word.word,
      cefr: m.word.cefr,
      typeVi: m.word.typeVi,
      typeEn: m.word.typeEn,
      definitionEn: m.word.definitionEn,
      definitionVi: m.word.definitionVi,
      imageUrl: m.word.imageUrl,
      note: m.note,
      card: c ? { state: c.state, reps: c.reps, lapses: c.lapses, due: c.due } : null,
    };
  });
}

export type WordDetail = {
  word: ReturnType<typeof mapWord>;
  card: {
    state: number;
    reps: number;
    lapses: number;
    due: Date;
  } | null;
  reviews: { rating: number; reviewedAt: Date }[];
  mark: { starred: boolean; note: string };
  topics: string[];
  // synonyms/antonyms filtered to entries that actually exist in the Word table
  synonyms: string[];
  antonyms: string[];
};

export async function getWordDetail(userId: string, word: string): Promise<WordDetail | null> {
  const w = await prisma.word.findUnique({ where: { word: word.toLowerCase() } });
  if (!w) return null;

  const card = await prisma.card.findUnique({
    where: { userId_wordId: { userId, wordId: w.id } },
    select: { id: true, state: true, reps: true, lapses: true, due: true },
  });

  const reviews = card
    ? await prisma.reviewLog.findMany({
        where: { cardId: card.id },
        select: { rating: true, reviewedAt: true },
        orderBy: { reviewedAt: "desc" },
        take: 50,
      })
    : [];

  const mark = await prisma.wordMark.findUnique({
    where: { userId_wordId: { userId, wordId: w.id } },
    select: { starred: true, note: true },
  });

  // Only link synonyms/antonyms that are real entries in the Word table.
  const relatedNames = [...safeJson(w.synonyms), ...safeJson(w.antonyms)];
  const existing = relatedNames.length
    ? await prisma.word.findMany({ where: { word: { in: relatedNames } }, select: { word: true } })
    : [];
  const existingSet = new Set(existing.map((e) => e.word));

  return {
    word: mapWord(w),
    card: card ? { state: card.state, reps: card.reps, lapses: card.lapses, due: card.due } : null,
    reviews,
    mark: mark ?? { starred: false, note: "" },
    topics: safeJson(w.topics),
    synonyms: safeJson(w.synonyms).filter((s) => existingSet.has(s)),
    antonyms: safeJson(w.antonyms).filter((a) => existingSet.has(a)),
  };
}
