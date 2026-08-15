// Server-side reads for the grammar pages. Pages call these directly (server
// components query prisma, no API hop — same pattern as topics-data.ts).
import { prisma } from "@/lib/db";
import { masteryPct } from "./mastery";

const CLUSTER_ORDER = ["tenses", "word-classes", "sentence", "other"] as const;

export type TopicCard = {
  id: number;
  slug: string;
  nameEn: string;
  nameVi: string | null;
  cluster: string;
  order: number;
  lessonsTotal: number;
  lessonsRead: number;
  testQuestionCount: number;
  answered: number;
  mastery: number | null;
};

export type GrammarHub = {
  clusters: { key: string; topics: TopicCard[] }[];
  continueTarget: {
    topicSlug: string;
    topicNameEn: string;
    topicNameVi: string | null;
    lessonOrder: number;
    lessonTitleEn: string;
    lessonTitleVi: string | null;
  } | null;
  totals: { lessonsRead: number; lessonsTotal: number; answered: number };
};

// One round trip per aggregate, all cheap: 33 topics, 292 lesson stubs, two
// groupBys, and (when signed in) the user's read-marks + progress rows.
async function loadTopicCards(userId: string | null): Promise<{
  cards: TopicCard[];
  lessonStubs: { id: number; topicId: number; order: number }[];
  readIds: Set<number>;
}> {
  const [topics, lessonStubs, lessonCounts, questionCounts] = await Promise.all([
    prisma.grammarTopic.findMany({ orderBy: [{ cluster: "asc" }, { order: "asc" }] }),
    prisma.grammarLesson.findMany({ select: { id: true, topicId: true, order: true } }),
    prisma.grammarLesson.groupBy({ by: ["topicId"], _count: { _all: true } }),
    prisma.grammarTestQuestion.groupBy({ by: ["topicId"], _count: { _all: true } }),
  ]);
  const [reads, progress] = userId
    ? await Promise.all([
        prisma.grammarLessonRead.findMany({ where: { userId }, select: { lessonId: true } }),
        prisma.grammarTopicProgress.findMany({ where: { userId } }),
      ])
    : [[], []];

  const lessonsByTopic = new Map(lessonCounts.map((r) => [r.topicId, r._count._all]));
  const questionsByTopic = new Map(questionCounts.map((r) => [r.topicId, r._count._all]));
  const readIds = new Set(reads.map((r) => r.lessonId));
  const topicOfLesson = new Map(lessonStubs.map((l) => [l.id, l.topicId]));
  const readByTopic = new Map<number, number>();
  for (const id of readIds) {
    const t = topicOfLesson.get(id);
    if (t != null) readByTopic.set(t, (readByTopic.get(t) ?? 0) + 1);
  }
  const progressByTopic = new Map(progress.map((p) => [p.topicId, p]));

  const cards: TopicCard[] = topics.map((t) => {
    const lessonsTotal = lessonsByTopic.get(t.id) ?? 0;
    const lessonsRead = readByTopic.get(t.id) ?? 0;
    const p = progressByTopic.get(t.id);
    return {
      id: t.id,
      slug: t.slug,
      nameEn: t.nameEn,
      nameVi: t.nameVi,
      cluster: t.cluster,
      order: t.order,
      lessonsTotal,
      lessonsRead,
      testQuestionCount: questionsByTopic.get(t.id) ?? 0,
      answered: p?.answered ?? 0,
      mastery: masteryPct({
        lessonsRead,
        lessonsTotal,
        recent: p?.recent ?? [],
        answered: p?.answered ?? 0,
      }),
    };
  });
  return { cards, lessonStubs, readIds };
}

export async function getGrammarHub(userId: string | null): Promise<GrammarHub> {
  const { cards, lessonStubs, readIds } = await loadTopicCards(userId);

  const clusters = CLUSTER_ORDER.map((key) => ({
    key,
    topics: cards.filter((c) => c.cluster === key),
  })).filter((c) => c.topics.length > 0);

  // "Continue": the first unread lesson of the most-recently-read topic; when
  // the user has read nothing yet, the very first lesson of the first topic.
  let continueTarget: GrammarHub["continueTarget"] = null;
  const lastRead = userId
    ? await prisma.grammarLessonRead.findFirst({
        where: { userId },
        orderBy: { readAt: "desc" },
        select: { lessonId: true },
      })
    : null;
  const cardById = new Map(cards.map((c) => [c.id, c]));
  const pickLesson = async (topicId: number): Promise<{ topicId: number; order: number } | null> => {
    const next = lessonStubs
      .filter((l) => l.topicId === topicId && !readIds.has(l.id))
      .sort((a, b) => a.order - b.order)[0];
    return next ? { topicId, order: next.order } : null;
  };
  let target: { topicId: number; order: number } | null = null;
  if (lastRead) {
    const lastTopic = lessonStubs.find((l) => l.id === lastRead.lessonId)?.topicId;
    if (lastTopic != null) target = await pickLesson(lastTopic);
  }
  if (!target) {
    // First topic with an unread lesson, in pedagogical CLUSTER_ORDER — the
    // prisma sort above is alphabetical on the cluster string ("other" first).
    const orderedCards = CLUSTER_ORDER.flatMap((k) => cards.filter((c) => c.cluster === k));
    for (const c of orderedCards) {
      target = await pickLesson(c.id);
      if (target) break;
    }
  }
  if (target) {
    const lesson = await prisma.grammarLesson.findUnique({
      where: { topicId_order: { topicId: target.topicId, order: target.order } },
      select: { order: true, titleEn: true, titleVi: true },
    });
    const card = cardById.get(target.topicId);
    if (lesson && card) {
      continueTarget = {
        topicSlug: card.slug,
        topicNameEn: card.nameEn,
        topicNameVi: card.nameVi,
        lessonOrder: lesson.order,
        lessonTitleEn: lesson.titleEn,
        lessonTitleVi: lesson.titleVi,
      };
    }
  }

  return {
    clusters,
    continueTarget,
    totals: {
      lessonsRead: cards.reduce((s, c) => s + c.lessonsRead, 0),
      lessonsTotal: cards.reduce((s, c) => s + c.lessonsTotal, 0),
      answered: cards.reduce((s, c) => s + c.answered, 0),
    },
  };
}

