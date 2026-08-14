"use client";

import { useState, useEffect } from "react";
import { Sun, Moon, Monitor, Download } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { useI18n } from "@/components/i18n-provider";
import { ProfileSection, type ProfileView } from "./profile-section";
import { LangToggle } from "@/components/lang-toggle";
import { cn } from "@/lib/utils";
import { CEFR_LEVELS } from "@/lib/export-format";
import { isEnabled, setEnabled } from "@/lib/feedback-prefs";
import { ReminderSettings } from "@/components/reminder-settings";
// "contribute", not "feedback": settings.feedback is already the sound-and-
// haptics section in this app's vocabulary.
import { ContributeCard } from "@/components/contribute-card";
import { playSound } from "@/lib/sound";

export function SettingsClient({
  requestRetention,
  newCardsPerDay,
  reviewsPerDay,
  theme,
  dailyGoalXp,
  profile,
  remindHour,
  tz,
}: {
  requestRetention: number;
  newCardsPerDay: number;
  reviewsPerDay: number;
  theme: string;
  dailyGoalXp: number;
  profile: ProfileView;
  /** null = reminders off. */
  remindHour: number | null;
  tz: string;
}) {
  const { theme: active, set } = useTheme();
  const { t } = useI18n();
  const [retention, setRetention] = useState(requestRetention);
  const [newCards, setNewCards] = useState(newCardsPerDay);
  const [reviews, setReviews] = useState(reviewsPerDay);
  const [goalXp, setGoalXp] = useState(dailyGoalXp);
  const [saved, setSaved] = useState(false);
  const [exportScope, setExportScope] = useState("all");
  const [exportCefr, setExportCefr] = useState("ALL");

  // Read on mount, not during render: localStorage does not exist on the server,
  // and reading it during render would desync the first client paint from the
  // server-rendered HTML (hydration mismatch). Start from the module default.
  const [soundOn, setSoundOn] = useState(true);
  const [hapticOn, setHapticOn] = useState(true);
  useEffect(() => {
    setSoundOn(isEnabled("sound"));
    setHapticOn(isEnabled("haptic"));
  }, []);

  const save = async () => {
    await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requestRetention: retention,
        newCardsPerDay: newCards,
        reviewsPerDay: reviews,
        dailyGoalXp: goalXp,
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

  // CEFR now travels as its own `cefr` param instead of being baked into the
  // scope string (the old `cefr:X` form still works server-side as a
  // backward-compatible alias — see parseFilter — but new links use the
  // dedicated param so scope and level can combine freely).
  const scopeOptions = [
    { key: "all", label: t("settings.exportScopeAll") },
    { key: "mine", label: t("settings.exportScopeMine") },
    { key: "starred", label: t("settings.exportScopeStarred") },
    { key: "learned", label: t("settings.exportScopeLearned") },
    { key: "known", label: t("settings.exportScopeKnown") },
    { key: "leeches", label: t("settings.exportScopeLeeches") },
  ];
  const exportHref = (format: string) => {
    const sp = new URLSearchParams({ format, scope: exportScope });
    if (exportCefr !== "ALL") sp.set("cefr", exportCefr);
    return `/api/export?${sp.toString()}`;
  };

  return (
    <main className="shell py-10 sm:py-14 pb-28 md:pb-14 max-w-2xl">
      <header className="mb-10">
        <p className="text-sm text-soft font-mono mb-3">{t("settings.header")}</p>
        <h1 className="display text-display-lg mb-3">
          {t("settings.title")} <span className="display-it text-ember">{t("settings.titleAccent")}</span>
        </h1>
        <p className="text-soft">{t("settings.subtitle")}</p>
      </header>

      <ProfileSection profile={profile} />

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

      {/* Sound & haptics */}
      <section className="card-atelier p-6 sm:p-7 mb-4">
        <h2 className="display text-xl mb-1">{t("settings.feedback")}</h2>
        <p className="text-xs text-soft mb-5">{t("settings.feedbackDesc")}</p>
        <Toggle
          label={t("settings.soundToggle")}
          desc={t("settings.soundToggleDesc")}
          checked={soundOn}
          onChange={(on) => {
            setEnabled("sound", on);
            setSoundOn(on);
            // Preview the change immediately — turning sound ON should be
            // audible proof it worked.
            if (on) playSound("correct");
          }}
        />
        <Toggle
          label={t("settings.hapticToggle")}
          desc={t("settings.hapticToggleDesc")}
          checked={hapticOn}
          onChange={(on) => {
            setEnabled("haptic", on);
            setHapticOn(on);
          }}
        />
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

      {/* Daily goal */}
      <section className="card-atelier p-6 sm:p-7 mb-4">
        <h2 className="display text-xl mb-1">{t("settings.dailyGoal")}</h2>
        <p className="text-xs text-soft mb-6">{t("settings.dailyGoalDesc")}</p>
        <Slider
          label={t("settings.dailyGoalXp")}
          desc={t("settings.dailyGoalXpDesc")}
          value={goalXp}
          min={10}
          max={500}
          step={10}
          format={(v) => `${v} XP`}
          onChange={setGoalXp}
        />
      </section>

      <ReminderSettings initialHour={remindHour} initialTz={tz} />

      {/* Export */}
      <section className="card-atelier p-6 sm:p-7 mb-4">
        <h2 className="display text-xl mb-1">{t("settings.export")}</h2>
        <p className="text-xs text-soft mb-5">{t("settings.exportDesc")}</p>

        <label className="text-sm font-medium block mb-2">{t("settings.exportScope")}</label>
        <select
          value={exportScope}
          onChange={(e) => setExportScope(e.target.value)}
          className="w-full rounded-2xl border border-line bg-transparent px-4 py-3 text-sm mb-4"
        >
          {scopeOptions.map((opt) => (
            <option key={opt.key} value={opt.key}>
              {opt.label}
            </option>
          ))}
        </select>

        <label className="text-sm font-medium block mb-2">{t("settings.exportCefr")}</label>
        <select
          value={exportCefr}
          onChange={(e) => setExportCefr(e.target.value)}
          className="w-full rounded-2xl border border-line bg-transparent px-4 py-3 text-sm mb-4"
        >
          <option value="ALL">{t("browse.all")}</option>
          {CEFR_LEVELS.map((level) => (
            <option key={level} value={level}>
              {level}
            </option>
          ))}
        </select>

        <div className="grid grid-cols-2 gap-2">
          <a
            href={exportHref("csv")}
            download
            className="flex items-center justify-center gap-2 rounded-2xl border border-line px-4 py-3 text-sm font-medium text-soft hover:text-ink transition-colors"
          >
            <Download size={16} />
            {t("settings.exportCsv")}
          </a>
          <a
            href={exportHref("anki")}
            download
            className="flex items-center justify-center gap-2 rounded-2xl border border-line px-4 py-3 text-sm font-medium text-soft hover:text-ink transition-colors"
          >
            <Download size={16} />
            {t("settings.exportAnki")}
          </a>
        </div>
        <p className="text-xs text-soft mt-3">{t("settings.exportAnkiHint")}</p>
      </section>

      <ContributeCard />

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

function Toggle({
  label,
  desc,
  checked,
  onChange,
}: {
  label: string;
  desc: string;
  checked: boolean;
  onChange: (on: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 mb-5 last:mb-0">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-soft mt-0.5">{desc}</p>
      </div>
      <button
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={cn(
          "shrink-0 relative h-6 w-11 rounded-full transition-colors",
          checked ? "bg-ember" : "bg-ink/15"
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-5 w-5 rounded-full bg-surface shadow transition-transform",
            checked ? "translate-x-[1.375rem]" : "translate-x-0.5"
          )}
        />
      </button>
    </div>
  );
}
