import { NextRequest, NextResponse } from "next/server";
import { startSession, endSession } from "@/lib/study-engine";
import { requireUserId } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { mode, cefr } = await req.json().catch(() => ({}));
  const session = await startSession(userId, mode ?? "flashcard", cefr ?? null);
  return NextResponse.json({ sessionId: session.id });
}

export async function PATCH(req: NextRequest) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { sessionId, cardsReviewed, correctCount, durationSec } = await req.json().catch(() => ({}));
  if (!sessionId) return NextResponse.json({ error: "sessionId required" }, { status: 400 });
  const result = await endSession(userId, sessionId, {
    cardsReviewed: cardsReviewed ?? 0,
    correctCount: correctCount ?? 0,
    durationSec: durationSec ?? 0,
  });
  if (!result.ok) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  return NextResponse.json({ ok: true, xpGained: result.xpGained, unlocked: result.unlocked });
}
