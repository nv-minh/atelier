import { notFound } from "next/navigation";
import { getTopicWords } from "@/lib/topics-data";
import { TopicViewer } from "./topic-viewer";

export const dynamic = "force-dynamic";

export default async function TopicStudyPage({ params }: { params: { slug: string } }) {
  const { topic, words, total } = await getTopicWords(params.slug, 80);
  if (!topic) notFound();

  return <TopicViewer topic={topic} words={words} total={total} />;
}
