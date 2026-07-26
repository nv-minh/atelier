import { redirect } from "next/navigation";
import { buildCramQueue } from "@/lib/study-engine";
import { getCurrentUser } from "@/lib/session";
import { CramSession } from "@/components/study/cram-session";
import { EmptyStudy } from "@/components/study/empty-study";

export const dynamic = "force-dynamic";

export default async function CramPage({
  searchParams,
}: {
  searchParams: { cefr?: string; topic?: string; dir?: string; scope?: string };
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const scope = searchParams.scope === "starred" ? "starred" : undefined;
  const words = await buildCramQueue({ cefr: searchParams.cefr, topic: searchParams.topic, limit: 30, userId: user.id, scope });
  if (words.length === 0) return <EmptyStudy />;
  const dir = (searchParams.dir as "forward" | "reverse" | "cloze") || "forward";

  const cards = words.map((w) => ({
    ...w,
    cardId: w.id, // synthetic; cram never writes
  }));

  return <CramSession initialCards={cards} direction={dir} />;
}
