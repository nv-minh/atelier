import { redirect } from "next/navigation";
import { getDashboardStats } from "@/lib/stats";
import { getLeechCount } from "@/lib/notebook";
import { getCurrentUser } from "@/lib/session";
import { HomeView } from "./home-view";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const [stats, leechCount] = await Promise.all([
    getDashboardStats(user.id),
    getLeechCount(user.id),
  ]);
  return <HomeView stats={stats} leechCount={leechCount} />;
}
