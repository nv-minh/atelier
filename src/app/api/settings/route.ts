import { NextRequest, NextResponse } from "next/server";
import { updateSettings } from "@/lib/study-engine";
import { requireUserId } from "@/lib/session";

export async function POST(req: NextRequest) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json();
  const allowed: any = {};
  if (typeof body.requestRetention === "number") allowed.requestRetention = body.requestRetention;
  if (typeof body.newCardsPerDay === "number") allowed.newCardsPerDay = body.newCardsPerDay;
  if (typeof body.reviewsPerDay === "number") allowed.reviewsPerDay = body.reviewsPerDay;
  if (typeof body.theme === "string") allowed.theme = body.theme;
  // Daily XP goal: clamp to the same 10–500 range the UI exposes so a crafted
  // request can't store a goal that's unreachable or trivially auto-met.
  if (typeof body.dailyGoalXp === "number" && Number.isFinite(body.dailyGoalXp)) {
    allowed.dailyGoalXp = Math.round(Math.min(500, Math.max(10, body.dailyGoalXp)));
  }
  await updateSettings(userId, allowed);
  return NextResponse.json({ ok: true });
}
