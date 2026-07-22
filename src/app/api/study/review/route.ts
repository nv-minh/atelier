import { NextRequest, NextResponse } from "next/server";
import { recordReview } from "@/lib/study-engine";
import { Rating } from "@/lib/fsrs";
import { requireUserId } from "@/lib/session";

export async function POST(req: NextRequest) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json();
  const { cardId, rating, correct } = body as { cardId: string; rating: number; correct?: boolean };
  if (!cardId || rating < 1 || rating > 4) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  const updated = await recordReview(userId, cardId, rating as Rating, correct ?? rating >= 3);
  return NextResponse.json({ ok: true, due: updated?.due });
}
