import { redirect } from "next/navigation";
import { getSettings } from "@/lib/study-engine";
import { getCurrentUser } from "@/lib/session";
import { SettingsClient } from "./settings-client";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const settings = await getSettings(user.id);
  return (
    <SettingsClient
      requestRetention={settings.requestRetention}
      newCardsPerDay={settings.newCardsPerDay}
      reviewsPerDay={settings.reviewsPerDay}
      theme={settings.theme}
      dailyGoalXp={settings.dailyGoalXp}
    />
  );
}
