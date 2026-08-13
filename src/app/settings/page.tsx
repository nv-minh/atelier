import { getSettings } from "@/lib/study-engine";
import { getLearnerProfile } from "@/lib/selection/candidates";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { AuthRequired } from "@/components/auth-required";
import { SettingsClient } from "./settings-client";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) return <AuthRequired context="settings" callbackUrl="/settings" />;
  const [settings, profile] = await Promise.all([
    getSettings(user.id),
    (async () => {
      const p = await prisma.learnerProfile.findUnique({
        where: { userId: user.id },
        select: { band: true, vocabSizeEst: true, topics: true, source: true },
      });
      if (!p) return null;
      const lite = await getLearnerProfile(user.id);
      return {
        band: p.band,
        vocabSizeEst: p.vocabSizeEst,
        // getLearnerProfile already drops slugs that left the taxonomy.
        topics: lite?.topics ?? [],
        source: p.source,
      };
    })(),
  ]);
  return (
    <SettingsClient
      requestRetention={settings.requestRetention}
      newCardsPerDay={settings.newCardsPerDay}
      reviewsPerDay={settings.reviewsPerDay}
      theme={settings.theme}
      dailyGoalXp={settings.dailyGoalXp}
      profile={profile}
    />
  );
}
