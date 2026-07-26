import { redirect } from "next/navigation";
import { getNotebook } from "@/lib/notebook";
import { getCurrentUser } from "@/lib/session";
import { NotebookClient } from "./notebook-client";

export const dynamic = "force-dynamic";

export default async function NotebookPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const entries = await getNotebook(user.id);
  const serialized = entries.map((e) => ({
    ...e,
    card: e.card ? { ...e.card, due: e.card.due.toISOString() } : null,
  }));

  return <NotebookClient entries={serialized} />;
}
