import { redirect } from "next/navigation";
import { buildCramQueue } from "@/lib/study-engine";
import { getCurrentUser } from "@/lib/session";
import { CramSession } from "@/components/study/cram-session";
import { EmptyStudy } from "@/components/study/empty-study";
import { parseScope, STUDY_SCOPES } from "@/lib/vault/scope";

export const dynamic = "force-dynamic";

const DEFAULT_CRAM_LIMIT = 30;
const MAX_CRAM_LIMIT = 50;

// `?limit=` is a user-controlled query parameter — absent or unparseable falls
// back to the existing default (30), but anything present gets clamped to
// 1..50 so a crafted URL can't ask buildCramQueue for the whole word table.
function parseLimit(raw: string | undefined): number {
  if (!raw) return DEFAULT_CRAM_LIMIT;
  const n = Number(raw);
  if (!Number.isFinite(n)) return DEFAULT_CRAM_LIMIT;
  return Math.min(MAX_CRAM_LIMIT, Math.max(1, Math.floor(n)));
}

export default async function CramPage({
  searchParams,
}: {
  searchParams: { cefr?: string; topic?: string; dir?: string; scope?: string; limit?: string };
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const scope = parseScope(searchParams.scope, STUDY_SCOPES) ?? undefined;
  const words = await buildCramQueue({
    cefr: searchParams.cefr,
    topic: searchParams.topic,
    limit: parseLimit(searchParams.limit),
    userId: user.id,
    scope: scope as "starred" | "leeches" | "weak" | undefined,
  });
  if (words.length === 0) return <EmptyStudy />;
  const dir = (searchParams.dir as "forward" | "reverse" | "cloze") || "forward";

  const cards = words.map((w) => ({
    ...w,
    cardId: w.id, // synthetic; cram never writes
  }));

  return <CramSession initialCards={cards} direction={dir} />;
}
