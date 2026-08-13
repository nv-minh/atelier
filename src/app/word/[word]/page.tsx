import { notFound } from "next/navigation";
import { getWordDetail } from "@/lib/notebook";
import { getCurrentUser } from "@/lib/session";
import { AuthRequired } from "@/components/auth-required";
import { WordDetailClient } from "./word-detail-client";

export const dynamic = "force-dynamic";

export default async function WordDetailPage({ params }: { params: { word: string } }) {
  const user = await getCurrentUser();
  // The entry is per-user (schedule, notes, history), so a guest gets the wall
  // instead of the old redirect to /login.
  if (!user) return <AuthRequired context="word" callbackUrl={`/word/${params.word}`} />;

  let word: string;
  try {
    word = decodeURIComponent(params.word);
  } catch {
    notFound(); // malformed URI escape sequence
  }
  const detail = await getWordDetail(user.id, word);
  if (!detail) notFound();

  const serialized = {
    ...detail,
    card: detail.card ? { ...detail.card, due: detail.card.due.toISOString() } : null,
    reviews: detail.reviews.map((r) => ({ rating: r.rating, reviewedAt: r.reviewedAt.toISOString() })),
  };

  return <WordDetailClient detail={serialized} />;
}
