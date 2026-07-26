import { redirect } from "next/navigation";
import { getNotebook, getLeeches } from "@/lib/notebook";
import { getCurrentUser } from "@/lib/session";
import { NotebookClient } from "./notebook-client";

export const dynamic = "force-dynamic";

export default async function NotebookPage({
  searchParams,
}: {
  searchParams: { tab?: string };
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const tab = searchParams.tab === "leeches" ? "leeches" : "starred";

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
