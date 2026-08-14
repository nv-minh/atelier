import { prisma } from "@/lib/db";
import { parseJsonArray } from "@/lib/utils";
import { getCurrentUser } from "@/lib/session";
import { AuthRequired } from "@/components/auth-required";
import { parseFilter, filterWhere, BROWSE_SCOPES } from "@/lib/vault/scope";
import { getVaultSummary } from "@/lib/vault/summary-server";
import { LibraryClient } from "./library-client";

export const dynamic = "force-dynamic";

export default async function BrowsePage({
  searchParams,
}: {
  searchParams: { q?: string; cefr?: string; topic?: string; scope?: string; page?: string };
}) {
  const user = await getCurrentUser();
  const userId = user?.id;
  const filter = parseFilter(searchParams, BROWSE_SCOPES);
  const page = Math.max(1, Number(searchParams.page || "1"));
  const perPage = 40;

  // Page 1 of scope=all is the free sample; anything past it, or any scope
  // that claims to be "your" words, needs an account. Without the scope half
  // of this guard, `filterWhere` silently drops the scope clause for a null
  // userId (by design, so it degrades to "all" rather than throwing) — so a
  // guest hitting e.g. /browse?scope=known directly would render the FULL
  // unscoped list while the client still draws the "Known" chip as active
  // and locked. The client intercepts the "next" tap and the scope-chip tap
  // for signed-out users, so this only fires on a direct/bookmarked URL.
  if (!userId && (page > 1 || filter.scope !== "all")) {
    const sp = new URLSearchParams();
    if (filter.q) sp.set("q", filter.q);
    if (filter.cefr) sp.set("cefr", filter.cefr);
    if (filter.topic) sp.set("topic", filter.topic);
    if (filter.scope !== "all") sp.set("scope", filter.scope);
    sp.set("page", String(page));
    return <AuthRequired context="library" callbackUrl={`/browse?${sp.toString()}`} />;
  }

  const where = filterWhere(filter, userId ?? null);

  const [words, total, summary] = await Promise.all([
    prisma.word.findMany({
      where,
      orderBy: { word: "asc" },
      skip: (page - 1) * perPage,
      take: perPage,
      // `select`, not `include` — `include` pulled every Word column (extraDefs,
      // antonyms, topics, both audio URLs, freq fields) for a list view that
      // renders only what's listed below, x40 rows x every page load.
      select: {
        id: true,
        word: true,
        cefr: true,
        typeEn: true,
        typeVi: true,
        ipaUk: true,
        ipaUs: true,
        definitionEn: true,
        definitionVi: true,
        imageUrl: true,
        synonyms: true,
        example: true,
        cards: userId ? { where: { userId }, select: { state: true, due: true, reps: true } } : false,
      },
    }),
    prisma.word.count({ where }),
    userId ? getVaultSummary(userId) : Promise.resolve(null),
  ]);

  // Per-user marks (star + note presence + known) for the words on this page.
  const marks = userId
    ? await prisma.wordMark.findMany({
        where: { userId, wordId: { in: words.map((w) => w.id) } },
        select: { wordId: true, starred: true, note: true, known: true },
      })
    : [];
  const markByWord = new Map(marks.map((m) => [m.wordId, m]));

  const items = words.map((w) => {
    const mark = markByWord.get(w.id);
    return {
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
      // `cards` is omitted from the query entirely for a guest (include:false),
      // so the relation is undefined rather than an empty array — optional
      // chaining, not just an index guard.
      cardState: w.cards?.[0]?.state ?? null,
      reps: w.cards?.[0]?.reps ?? 0,
      starred: mark?.starred ?? false,
      hasNote: !!mark && mark.note !== "",
      known: mark?.known ?? false,
    };
  });

  return (
    <LibraryClient
      items={items}
      total={total}
      page={page}
      totalPages={Math.max(1, Math.ceil(total / perPage))}
      q={filter.q ?? ""}
      cefr={filter.cefr ?? "ALL"}
      topic={filter.topic ?? "ALL"}
      scope={filter.scope}
      summary={summary}
      authed={!!userId}
    />
  );
}
