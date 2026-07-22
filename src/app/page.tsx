import { redirect } from "next/navigation";
import { getDashboardStats } from "@/lib/stats";
import { getCurrentUser } from "@/lib/session";
import { HomeView } from "./home-view";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const stats = await getDashboardStats(user.id);
  return <HomeView stats={stats} />;
}
