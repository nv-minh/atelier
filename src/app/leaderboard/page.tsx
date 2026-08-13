import { getCurrentUser } from "@/lib/session";
import { getWeeklyRecap } from "@/lib/stats";
import { computeStreakFromDb } from "@/lib/gamification-checks";
import { prisma } from "@/lib/db";
import { AuthRequired } from "@/components/auth-required";
import { getUserPace, getUserXpThroughYesterday } from "@/lib/leaderboard/pace-server";
import { buildBoard } from "@/lib/leaderboard/board";
import { isMondayUtc } from "@/lib/leaderboard/week";
import { LeaderboardView } from "./leaderboard-view";

export const dynamic = "force-dynamic";

export default async function LeaderboardPage() {
  const user = await getCurrentUser();
  if (!user) return <AuthRequired context="leaderboard" callbackUrl="/leaderboard" />;

  const now = new Date();
  // The user's weekly XP comes from getWeeklyRecap, the SAME number /stats
  // shows. A second hand-rolled weekly sum here is how the two drift apart.
  const [recap, pace, streak, throughYesterday] = await Promise.all([
    getWeeklyRecap(user.id),
    getUserPace(user.id, now),
    computeStreakFromDb(prisma, user.id),
    getUserXpThroughYesterday(user.id, now),
  ]);

  const board = buildBoard({
    userId: user.id,
    userName: user.name ?? "",
    userWeeklyXp: recap.thisWeek.xp,
    userWeeklyXpThroughYesterday: throughYesterday,
    userStreak: streak,
    pace: pace.pace,
    now,
  });

  return (
    <LeaderboardView board={board} nowIso={now.toISOString()} isMonday={isMondayUtc(now)} />
  );
}
