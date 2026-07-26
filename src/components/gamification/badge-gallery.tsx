"use client";

import { Lock } from "lucide-react";
import { ACHIEVEMENTS } from "@/lib/gamification-defs";
import { useI18n } from "@/components/i18n-provider";
import { iconFor } from "./badge-icons";

// Grid of ALL badges from the defs. Unlocked badges are full-color and show the
// unlock date; locked ones are dimmed/grayscale with a small lock. Titles and
// descriptions come from i18n (achievements.<key>.title / .desc) — never from
// the defs. Token classes carry dark mode.
export function BadgeGallery({
  unlockedKeys,
  unlockedAt,
}: {
  unlockedKeys: string[];
  unlockedAt: Record<string, string>;
}) {
  const { t, lang } = useI18n();
  const unlocked = new Set(unlockedKeys);
  const dateFmt = new Intl.DateTimeFormat(lang === "vi" ? "vi-VN" : "en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <div className="card-atelier p-6 sm:p-7">
      <div className="flex items-baseline justify-between mb-5">
        <h3 className="display text-lg">{t("gamify.badges")}</h3>
        <span className="text-xs text-soft tabular-nums">
          {unlocked.size} / {ACHIEVEMENTS.length}
        </span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {ACHIEVEMENTS.map((a) => {
          const isUnlocked = unlocked.has(a.key);
          const Icon = iconFor(a.icon);
          const iso = unlockedAt[a.key];
          return (
            <div
              key={a.key}
              className={`rounded-2xl border p-4 flex flex-col items-center text-center transition-colors ${
                isUnlocked
                  ? "border-ember/30 bg-ember/5"
                  : "border-line bg-transparent opacity-55 grayscale"
              }`}
            >
              <span
                className={`relative inline-grid h-11 w-11 place-items-center rounded-full mb-2 ${
                  isUnlocked ? "bg-ember/12 text-ember" : "bg-ink/8 text-soft"
                }`}
              >
                <Icon size={20} strokeWidth={1.75} />
                {!isUnlocked && (
                  <span className="absolute -bottom-0.5 -right-0.5 grid h-4 w-4 place-items-center rounded-full bg-paper text-soft border border-line">
                    <Lock size={9} />
                  </span>
                )}
              </span>
              <p className="text-sm font-semibold leading-tight">
                {t(`achievements.${a.key}.title`)}
              </p>
              <p className="text-[11px] text-soft mt-1 leading-snug">
                {t(`achievements.${a.key}.desc`)}
              </p>
              {isUnlocked && iso && (
                <p className="text-[10px] text-moss-500 mt-2 tabular-nums">
                  {dateFmt.format(new Date(iso))}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
