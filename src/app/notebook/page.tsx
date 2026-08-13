import { getNotebook, getLeeches } from "@/lib/notebook";
import { getCurrentUser } from "@/lib/session";
import { AuthRequired } from "@/components/auth-required";
import { NotebookClient } from "./notebook-client";

export const dynamic = "force-dynamic";

export default async function NotebookPage({
  searchParams,
}: {
  searchParams: { tab?: string };
}) {
  const user = await getCurrentUser();
  const tab = searchParams.tab === "leeches" ? "leeches" : "starred";

  // A guest has no notebook to show, so the page renders its own shell with
  // the sign-in panel where the entries would be — the tab tap now lands
  // somewhere visible instead of bouncing to /login.
  if (!user) {
    return (
      <NotebookClient
        tab={tab}
        entries={[]}
        leeches={[]}
        gate={<AuthRequired context="notebook" variant="panel" callbackUrl="/notebook" />}
      />
    );
  }

  const [entries, leeches] = await Promise.all([
    getNotebook(user.id),
    getLeeches(user.id),
  ]);

  const serialize = (list: typeof entries) =>
    list.map((e) => ({
      ...e,
      card: e.card ? { ...e.card, due: e.card.due.toISOString() } : null,
    }));

  return (
    <NotebookClient
      tab={tab}
      entries={serialize(entries)}
      leeches={serialize(leeches)}
    />
  );
}
