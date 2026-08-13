import { notFound } from "next/navigation";
import { getTopicWords } from "@/lib/topics-data";
import { getCurrentUser } from "@/lib/session";
import { AuthRequired } from "@/components/auth-required";
import { TopicViewer } from "./topic-viewer";

export const dynamic = "force-dynamic";

export default async function TopicStudyPage({ params }: { params: { slug: string } }) {
  // Guests reaching this URL directly (shared link, bookmark) get the wall
  // rather than a redirect that would look like a no-op from /login.
  const user = await getCurrentUser();
  if (!user) return <AuthRequired context="topic" callbackUrl={`/topics/${params.slug}`} />;

  const { topic, words, total } = await getTopicWords(params.slug, 80);
  if (!topic) notFound();

  return <TopicViewer topic={topic} words={words} total={total} />;
}
