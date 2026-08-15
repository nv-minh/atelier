import { getGrammarHub } from "@/lib/grammar/data";
import { getCurrentUser } from "@/lib/session";
import { HubView } from "./hub-view";

export const dynamic = "force-dynamic";

export default async function GrammarHubPage() {
  // The hub is open to guests (browse freely); per-user progress only renders
  // when signed in. Same posture as /topics.
  const user = await getCurrentUser();
  const hub = await getGrammarHub(user?.id ?? null);
  return <HubView hub={hub} authed={!!user} />;
}
