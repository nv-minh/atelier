import { NextRequest, NextResponse } from "next/server";
import { startSession, endSession } from "@/lib/study-engine";
import { requireUserId } from "@/lib/session";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { isSameOrigin, forbiddenCrossOrigin } from "@/lib/csrf";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) return forbiddenCrossOrigin();
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  // 30 session-starts/min is generous for real use (a session per card mode
  // switch) but caps a scripted loop that repeatedly opens sessions.
  const limit = checkRateLimit(`${userId}:session:start`, 30, 60_000);
  if (!limit.allowed) return rateLimitResponse(limit.retryAfterSec);
  const { mode, cefr } = await req.json().catch(() => ({}));
  const session = await startSession(userId, mode ?? "flashcard", cefr ?? null);
  return NextResponse.json({ sessionId: session.id });
}

export async function PATCH(req: NextRequest) {
  if (!isSameOrigin(req)) return forbiddenCrossOrigin();
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  // endSession is already idempotent per sessionId (see study-engine.ts), so a
  // replay costs nothing gamification-wise — this is a second layer against a
  // tight curl loop burning DB round trips on a single account.
  const limit = checkRateLimit(`${userId}:session:end`, 30, 60_000);
  if (!limit.allowed) return rateLimitResponse(limit.retryAfterSec);
  const { sessionId, cardsReviewed, correctCount, durationSec } = await req.json().catch(() => ({}));
  if (!sessionId) return NextResponse.json({ error: "sessionId required" }, { status: 400 });
  // Clamp client-supplied totals to non-negative integers — they feed XP
  // (perfect_session, non-SRS bonus) and must not be negative or fractional.
  const clamp = (v: unknown) => Math.max(0, Math.floor(Number(v) || 0));
  const result = await endSession(userId, sessionId, {
    cardsReviewed: clamp(cardsReviewed),
    correctCount: clamp(correctCount),
    durationSec: clamp(durationSec),
  });
  if (!result.ok) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  return NextResponse.json({ ok: true, xpGained: result.xpGained, unlocked: result.unlocked });
}
