import { getTopics } from "@/lib/topics-data";
import { getCurrentUser } from "@/lib/session";
import { TopicsGridView } from "./topics-grid-view";

export const dynamic = "force-dynamic";

export default async function TopicsPage() {
  // The grid itself stays open to guests — only opening a topic needs an
  // account. `authed` comes from the server so the cards know on first paint
  // whether a tap should navigate or raise the sign-in prompt.
  const [topics, user] = await Promise.all([getTopics(), getCurrentUser()]);
  return <TopicsGridView topics={topics} authed={!!user} />;
}