export type TopicPageData = {
  topic: TopicCard;
  lessons: { id: number; order: number; titleEn: string; titleVi: string | null; read: boolean }[];
} | null;

export async function getTopicPage(slug: string, userId: string | null): Promise<TopicPageData> {
  const topic = await prisma.grammarTopic.findUnique({ where: { slug } });
  if (!topic) return null;
  const [lessons, questionCount, reads, progress] = await Promise.all([
    prisma.grammarLesson.findMany({
      where: { topicId: topic.id },
      orderBy: { order: "asc" },
      select: { id: true, order: true, titleEn: true, titleVi: true },
    }),
    prisma.grammarTestQuestion.count({ where: { topicId: topic.id } }),
    userId
      ? prisma.grammarLessonRead.findMany({
          where: { userId, lessonId: { in: (await prisma.grammarLesson.findMany({ where: { topicId: topic.id }, select: { id: true } })).map((l) => l.id) } },
          select: { lessonId: true },
        })
      : Promise.resolve([]),
    userId
      ? prisma.grammarTopicProgress.findUnique({
          where: { userId_topicId: { userId, topicId: topic.id } },
        })
      : Promise.resolve(null),
  ]);
  const readIds = new Set(reads.map((r) => r.lessonId));
  const lessonsRead = lessons.filter((l) => readIds.has(l.id)).length;
  return {
    topic: {
      id: topic.id,
      slug: topic.slug,
      nameEn: topic.nameEn,
      nameVi: topic.nameVi,
      cluster: topic.cluster,
      order: topic.order,
      lessonsTotal: lessons.length,
      lessonsRead,
      testQuestionCount: questionCount,
      answered: progress?.answered ?? 0,
      mastery: masteryPct({
        lessonsRead,
        lessonsTotal: lessons.length,
        recent: progress?.recent ?? [],
        answered: progress?.answered ?? 0,
      }),
    },
    lessons: lessons.map((l) => ({ ...l, read: readIds.has(l.id) })),
  };
}

export type LessonPageData = {
  topic: { slug: string; nameEn: string; nameVi: string | null; testQuestionCount: number };
  lesson: {
    id: number;
    order: number;
    titleEn: string;
    titleVi: string | null;
    contentEnHtml: string;
    contentViHtml: string | null;
  };
  read: boolean;
  prevOrder: number | null;
  nextOrder: number | null;
} | null;

export async function getLessonPage(
  slug: string,
  order: number,
  userId: string | null
): Promise<LessonPageData> {
  const topic = await prisma.grammarTopic.findUnique({ where: { slug } });
  if (!topic) return null;
  const lesson = await prisma.grammarLesson.findUnique({
    where: { topicId_order: { topicId: topic.id, order } },
  });
  if (!lesson) return null;
  const [orders, questionCount, readRow] = await Promise.all([
    prisma.grammarLesson.findMany({
      where: { topicId: topic.id },
      select: { order: true },
      orderBy: { order: "asc" },
    }),
    prisma.grammarTestQuestion.count({ where: { topicId: topic.id } }),
    userId
      ? prisma.grammarLessonRead.findUnique({
          where: { userId_lessonId: { userId, lessonId: lesson.id } },
        })
      : Promise.resolve(null),
  ]);
  const list = orders.map((o) => o.order);
  const idx = list.indexOf(order);
  return {
    topic: { slug: topic.slug, nameEn: topic.nameEn, nameVi: topic.nameVi, testQuestionCount: questionCount },
    lesson: {
      id: lesson.id,
      order: lesson.order,
      titleEn: lesson.titleEn,
      titleVi: lesson.titleVi,
      contentEnHtml: lesson.contentEnHtml,
      contentViHtml: lesson.contentViHtml,
    },
    read: !!readRow,
    prevOrder: idx > 0 ? list[idx - 1] : null,
    nextOrder: idx >= 0 && idx < list.length - 1 ? list[idx + 1] : null,
  };
}
