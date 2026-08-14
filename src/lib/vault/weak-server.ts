import "server-only";
import { prisma } from "../db";
import { STATES } from "../fsrs";
import { filterWhere, type VaultFilter } from "./scope";

// CARD-FIRST query: Prisma cannot orderBy through a relation, so "weakest"
// must be queried starting from Card and only then joined to Word — the same
// shape getLeechWordIds() already uses, the mirror image of the word-first
// path the vault list uses.
//
// "Weak" means low stability: the number of days FSRS believes the learner
// still remembers the word for. Not lapses (that's "hard", i.e. a leech) and
// not due date (a weak word is often not yet due).
export async function getWeakWordIds(
  userId: string,
  limit: number,
  filter: VaultFilter
): Promise<string[]> {
  const wordWhere = filterWhere({ ...filter, scope: "all" }, null);
  const rows = await prisma.card.findMany({
    where: {
      userId,
      state: { gte: STATES.Learning },
      ...(Object.keys(wordWhere).length ? { word: wordWhere } : {}),
    },
    select: { wordId: true },
    orderBy: [{ stability: "asc" }, { lapses: "desc" }],
    take: limit,
  });
  return rows.map((r) => r.wordId);
}
