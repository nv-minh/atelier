import { redirect } from "next/navigation";
import { buildStudyQueue } from "@/lib/study-engine";
import { StudySession } from "@/components/study/study-session";
import { EmptyStudy } from "@/components/study/empty-study";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function FlashcardPage({
  searchParams,
}: {
  searchParams: { cefr?: string; topic?: string; dir?: string };
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { queue } = await buildStudyQueue(user.id, { cefr: searchParams.cefr, topic: searchParams.topic });
  const dir = (searchParams.dir as "forward" | "reverse" | "cloze") || "forward";
  if (queue.length === 0) {
    return <EmptyStudy />;
  }

  const serialized = queue.map((c) => ({
    ...c,
    due: c.due.toISOString(),
    lastReview: c.lastReview ? c.lastReview.toISOString() : null,
  }));

  return <StudySession initialQueue={serialized} direction={dir} />;
}
