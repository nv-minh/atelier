import { redirect } from "next/navigation";
import { buildSessionPlan, parseSize } from "@/lib/practice/session-plan";
import { PracticeShell } from "@/components/practice/practice-shell";
import { EmptyStudy } from "@/components/study/empty-study";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function TypingPage({
  searchParams,
}: {
  searchParams: { cefr?: string; topic?: string; size?: string };
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const plan = await buildSessionPlan(user.id, {
    mode: "typing",
    cefr: searchParams.cefr,
    topic: searchParams.topic,
    size: parseSize(searchParams.size),
  });
  if (plan.items.length === 0) return <EmptyStudy />;

  return <PracticeShell items={plan.items} mode="typing" remaining={plan.remaining} />;
}
