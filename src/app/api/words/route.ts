import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseJsonArray } from "@/lib/utils";
import { requireUserId } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const userId = await requireUserId();
  const q = req.nextUrl.searchParams.get("q")?.toLowerCase() || "";
  const cefr = req.nextUrl.searchParams.get("cefr") || "";
  const page = Math.max(1, Number(req.nextUrl.searchParams.get("page") || "1"));
  const perPage = 40;

  const where: any = {};
  if (cefr && cefr !== "ALL") where.cefr = cefr;
  if (q) where.word = { contains: q };

  const [words, total] = await Promise.all([
    prisma.word.findMany({
      where,
      orderBy: { word: "asc" },
      skip: (page - 1) * perPage,
      take: perPage,
      include: {
        cards: userId ? { where: { userId }, select: { state: true, due: true, reps: true } } : false,
      },
    }),
    prisma.word.count({ where }),
  ]);

  const items = words.map((w) => ({
    id: w.id,
    word: w.word,
    cefr: w.cefr,
    typeEn: w.typeEn,
    typeVi: w.typeVi,
    ipaUk: w.ipaUk,
    ipaUs: w.ipaUs,
    definitionEn: w.definitionEn,
    definitionVi: w.definitionVi,
    synonyms: parseJsonArray(w.synonyms),
    example: w.example,
    cardState: w.cards[0]?.state ?? null,
    reps: w.cards[0]?.reps ?? 0,
  }));

  return NextResponse.json({ items, total, page, perPage, totalPages: Math.ceil(total / perPage) });
}
