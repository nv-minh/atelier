import { redirect } from "next/navigation";
import { buildCramQueue } from "@/lib/study-engine";
import { pick } from "@/lib/utils";
import { PronunciationSession, type PronWord } from "@/components/study/pronunciation-session";
import { EmptyStudy } from "@/components/study/empty-study";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

const SESSION_SIZE = 15;
// Over-fetch a wider pool, then randomly pick the session's words. buildCramQueue
// orders cefr/word ascending, so an unfiltered user would otherwise see the same
// alphabetical 15 every visit; sampling from a larger window varies each session.
const POOL_SIZE = SESSION_SIZE * 3;
const MIN_WORDS = 4;

export default async function PronunciationPage({
  searchParams,
}: {
  searchParams: { cefr?: string; topic?: string };
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const pool = await buildCramQueue({
    userId: user.id,
    cefr: searchParams.cefr,
    topic: searchParams.topic,
    limit: POOL_SIZE,
  });

  // Not enough words to make a worthwhile drill → same fallback the other study
  // pages use.
  if (pool.length < MIN_WORDS) {
    return <EmptyStudy />;
  }

  const words = pick(pool, SESSION_SIZE);

  // Serialize down to only what the client needs to render + grade. Audio is
  // played through AudioButton (which resolves its own source), so audioUk/Us
  // aren't needed on the client.
  const payload: PronWord[] = words.map((w) => ({
    word: w.word,
    cefr: w.cefr,
    ipaUk: w.ipaUk,
    ipaUs: w.ipaUs,
    definitionEn: w.definitionEn,
    definitionVi: w.definitionVi,
  }));

  return <PronunciationSession words={payload} />;
}
