import { redirect } from "next/navigation";
import { buildSessionPlan, parseSize } from "@/lib/practice/session-plan";
import { PracticeShell } from "@/components/practice/practice-shell";
import { EmptyStudy } from "@/components/study/empty-study";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function DictationPage({
  searchParams,
}: {
  searchParams: { cefr?: string; topic?: string; size?: string };
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const plan = await buildSessionPlan(user.id, {
    mode: "dictation",
    cefr: searchParams.cefr,
    topic: searchParams.topic,
    size: parseSize(searchParams.size),
  });
  if (plan.items.length === 0) return <EmptyStudy />;

  return <PracticeShell items={plan.items} mode="dictation" remaining={plan.remaining} />;
}
