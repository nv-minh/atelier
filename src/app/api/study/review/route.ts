import { NextRequest, NextResponse } from "next/server";
import { recordReview } from "@/lib/study-engine";
import { Rating } from "@/lib/fsrs";
import { requireUserId } from "@/lib/session";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { isSameOrigin, forbiddenCrossOrigin } from "@/lib/csrf";

export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) return forbiddenCrossOrigin();
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  // 180/min (3/sec) comfortably covers even a very fast human tapping through
  // flashcards, while bounding a scripted loop that would otherwise farm
  // per-rating XP or blow past newCardsPerDay at whatever rate curl can send.
  const limit = checkRateLimit(`${userId}:review`, 180, 60_000);
  if (!limit.allowed) return rateLimitResponse(limit.retryAfterSec);
  const body = await req.json();
  const { cardId, rating, correct, idempotencyKey } = body as {
    cardId: string;
    rating: number;
    correct?: boolean;
    idempotencyKey?: string;
  };
  // rating must be one of the four integer FSRS grades — reject floats and
  // out-of-range values (a bad rating would map to 0 XP and a wrong FSRS step).
  if (typeof cardId !== "string" || !cardId || !Number.isInteger(rating) || rating < 1 || rating > 4) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  const key = typeof idempotencyKey === "string" && idempotencyKey ? idempotencyKey : undefined;
  const updated = await recordReview(userId, cardId, rating as Rating, correct ?? rating >= 3, key);
  return NextResponse.json({
    ok: true,
    due: updated?.due,
    xpGained: updated?.xpGained ?? 0,
    unlocked: updated?.unlocked ?? [],
    leveledUp: updated?.leveledUp ?? null,
  });
}
