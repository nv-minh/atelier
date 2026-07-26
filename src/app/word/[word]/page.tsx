import { notFound, redirect } from "next/navigation";
import { getWordDetail } from "@/lib/notebook";
import { getCurrentUser } from "@/lib/session";
import { WordDetailClient } from "./word-detail-client";

export const dynamic = "force-dynamic";

export default async function WordDetailPage({ params }: { params: { word: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const word = decodeURIComponent(params.word);
  const detail = await getWordDetail(user.id, word);
  if (!detail) notFound();

  const serialized = {
    ...detail,
    card: detail.card ? { ...detail.card, due: detail.card.due.toISOString() } : null,
    reviews: detail.reviews.map((r) => ({ rating: r.rating, reviewedAt: r.reviewedAt.toISOString() })),
  };

  return <WordDetailClient detail={serialized} />;
}
