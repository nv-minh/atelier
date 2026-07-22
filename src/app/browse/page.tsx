import { prisma } from "@/lib/db";
import { parseJsonArray } from "@/lib/utils";
import { getCurrentUser } from "@/lib/session";
import { LibraryClient } from "./library-client";

export const dynamic = "force-dynamic";

export default async function BrowsePage({
  searchParams,
}: {
  searchParams: { q?: string; cefr?: string; page?: string };
}) {
  const user = await getCurrentUser();
  const userId = user?.id;
  const q = searchParams.q?.toLowerCase() || "";
  const cefr = searchParams.cefr || "ALL";
  const page = Math.max(1, Number(searchParams.page || "1"));
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
    imageUrl: w.imageUrl,
    synonyms: parseJsonArray(w.synonyms),
    example: w.example,
    cardState: w.cards[0]?.state ?? null,
    reps: w.cards[0]?.reps ?? 0,
  }));

  return (
    <LibraryClient
      items={items}
      total={total}
      page={page}
      totalPages={Math.ceil(total / perPage)}
      q={q}
      cefr={cefr}
    />
  );
}
