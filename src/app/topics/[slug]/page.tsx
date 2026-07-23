import { notFound } from "next/navigation";
import { getTopicWords } from "@/lib/topics-data";
import { TOPICS } from "@/lib/topic-taxonomy";
import { TopicViewer } from "./topic-viewer";

export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return TOPICS.map((t) => ({ slug: t.slug }));
}

export default async function TopicStudyPage({ params }: { params: { slug: string } }) {
  const { topic, words, total } = await getTopicWords(params.slug, 80);
  if (!topic) notFound();

  return <TopicViewer topic={topic} words={words} total={total} />;
}
