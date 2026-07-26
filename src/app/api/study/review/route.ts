import { NextRequest, NextResponse } from "next/server";
import { recordReview } from "@/lib/study-engine";
import { Rating } from "@/lib/fsrs";
import { requireUserId } from "@/lib/session";

export async function POST(req: NextRequest) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json();
  const { cardId, rating, correct } = body as { cardId: string; rating: number; correct?: boolean };
  // rating must be one of the four integer FSRS grades — reject floats and
  // out-of-range values (a bad rating would map to 0 XP and a wrong FSRS step).
  if (typeof cardId !== "string" || !cardId || !Number.isInteger(rating) || rating < 1 || rating > 4) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  const updated = await recordReview(userId, cardId, rating as Rating, correct ?? rating >= 3);
  return NextResponse.json({
    ok: true,
    due: updated?.due,
    xpGained: updated?.xpGained ?? 0,
    unlocked: updated?.unlocked ?? [],
    leveledUp: updated?.leveledUp ?? null,
  });
}
