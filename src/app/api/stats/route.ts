import { NextResponse } from "next/server";
import { getDashboardStats } from "@/lib/stats";
import { requireUserId } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const stats = await getDashboardStats(userId);
  return NextResponse.json(stats);
}
