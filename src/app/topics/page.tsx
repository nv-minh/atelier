import { getTopics } from "@/lib/topics-data";
import { TopicsGridView } from "./topics-grid-view";

export const dynamic = "force-dynamic";

export default async function TopicsPage() {
  const topics = await getTopics();
  return <TopicsGridView topics={topics} />;
}
