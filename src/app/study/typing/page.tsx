import { redirect } from "next/navigation";
import { buildStudyQueue } from "@/lib/study-engine";
import { PracticeSession } from "@/components/study/practice-session";
import { EmptyStudy } from "@/components/study/empty-study";
import { getCurrentUser } from "@/lib/session";
import { serializePractice } from "../_lib/serialize";

export const dynamic = "force-dynamic";

export default async function TypingPage({ searchParams }: { searchParams: { cefr?: string; topic?: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { queue } = await buildStudyQueue(user.id, { cefr: searchParams.cefr, topic: searchParams.topic });
  if (queue.length === 0) return <EmptyStudy />;
  return <PracticeSession cards={serializePractice(queue)} mode="typing" />;
}
