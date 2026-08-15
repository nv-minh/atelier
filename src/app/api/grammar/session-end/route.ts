import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/session";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { isSameOrigin, forbiddenCrossOrigin } from "@/lib/csrf";
import { awardGrammarXp } from "@/lib/gamification";
import { GRAMMAR_SESSION_SIZE, GRAMMAR_XP_SESSION_BONUS } from "@/lib/gamification-defs";
import { GRAMMAR_SOURCES, type GrammarSource } from "@/lib/grammar/session-types";

// The client mints one uuid per round; the StudySession PK makes the replay
// (summary-screen reload, network retry) a no-op — same idempotency-by-unique
// trick as ReviewLog.idempotencyKey on the vocab side.
const KEY_RE = /^[A-Za-z0-9-]{8,64}$/;

export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) return forbiddenCrossOrigin();
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const limit = checkRateLimit(`${userId}:grammar:session-end`, 30, 60_000);
  if (!limit.allowed) return rateLimitResponse(limit.retryAfterSec);

  const body = await req.json().catch(() => ({}));
  const { sessionKey, source, total, correct, durationSec } = body as Record<string, unknown>;
  if (
    typeof sessionKey !== "string" ||
    !KEY_RE.test(sessionKey) ||
    typeof source !== "string" ||
    !GRAMMAR_SOURCES.includes(source as GrammarSource)
  ) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  const clamp = (v: unknown) => Math.max(0, Math.floor(Number(v) || 0));
  const totals = { total: clamp(total), correct: clamp(correct), durationSec: clamp(durationSec) };

  try {
    await prisma.studySession.create({
      data: {
        id: `grammar_${sessionKey}`,
        userId,
        mode: `grammar_${source}`,
        cardsReviewed: totals.total,
        correctCount: Math.min(totals.correct, totals.total),
        durationSec: totals.durationSec,
        endedAt: new Date(),
      },
    });
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") {
      return NextResponse.json({ ok: true, xpGained: 0, leveledUp: null, replay: true });
    }
    throw e;
  }

  const bonus = totals.total >= GRAMMAR_SESSION_SIZE ? GRAMMAR_XP_SESSION_BONUS : 0;
  const { leveledUp } = bonus > 0 ? await awardGrammarXp(userId, bonus) : { leveledUp: null };
  return NextResponse.json({ ok: true, xpGained: bonus, leveledUp, replay: false });
}
