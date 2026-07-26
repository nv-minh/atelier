import { redirect } from "next/navigation";
import {
  getDashboardStats,
  getActivityHeatmap,
  getForecast,
  getAccuracyTrend,
  getWeeklyRecap,
} from "@/lib/stats";
import { getLeeches } from "@/lib/notebook";
import { getGamificationSummary } from "@/lib/gamification";
import { getCurrentUser } from "@/lib/session";
import { StatsView } from "./stats-view";

export const dynamic = "force-dynamic";

export default async function StatsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const [stats, heatmap, forecast, leeches, recap, gamify] = await Promise.all([
    getDashboardStats(user.id),
    getActivityHeatmap(user.id, 365),
    getForecast(user.id, 30),
    getLeeches(user.id),
    getWeeklyRecap(user.id),
    getGamificationSummary(user.id),
  ]);
  const accuracy = await getAccuracyTrend(user.id, 30);

  const topLeeches = leeches.slice(0, 5).map((l) => ({ word: l.word, lapses: l.card?.lapses ?? 0 }));

  return (
    <StatsView
      stats={stats}
      heatmap={heatmap}
      forecast={forecast}
      accuracy={accuracy}
      leeches={topLeeches}
      recap={recap}
      gamify={gamify}
    />
  );
}
