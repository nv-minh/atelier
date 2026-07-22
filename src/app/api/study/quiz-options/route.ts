import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

function truncateDef(d: string): string {
  const first = d.split(/[,.;]/)[0].trim();
  return first.length > 70 ? first.slice(0, 67) + "…" : first;
}

export async function GET(req: NextRequest) {
  const wordId = req.nextUrl.searchParams.get("wordId");
  if (!wordId) return NextResponse.json({ error: "wordId required" }, { status: 400 });
  const word = await prisma.word.findUnique({ where: { id: wordId } });
  if (!word || !word.definitionEn) {
    return NextResponse.json({ options: [] });
  }
  const correct = truncateDef(word.definitionEn);
  // fetch distractors from same level
  const pool = await prisma.word.findMany({
    where: { cefr: word.cefr, word: { not: word.word }, definitionEn: { not: null } },
    select: { definitionEn: true },
    take: 80,
  });
  const valid = pool
    .map((p) => truncateDef(p.definitionEn!))
    .filter((d) => d && d !== correct);
  const distractors = shuffle(valid).slice(0, 3);
  const options = shuffle([correct, ...distractors]);
  return NextResponse.json({ options, correctIndex: options.indexOf(correct) });
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
