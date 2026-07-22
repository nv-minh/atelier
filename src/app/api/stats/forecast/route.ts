import { NextRequest, NextResponse } from "next/server";
import { getForecast, getAccuracyTrend } from "@/lib/stats";
import { requireUserId } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const days = Number(req.nextUrl.searchParams.get("days") || 30);
  const [forecast, accuracy] = await Promise.all([getForecast(userId, days), getAccuracyTrend(userId, days)]);
  return NextResponse.json({ forecast, accuracy });
}
