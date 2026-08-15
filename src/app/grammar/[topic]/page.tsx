import { notFound } from "next/navigation";
import { getTopicPage } from "@/lib/grammar/data";
import { getCurrentUser } from "@/lib/session";
import { TopicView } from "./topic-view";

export const dynamic = "force-dynamic";

export default async function GrammarTopicPage({ params }: { params: { topic: string } }) {
  const user = await getCurrentUser();
  const data = await getTopicPage(params.topic, user?.id ?? null);
  if (!data) notFound();
  return <TopicView data={data} authed={!!user} />;
}
