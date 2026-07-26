import { redirect } from "next/navigation";
import { buildCramQueue } from "@/lib/study-engine";
import { PronunciationSession, type PronWord } from "@/components/study/pronunciation-session";
import { EmptyStudy } from "@/components/study/empty-study";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

const LIMIT = 15;
const MIN_WORDS = 4;

export default async function PronunciationPage({
  searchParams,
}: {
  searchParams: { cefr?: string; topic?: string };
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const words = await buildCramQueue({
    userId: user.id,
    cefr: searchParams.cefr,
    topic: searchParams.topic,
    limit: LIMIT,
  });

  // Not enough words to make a worthwhile drill → same fallback the other study
  // pages use.
  if (words.length < MIN_WORDS) {
    return <EmptyStudy />;
  }

  // Serialize down to only what the client needs to render + grade.
  const payload: PronWord[] = words.map((w) => ({
    word: w.word,
    cefr: w.cefr,
    ipaUk: w.ipaUk,
    ipaUs: w.ipaUs,
    audioUk: w.audioUk,
    audioUs: w.audioUs,
    definitionEn: w.definitionEn,
    definitionVi: w.definitionVi,
  }));

  return <PronunciationSession words={payload} />;
}
