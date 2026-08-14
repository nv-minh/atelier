import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireUserId } from "@/lib/session";
import { parseBulkRequest } from "@/lib/vault/bulk";
import { applyBulk } from "@/lib/vault/bulk-server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = parseBulkRequest(await req.json().catch(() => null));
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  try {
    const result = await applyBulk(userId, parsed.wordIds, parsed.action);
    return NextResponse.json(result);
  } catch (e) {
    // Unknown wordId → foreign-key violation on the WordMark.wordId relation
    // (same handling as /api/notebook).
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2003") {
      return NextResponse.json({ error: "word not found" }, { status: 404 });
    }
    throw e;
  }
}
