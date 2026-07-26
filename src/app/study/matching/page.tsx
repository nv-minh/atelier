import { redirect } from "next/navigation";
import { buildMatchingPool } from "@/lib/study-engine";
import { MatchingGame } from "@/components/study/matching-game";
import { EmptyStudy } from "@/components/study/empty-study";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

const PAIRS = 6;
const ROUNDS = 4;

export default async function MatchingPage({
  searchParams,
}: {
  searchParams: { cefr?: string; topic?: string };
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const rounds = await buildMatchingPool(user.id, {
    cefr: searchParams.cefr,
    topic: searchParams.topic,
    pairs: PAIRS,
    rounds: ROUNDS,
  });

  // Too few collision-free words to build even one full round → same fallback
  // the other study pages use when there's nothing to practice.
  if (rounds.length === 0 || rounds[0].length < PAIRS) {
    return <EmptyStudy />;
  }

  return <MatchingGame rounds={rounds} />;
}
