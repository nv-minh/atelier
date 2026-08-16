"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { useI18n } from "@/components/i18n-provider";
import { TOPICS } from "@/lib/topic-taxonomy";
import { CEFR_LEVELS } from "@/lib/export-format";

const levels = [{ key: "ALL" }, ...CEFR_LEVELS.map((key) => ({ key }))];

export function CefrFilter() {
  const router = useRouter();
  const params = useSearchParams();
  const { t } = useI18n();
  const active = params.get("cefr") || "ALL";
  const topic = params.get("topic") || "ALL";

  const push = (next: { cefr?: string; topic?: string }) => {
    const sp = new URLSearchParams();
    const c = next.cefr ?? active;
    const tp = next.topic ?? topic;
    if (c && c !== "ALL") sp.set("cefr", c);
    if (tp && tp !== "ALL") sp.set("topic", tp);
    router.push(`/study${sp.toString() ? `?${sp.toString()}` : ""}`);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-fg-muted font-mono mr-1">{t("modes.level")}</span>
      {levels.map((l) => {
        const isActive = active === l.key;
        return (
          <button
            key={l.key}
            onClick={() => push({ cefr: l.key })}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-sm font-medium border transition-all",
              isActive ? "bg-ink text-paper border-ink" : "border-hairline/10 text-fg-muted hover:text-fg hover:border-ink/30"
            )}
          >
            {l.key === "ALL" ? t("modes.all") : l.key}
          </button>
        );
      })}
      <select
        value={topic}
        onChange={(e) => push({ topic: e.target.value })}
        className="ml-1 rounded-full border border-hairline/10 bg-surface px-3 py-1.5 text-sm text-fg-muted outline-none focus:border-ember cursor-pointer"
        aria-label="Topic"
      >
        <option value="ALL">{t("modes.allTopics")}</option>
        {TOPICS.map((tp) => (
          <option key={tp.slug} value={tp.slug}>
            {tp.emoji} {tp.name}
          </option>
        ))}
      </select>
    </div>
  );
}
