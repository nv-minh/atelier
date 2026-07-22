import { NextRequest, NextResponse } from "next/server";
import { buildStudyQueue } from "@/lib/study-engine";
import { requireUserId } from "@/lib/session";

export async function GET(req: NextRequest) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const cefr = req.nextUrl.searchParams.get("cefr") || undefined;
  const result = await buildStudyQueue(userId, { cefr: cefr || undefined });
  const queue = result.queue.map((c) => ({
    ...c,
    due: c.due.toISOString(),
    lastReview: c.lastReview ? c.lastReview.toISOString() : null,
  }));
  return NextResponse.json({ queue, counts: result.counts });
}
