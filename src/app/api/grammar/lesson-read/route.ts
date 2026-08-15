import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/session";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { isSameOrigin, forbiddenCrossOrigin } from "@/lib/csrf";
import { awardGrammarXp } from "@/lib/gamification";
import { GRAMMAR_XP_LESSON_READ } from "@/lib/gamification-defs";

export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) return forbiddenCrossOrigin();
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  // Reading a lesson takes minutes; 30/min already covers a fast skimmer while
  // capping a scripted loop farming the +5 first-read XP across 292 lessons.
  const limit = checkRateLimit(`${userId}:grammar:lesson-read`, 30, 60_000);
  if (!limit.allowed) return rateLimitResponse(limit.retryAfterSec);

  const body = await req.json().catch(() => ({}));
  const lessonId = Number((body as { lessonId?: unknown }).lessonId);
  if (!Number.isInteger(lessonId) || lessonId < 1) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  const lesson = await prisma.grammarLesson.findUnique({ where: { id: lessonId }, select: { id: true } });
  if (!lesson) return NextResponse.json({ error: "not found" }, { status: 404 });

  try {
    await prisma.grammarLessonRead.create({ data: { userId, lessonId } });
  } catch (e) {
    // Unique violation = already read: idempotent success, no second XP.
    if ((e as { code?: string }).code === "P2002") {
      return NextResponse.json({ ok: true, alreadyRead: true, xpGained: 0, leveledUp: null });
    }
    throw e;
  }
  const { leveledUp } = await awardGrammarXp(userId, GRAMMAR_XP_LESSON_READ);
  return NextResponse.json({ ok: true, alreadyRead: false, xpGained: GRAMMAR_XP_LESSON_READ, leveledUp });
}
