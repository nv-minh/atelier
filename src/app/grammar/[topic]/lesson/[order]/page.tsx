import { notFound } from "next/navigation";
import { getLessonPage } from "@/lib/grammar/data";
import { getCurrentUser } from "@/lib/session";
import { LessonReader } from "./lesson-reader";

export const dynamic = "force-dynamic";

export default async function GrammarLessonPage({
  params,
}: {
  params: { topic: string; order: string };
}) {
  const order = Number.parseInt(params.order, 10);
  if (!Number.isInteger(order) || order < 1) notFound();
  const user = await getCurrentUser();
  const data = await getLessonPage(params.topic, order, user?.id ?? null);
  if (!data) notFound();
  return <LessonReader data={data} authed={!!user} />;
}
