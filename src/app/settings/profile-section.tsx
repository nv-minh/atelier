"use client";

// "Level & fields" — the only place a learner can see what the app inferred
// about them and change it.
//
// Band is shown but NOT editable: it is a measurement, from the placement check
// or from drift, and a number anyone can type means nothing. Retaking the check
// is how it moves. Fields are editable, because those are a preference rather
// than a measurement.

import { useState } from "react";
import Link from "next/link";
import { CheckCheck, Loader2 } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { bandToCefr } from "@/lib/placement/estimate";
import { TOPICS } from "@/lib/topic-taxonomy";
import { cn } from "@/lib/utils";
import { buttonClasses } from "@/lib/ui/button-classes";
import { cardClasses } from "@/lib/ui/card-classes";

export type ProfileView = {
  band: number;
  vocabSizeEst: number;
  topics: string[];
  source: string;
} | null;

export function ProfileSection({ profile }: { profile: ProfileView }) {
  const { t } = useI18n();
  const [topics, setTopics] = useState<string[]>(profile?.topics ?? []);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const save = async (next: string[]) => {
    setTopics(next); // optimistic
    setSaved(false);
    setSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topics: next }),
      });
      if (!res.ok) throw new Error("failed");
      const data = await res.json();
      // The server drops slugs that have left the taxonomy, so take its answer
      // rather than assuming ours survived.
      if (Array.isArray(data.topics)) setTopics(data.topics);
      setSaved(true);
    } catch {
      setTopics(profile?.topics ?? []); // revert
    } finally {
      setSaving(false);
    }
  };

  const bandLabel = profile ? bandToCefr(profile.band) : null;

  return (
    <section className={cn(cardClasses("flat"), "p-6 sm:p-7 mb-4")}>
      <h2 className="display text-xl mb-1">{t("profile.sectionTitle")}</h2>

      {!profile ? (
        <>
          <p className="text-xs text-fg-muted mb-5">{t("profile.noProfile")}</p>
          <Link
            href="/onboarding"
            className={buttonClasses("primary", "sm")}
          >
            {t("profile.takeTest")}
          </Link>
        </>
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-x-10 gap-y-4 mt-4 mb-6">
            <div>
              <p className="text-xs text-fg-muted uppercase tracking-wide mb-1">{t("profile.band")}</p>
              <p className="display text-3xl text-ember">{bandLabel}</p>
              <p className="text-[11px] text-fg-muted/70 mt-1">
                {profile.source === "drift" ? t("profile.sourceDrift") : t("profile.sourceTest")}
              </p>
            </div>
            <div>
              <p className="text-xs text-fg-muted uppercase tracking-wide mb-1">{t("profile.vocab")}</p>
              <p className="display text-2xl">
                ~{profile.vocabSizeEst.toLocaleString()} {t("profile.words")}
              </p>
            </div>
          </div>

          <p className="text-xs text-fg-muted uppercase tracking-wide mb-2">{t("profile.topics")}</p>
          {!topics.length && <p className="text-xs text-fg-muted/70 mb-3">{t("profile.noTopics")}</p>}
          <div className="flex flex-wrap gap-2 mb-5">
            {TOPICS.map((topic) => {
              const on = topics.includes(topic.slug);
              return (
                <button
                  key={topic.slug}
                  type="button"
                  aria-pressed={on}
                  disabled={saving}
                  onClick={() =>
                    void save(
                      on ? topics.filter((s) => s !== topic.slug) : [...topics, topic.slug]
                    )
                  }
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors disabled:opacity-60",
                    on ? "border-ember bg-ember/10 text-ember" : "border-ink/15 text-fg-muted hover:bg-ink/5"
                  )}
                >
                  <span aria-hidden>{topic.emoji}</span>
                  {topic.name}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/onboarding"
              className="inline-flex items-center gap-2 rounded-full border border-ink/15 px-5 py-2 text-sm hover:bg-ink/5 transition-colors"
            >
              {t("profile.retake")}
            </Link>
            {saving && <Loader2 size={14} className="animate-spin text-fg-muted" />}
            {saved && !saving && (
              <span className="inline-flex items-center gap-1 text-xs text-moss-500">
                <CheckCheck size={13} /> {t("profile.saved")}
              </span>
            )}
          </div>
        </>
      )}
    </section>
  );
}
