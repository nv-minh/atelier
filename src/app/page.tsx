import { prisma } from "@/lib/db";
import { getDashboardStats } from "@/lib/stats";
import { getLeechCount } from "@/lib/notebook";
import { getGamificationSummary } from "@/lib/gamification";
import { getCurrentUser } from "@/lib/session";
import { TOPICS, topicBySlug } from "@/lib/topic-taxonomy";
import { bandToCefr } from "@/lib/placement/estimate";
import { getLearnerProfile } from "@/lib/selection/candidates";
import { getReminderStateFrom } from "@/lib/reminders/state-server";
import { HomeView } from "./home-view";
import { LandingView } from "./landing-view";
import type { DemoWord } from "@/components/landing/try-cards";

export const dynamic = "force-dynamic";

// Hosts whose URLs are real image files. Kept in sync with isRealImage() in
// word-image.tsx — filtering in SQL means the demo never picks a word whose
// card would render with a hole where the picture should be.
const IMAGE_HOSTS = ["https://images.pexels.com/", "https://upload.wikimedia.org"];

// Three words for the landing demo: complete entries (picture, phonetics, both
// definitions, a sentence) at the level most visitors are shopping for. The
// window shifts by date so the page is not the same three words forever, while
// staying identical for everyone on a given day — one query, no randomness.
async function getDemoWords(): Promise<DemoWord[]> {
  const dayIndex = Math.floor(Date.now() / 86_400_000);
  const select = {
    word: true,
    cefr: true,
    typeVi: true,
    ipaUk: true,
    definitionEn: true,
    definitionVi: true,
    example: true,
    imageUrl: true,
  };
  const where = {
    cefr: { in: ["A2", "B1"] },
    definitionVi: { not: null },
    definitionEn: { not: null },
    example: { not: null },
    ipaUk: { not: null },
    OR: IMAGE_HOSTS.map((h) => ({ imageUrl: { startsWith: h } })),
  };

  try {
    const total = await prisma.word.count({ where });
    if (total === 0) return [];
    const skip = total > 3 ? (dayIndex * 3) % (total - 3) : 0;
    return await prisma.word.findMany({ where, select, orderBy: { word: "asc" }, skip, take: 3 });
  } catch {
    // The demo is a nice-to-have; a query failure must not take down "/".
    return [];
  }
}

export default async function Home() {
  const user = await getCurrentUser();

  // Guests get the landing page instead of redirect("/login") — that redirect
  // is what made the "Trang chủ" tab look dead from the login screen.
  if (!user) {
    const [totalWords, demoWords] = await Promise.all([prisma.word.count(), getDemoWords()]);
    return (
      <LandingView
        totalWords={totalWords}
        topics={TOPICS.map((t) => ({ slug: t.slug, emoji: t.emoji }))}
        demoWords={demoWords}
      />
    );
  }

  // One Promise.all rather than sequential awaits: every extra round-trip to
  // serverless Postgres is paid in latency on the first paint of the home page.
  const [stats, leechCount, gamify, profile] = await Promise.all([
    getDashboardStats(user.id),
    getLeechCount(user.id),
    getGamificationSummary(user.id),
    getLearnerProfile(user.id),
  ]);

  // Fed from the numbers above instead of getReminderState(), which would re-run
  // all four — including computeStreakFromDb, an unbounded DailyStat scan. One
  // small extra query (the win-back lookback) beats four duplicated ones here.
  const reminder = await getReminderStateFrom(user.id, {
    studiedToday: stats.today.totalCount > 0,
    streak: stats.streak,
    dueCount: stats.dueToday,
    leechCount,
  });

  // Shown as a chip in the hero so level-aware selection is visible. Without it
  // the app looks like it hands out words at random.
  const cefrBand = profile
    ? {
        band: bandToCefr(profile.band),
        topics: profile.topics
          .map((slug) => topicBySlug(slug)?.name)
          .filter((n): n is string => !!n)
          .slice(0, 2),
      }
    : null;

  return (
    <HomeView
      stats={stats}
      leechCount={leechCount}
      gamify={gamify}
      cefrBand={cefrBand}
      reminder={reminder}
    />
  );
}
