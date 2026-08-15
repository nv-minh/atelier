import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { AuthRequired } from "@/components/auth-required";
import { GrammarSession } from "@/components/grammar/grammar-session";
import { GRAMMAR_SESSION_SIZE } from "@/lib/gamification-defs";
import type { GrammarSessionItem } from "@/lib/grammar/session-types";

export const dynamic = "force-dynamic";

// Fisher–Yates — Math.random is fine here, the pick is UX not security.
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default async function GrammarTestPage({ params }: { params: { topic: string } }) {
  const user = await getCurrentUser();
  if (!user) return <AuthRequired context="grammar" callbackUrl={`/grammar/${params.topic}/test`} />;

  const topic = await prisma.grammarTopic.findUnique({ where: { slug: params.topic } });
  if (!topic) notFound();

  // Prioritise questions never answered correctly (design §6): fetch the
  // topic's id set, subtract the user's first-correct ledger, fill the round
  // with repeats (0 XP server-side) when fresh ones run short.
  const [ids, answeredCorrect] = await Promise.all([
    prisma.grammarTestQuestion.findMany({ where: { topicId: topic.id }, select: { id: true } }),
    prisma.grammarAnswerState.findMany({
      where: { userId: user.id, source: "topic_test", firstCorrectAt: { not: null } },
      select: { questionId: true },
    }),
  ]);
  if (ids.length === 0) {
    return (
      <main className="shell py-14 max-w-xl text-center">
        <p className="text-soft mb-6">Chủ đề này chưa có câu hỏi kiểm tra.</p>
        <Link href={`/grammar/${topic.slug}`} className="inline-flex rounded-full border border-line px-5 py-2.5 text-sm font-medium">
          ← {topic.nameVi ?? topic.nameEn}
        </Link>
      </main>
    );
  }

  const correctSet = new Set(answeredCorrect.map((a) => a.questionId));
  const fresh = shuffle(ids.filter((q) => !correctSet.has(q.id))).slice(0, GRAMMAR_SESSION_SIZE);
  const repeats = shuffle(ids.filter((q) => correctSet.has(q.id))).slice(
    0,
    Math.max(0, GRAMMAR_SESSION_SIZE - fresh.length)
  );
  const picked = [
    ...fresh.map((q) => ({ id: q.id, repeat: false })),
    ...repeats.map((q) => ({ id: q.id, repeat: true })),
  ];
  const rows = await prisma.grammarTestQuestion.findMany({
    where: { id: { in: picked.map((p) => p.id) } },
    select: { id: true, questionEn: true, questionVi: true, choicesEn: true },
  });
  const repeatById = new Map(picked.map((p) => [p.id, p.repeat]));
  const order = new Map(picked.map((p, i) => [p.id, i]));
  const items: GrammarSessionItem[] = rows
    .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
    .map((r) => ({
      id: r.id,
      questionEn: r.questionEn,
      questionVi: r.questionVi,
      choices: Array.isArray(r.choicesEn) ? (r.choicesEn as string[]) : [],
      repeat: repeatById.get(r.id) ?? false,
    }));

  return (
    <GrammarSession
      source="topic_test"
      topicSlug={topic.slug}
      topicNameEn={topic.nameEn}
      topicNameVi={topic.nameVi}
      items={items}
    />
  );
}
