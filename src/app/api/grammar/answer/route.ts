import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/session";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { isSameOrigin, forbiddenCrossOrigin } from "@/lib/csrf";
import { todayStr } from "@/lib/utils";
import { awardGrammarXp } from "@/lib/gamification";
import { GRAMMAR_XP_FIRST_CORRECT } from "@/lib/gamification-defs";
import { pushRecent } from "@/lib/grammar/mastery";
import { GRAMMAR_SOURCES, type GrammarSource } from "@/lib/grammar/session-types";

export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) return forbiddenCrossOrigin();
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  // Same ceiling as vocab reviews: 3/sec sustained covers fast tapping,
  // bounds a scripted first-correct XP farm.
  const limit = checkRateLimit(`${userId}:grammar:answer`, 180, 60_000);
  if (!limit.allowed) return rateLimitResponse(limit.retryAfterSec);

  const body = await req.json().catch(() => ({}));
  const { source, questionId, chosenIndex } = body as {
    source?: unknown;
    questionId?: unknown;
    chosenIndex?: unknown;
  };
  if (
    typeof source !== "string" ||
    !GRAMMAR_SOURCES.includes(source as GrammarSource) ||
    !Number.isInteger(questionId) ||
    !Number.isInteger(chosenIndex) ||
    (chosenIndex as number) < 0
  ) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  // v1: the only source is topic_test → GrammarTestQuestion. Plan 3 switches
  // on `source` here to route to practice/confused tables.
  const q = await prisma.grammarTestQuestion.findUnique({
    where: { id: questionId as number },
    select: { topicId: true, answerIndex: true, choicesEn: true },
  });
  if (!q) return NextResponse.json({ error: "not found" }, { status: 404 });
  const choiceCount = Array.isArray(q.choicesEn) ? q.choicesEn.length : 0;
  if ((chosenIndex as number) >= choiceCount) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  const correct = chosenIndex === q.answerIndex;
  const now = new Date();
  const dateStr = todayStr();
  const key = { userId, source: source as string, questionId: questionId as number };

  // One interactive transaction: answer-state ledger + topic counters + the
  // day's grammarCount + (when first-ever-correct) the XP bump — atomic, so a
  // network retry can never double-award (firstCorrectAt flips NULL→set once).
  const { firstCorrect, leveledUp } = await prisma.$transaction(async (tx) => {
    let first = false;
    const existing = await tx.grammarAnswerState.findUnique({
      where: { userId_source_questionId: key },
    });
    if (!existing) {
      try {
        await tx.grammarAnswerState.create({
          data: {
            ...key,
            firstCorrectAt: correct ? now : null,
            wrongCount: correct ? 0 : 1,
            lastWrongAt: correct ? null : now,
          },
        });
        first = correct;
      } catch (e) {
        if ((e as { code?: string }).code !== "P2002") throw e;
        // Concurrent create raced us — fall through to the update semantics.
        if (correct) {
          const r = await tx.grammarAnswerState.updateMany({
            where: { ...key, firstCorrectAt: null },
            data: { firstCorrectAt: now },
          });
          first = r.count === 1;
        } else {
          await tx.grammarAnswerState.update({
            where: { userId_source_questionId: key },
            data: { wrongCount: { increment: 1 }, lastWrongAt: now, resolvedAt: null },
          });
        }
      }
    } else if (correct) {
      // Guarded transition: count===1 ⇔ this request is THE first correct.
      const r = await tx.grammarAnswerState.updateMany({
        where: { ...key, firstCorrectAt: null },
        data: { firstCorrectAt: now },
      });
      first = r.count === 1;
    } else {
      await tx.grammarAnswerState.update({
        where: { userId_source_questionId: key },
        data: { wrongCount: { increment: 1 }, lastWrongAt: now, resolvedAt: null },
      });
    }

    // Topic ring buffer + counters (read-modify-write is fine inside the tx —
    // a user answers one question at a time; a rare concurrent session only
    // costs one ring-buffer entry, never corruption).
    const progress = await tx.grammarTopicProgress.findUnique({
      where: { userId_topicId: { userId, topicId: q.topicId } },
    });
    const recent = pushRecent(progress?.recent ?? [], correct);
    await tx.grammarTopicProgress.upsert({
      where: { userId_topicId: { userId, topicId: q.topicId } },
      update: { answered: { increment: 1 }, correct: { increment: correct ? 1 : 0 }, recent },
      create: { userId, topicId: q.topicId, answered: 1, correct: correct ? 1 : 0, recent },
    });

    // Streak source: every grammar answer marks the day active (design §7).
    await tx.dailyStat.upsert({
      where: { userId_dateStr: { userId, dateStr } },
      update: { grammarCount: { increment: 1 } },
      create: { userId, dateStr, grammarCount: 1 },
    });

    const award = first ? await awardGrammarXp(userId, GRAMMAR_XP_FIRST_CORRECT, tx) : { leveledUp: null };
    return { firstCorrect: first, leveledUp: award.leveledUp };
  });

  return NextResponse.json({
    ok: true,
    correct,
    answerIndex: q.answerIndex,
    xpGained: firstCorrect ? GRAMMAR_XP_FIRST_CORRECT : 0,
    leveledUp,
  });
}
