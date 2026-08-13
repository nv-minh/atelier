"use client";

// The honest answer, placed where a curious user finds it and an uninterested
// one never trips over it. The board's credibility comes from rival behaviour
// looking real (see lib/leaderboard/activity.ts), not from hiding what they are
// — so when someone does ask, the app answers instead of getting caught.

import { Info } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";

export function HowItWorks() {
  const { t } = useI18n();
  return (
    <details className="group rounded-2xl border border-line px-4 py-3">
      <summary className="flex cursor-pointer list-none items-center gap-2 text-sm text-soft hover:text-ink transition-colors">
        <Info size={14} />
        {t("leaderboard.howTitle")}
      </summary>
      <p className="mt-3 text-sm leading-relaxed text-soft">{t("leaderboard.howBody")}</p>
    </details>
  );
}
