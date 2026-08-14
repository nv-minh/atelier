import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { setWordMark } from "@/lib/notebook";
import { requireUserId } from "@/lib/session";
import { isSameOrigin, forbiddenCrossOrigin } from "@/lib/csrf";

export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) return forbiddenCrossOrigin();
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json();
  if (typeof body.wordId !== "string" || !body.wordId) {
    return NextResponse.json({ error: "wordId required" }, { status: 400 });
  }

  const patch: { starred?: boolean; note?: string; known?: boolean } = {};
  if (typeof body.starred === "boolean") patch.starred = body.starred;
  if (typeof body.note === "string") patch.note = body.note.slice(0, 2000);
  // `known` is reversible by design — sending false clears the mark.
  if (typeof body.known === "boolean") patch.known = body.known;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "nothing to update" }, { status: 400 });
  }

  try {
    const result = await setWordMark(userId, body.wordId, patch);
    return NextResponse.json(result);
  } catch (e) {
    // Unknown wordId → foreign-key violation on the WordMark.wordId relation.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2003") {
      return NextResponse.json({ error: "word not found" }, { status: 404 });
    }
    throw e;
  }
}
