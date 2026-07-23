"use client";

import { useState } from "react";
import { Sun, Moon, Monitor } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { useI18n } from "@/components/i18n-provider";
import { LangToggle } from "@/components/lang-toggle";
import { cn } from "@/lib/utils";

export function SettingsClient({
  requestRetention,
  newCardsPerDay,
  reviewsPerDay,
  theme,
}: {
  requestRetention: number;
  newCardsPerDay: number;
  reviewsPerDay: number;
  theme: string;
}) {
  const { theme: active, set } = useTheme();
  const { t } = useI18n();
  const [retention, setRetention] = useState(requestRetention);
  const [newCards, setNewCards] = useState(newCardsPerDay);
  const [reviews, setReviews] = useState(reviewsPerDay);
  const [saved, setSaved] = useState(false);

  const save = async () => {
    await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requestRetention: retention,
        newCardsPerDay: newCards,
        reviewsPerDay: reviews,
      }),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const themeOptions = [
    { key: "light", label: t("settings.light"), icon: Sun },
    { key: "dark", label: t("settings.dark"), icon: Moon },
    { key: "system", label: t("settings.auto"), icon: Monitor },
  ] as const;

  return (
    <main className="shell py-10 sm:py-14 pb-28 md:pb-14 max-w-2xl">
      <header className="mb-10">
        <p className="text-sm text-soft font-mono mb-3">{t("settings.header")}</p>
        <h1 className="display text-display-lg mb-3">
          {t("settings.title")} <span className="display-it text-ember">{t("settings.titleAccent")}</span>
        </h1>
        <p className="text-soft">{t("settings.subtitle")}</p>
      </header>

      {/* Appearance */}
      <section className="card-atelier p-6 sm:p-7 mb-4">
        <h2 className="display text-xl mb-1">{t("settings.appearance")}</h2>
        <p className="text-xs text-soft mb-5">{t("settings.appearanceDesc")}</p>
        <div className="grid grid-cols-3 gap-2">
          {themeOptions.map((opt) => {
            const Icon = opt.icon;
            const isActive =
              (opt.key === "system" && theme === "system") ||
              (opt.key !== "system" && active === opt.key);
            return (
              <button
                key={opt.key}
                onClick={() => {
                  setSaved(false);
                  if (opt.key !== "system") set(opt.key);
                }}
                className={cn(
                  "flex flex-col items-center gap-2 rounded-2xl border p-4 transition-colors",
                  isActive ? "border-ember bg-ember/5 text-ember" : "border-line text-soft hover:text-ink"
                )}
              >
                <Icon size={20} />
                <span className="text-sm font-medium">{opt.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Language */}
      <section className="card-atelier p-6 sm:p-7 mb-4">
        <h2 className="display text-xl mb-1">{t("settings.language")}</h2>
        <p className="text-xs text-soft mb-5">{t("settings.languageDesc")}</p>
        <LangToggle variant="full" />
      </section>

      {/* SRS */}
      <section className="card-atelier p-6 sm:p-7 mb-4">
        <h2 className="display text-xl mb-1">{t("settings.spacedRepetition")}</h2>
        <p className="text-xs text-soft mb-6">{t("settings.srsDesc")}</p>

        <Slider
          label={t("settings.targetRetention")}
          desc={t("settings.targetRetentionDesc")}
          value={retention}
          min={0.8}
          max={0.99}
          step={0.01}
          format={(v) => `${(v * 100).toFixed(0)}%`}
          onChange={setRetention}
        />
        <Slider
          label={t("settings.newCardsPerDay")}
          desc={t("settings.newCardsDesc")}
          value={newCards}
          min={5}
          max={100}
          step={5}
          format={(v) => `${v}`}
          onChange={setNewCards}
        />
        <Slider
          label={t("settings.reviewsPerDay")}
          desc={t("settings.reviewsDesc")}
          value={reviews}
          min={50}
          max={500}
          step={50}
          format={(v) => `${v}`}
          onChange={setReviews}
        />
      </section>

      <div className="flex items-center gap-3">
        <button
          onClick={save}
          className="rounded-full bg-ink text-paper px-6 py-3 font-medium hover:opacity-90"
        >
          {t("settings.saveChanges")}
        </button>
        {saved && <span className="text-sm text-moss-500 animate-fade-up">{t("settings.saved")}</span>}
      </div>

      <div className="mt-12 pt-8 border-t border-line text-xs text-soft space-y-1">
        <p>{t("settings.dataFoot")}</p>
        <p>{t("settings.wordsFoot")}</p>
      </div>
    </main>
  );
}

function Slider({
  label,
  desc,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  label: string;
  desc: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="mb-6 last:mb-0">
      <div className="flex items-baseline justify-between mb-1">
        <label className="text-sm font-medium">{label}</label>
        <span className="display text-lg text-ember tabular-nums">{format(value)}</span>
      </div>
      <p className="text-xs text-soft mb-3">{desc}</p>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-ink/10 accent-ember"
        style={{ accentColor: "rgb(var(--ember))" }}
      />
    </div>
  );
}
