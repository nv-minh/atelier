import { redirect } from "next/navigation";
import { buildSessionPlan, parseSize } from "@/lib/practice/session-plan";
import { PracticeShell } from "@/components/practice/practice-shell";
import { EmptyStudy } from "@/components/study/empty-study";
import { getCurrentUser } from "@/lib/session";
import { parseScope } from "@/lib/vault/scope";

export const dynamic = "force-dynamic";

export default async function FlashcardPage({
  searchParams,
}: {
  searchParams: { cefr?: string; topic?: string; dir?: string; size?: string; scope?: string };
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const plan = await buildSessionPlan(user.id, {
    mode: "flashcard",
    cefr: searchParams.cefr,
    topic: searchParams.topic,
    size: parseSize(searchParams.size),
    // Flashcard only supports "starred" (it's the SRS path); weak/leeches are
    // drill modes that don't write SRS reviews, so they belong to cram instead.
    // `as const` is required: without it the literal array widens to string[],
    // which doesn't satisfy `readonly Scope[]`, and tsc rejects the call.
    scope: (parseScope(searchParams.scope, ["starred"] as const) ?? undefined) as
      | "starred"
      | undefined,
  });
  if (plan.items.length === 0) return <EmptyStudy />;

  const dir = (searchParams.dir as "forward" | "reverse" | "cloze") || "forward";
  return (
    <PracticeShell
      items={plan.items}
      mode="flashcard"
      remaining={plan.remaining}
      direction={dir}
    />
  );
}
