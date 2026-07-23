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
  await updateSettings(userId, allowed);
  return NextResponse.json({ ok: true });
}
