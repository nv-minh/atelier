import "server-only";
import { unstable_cache } from "next/cache";
import { prisma } from "./db";
import { TOPICS, topicBySlug, type Topic } from "./topic-taxonomy";
import { parseJsonArray } from "./utils";

export type TopicSummary = Topic & { count: number; preview: string[] };

export type TopicWord = {
  id: string;
  word: string;
  cefr: string;
  typeEn: string | null;
  typeVi: string | null;
  ipaUk: string | null;
  ipaUs: string | null;
  definitionEn: string | null;
  definitionVi: string | null;
  example: string | null;
  exampleVi: string | null;
  synonyms: string[];
  antonyms: string[];
  imageUrl: string | null;
  audioUk: string | null;
  audioUs: string | null;
};

// Per-topic counts and previews are derived from a FULL scan of the Word table
// (single pass, but every row). The result only changes on a pack import, which
// is rare — so cache it for an hour instead of re-scanning on every /topics hit.
export const getTopics = unstable_cache(
  async (): Promise<TopicSummary[]> => {
    // Single query: derive per-topic counts AND preview words in one pass.
    // (Previously 1 + 18 = 19 queries.)
    const rows = await prisma.word.findMany({
      select: { word: true, cefr: true, topics: true },
      orderBy: [{ cefr: "asc" }, { word: "asc" }],
    });

    const counts: Record<string, number> = {};
    const preview: Record<string, string[]> = {};
    for (const r of rows) {
      const topics = parseJsonArray(r.topics);
      for (const slug of topics) {
        counts[slug] = (counts[slug] ?? 0) + 1;
        // rows are already ordered by cefr,word — keep first 4 per topic as preview
        if ((preview[slug]?.length ?? 0) < 4) {
          (preview[slug] ??= []).push(r.word);
        }
      }
    }

    return TOPICS.map((t) => ({
      ...t,
      count: counts[t.slug] ?? 0,
      preview: preview[t.slug] ?? [],
    })).sort((a, b) => b.count - a.count);
  },
  ["topics-summary-v1"],
  { revalidate: 3600 }
);

export async function getTopicWords(slug: string, limit = 60): Promise<{ topic: Topic; words: TopicWord[]; total: number }> {
  const topic = topicBySlug(slug);
  if (!topic) return { topic: null as any, words: [], total: 0 };

  const where = { topics: { contains: `"${slug}"` } };
  const [rows, total] = await Promise.all([
    prisma.word.findMany({
      where,
      orderBy: [{ cefr: "asc" }, { word: "asc" }],
      take: limit,
    }),
    prisma.word.count({ where }),
  ]);

  const words: TopicWord[] = rows.map((w) => ({
    id: w.id,
    word: w.word,
    cefr: w.cefr,
    typeEn: w.typeEn,
    typeVi: w.typeVi,
    ipaUk: w.ipaUk,
    ipaUs: w.ipaUs,
    definitionEn: w.definitionEn,
    definitionVi: w.definitionVi,
    example: w.example,
    exampleVi: w.exampleVi,
    synonyms: parseJsonArray(w.synonyms),
    antonyms: parseJsonArray(w.antonyms),
    imageUrl: w.imageUrl,
    audioUk: w.audioUk,
    audioUs: w.audioUs,
  }));

  return { topic, words, total };
}
