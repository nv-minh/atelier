import { NextRequest, NextResponse } from "next/server";
import { setWordMark } from "@/lib/notebook";
import { requireUserId } from "@/lib/session";

export async function POST(req: NextRequest) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json();
  if (typeof body.wordId !== "string" || !body.wordId) {
    return NextResponse.json({ error: "wordId required" }, { status: 400 });
  }

  const patch: { starred?: boolean; note?: string } = {};
  if (typeof body.starred === "boolean") patch.starred = body.starred;
  if (typeof body.note === "string") patch.note = body.note.slice(0, 2000);

  const result = await setWordMark(userId, body.wordId, patch);
  return NextResponse.json(result);
}
