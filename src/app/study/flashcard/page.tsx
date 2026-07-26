import { redirect } from "next/navigation";
import { buildStudyQueue } from "@/lib/study-engine";
import { prisma } from "@/lib/db";
import { StudySession } from "@/components/study/study-session";
import { EmptyStudy } from "@/components/study/empty-study";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function FlashcardPage({
  searchParams,
}: {
  searchParams: { cefr?: string; topic?: string; dir?: string; scope?: string };
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const scope = searchParams.scope === "starred" ? "starred" : undefined;
  const { queue } = await buildStudyQueue(user.id, { cefr: searchParams.cefr, topic: searchParams.topic, scope });
  const dir = (searchParams.dir as "forward" | "reverse" | "cloze") || "forward";
  if (queue.length === 0) {
    return <EmptyStudy />;
  }

  // Batch-fetch star state for the queue's words so cards can be starred mid-study.
  const starred = new Set(
    (
      await prisma.wordMark.findMany({
        where: { userId: user.id, starred: true, wordId: { in: queue.map((c) => c.id) } },
        select: { wordId: true },
      })
    ).map((m) => m.wordId)
  );

  const serialized = queue.map((c) => ({
    ...c,
    due: c.due.toISOString(),
    lastReview: c.lastReview ? c.lastReview.toISOString() : null,
    starred: starred.has(c.id),
  }));

  return <StudySession initialQueue={serialized} direction={dir} />;
}
