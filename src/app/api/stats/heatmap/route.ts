import { NextRequest, NextResponse } from "next/server";
import { getActivityHeatmap } from "@/lib/stats";
import { requireUserId } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const days = Number(req.nextUrl.searchParams.get("days") || 365);
  const data = await getActivityHeatmap(userId, days);
  return NextResponse.json(data);
}
