import { redirect } from "next/navigation";
import { getDashboardStats, getActivityHeatmap, getForecast, getAccuracyTrend } from "@/lib/stats";
import { getCurrentUser } from "@/lib/session";
import { StatsView } from "./stats-view";

export const dynamic = "force-dynamic";

export default async function StatsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const [stats, heatmap, forecast] = await Promise.all([
    getDashboardStats(user.id),
    getActivityHeatmap(user.id, 365),
    getForecast(user.id, 30),
  ]);
  const accuracy = await getAccuracyTrend(user.id, 30);

  return <StatsView stats={stats} heatmap={heatmap} forecast={forecast} accuracy={accuracy} />;
}
