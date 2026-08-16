"use client";

import { motion, AnimatePresence } from "motion/react";
import { useI18n } from "./i18n-provider";
import { LANGS, type Lang } from "@/lib/i18n/dictionaries";
import { cn } from "@/lib/utils";
import { SegmentedControl } from "@/components/ui/segmented-control";

export function LangToggle({ variant = "icon" }: { variant?: "icon" | "full" }) {
  const { lang, setLang } = useI18n();

  if (variant === "full") {
    // Plan 1 Task 7: was a 2-card grid (short code + full name stacked);
    // now the SegmentedControl primitive. External API unchanged — every
    // caller still renders <LangToggle variant="full" /> exactly as before
    // (only settings-client.tsx uses this branch, per task-7-brief.md).
    return (
      <SegmentedControl
        value={lang}
        onChange={(v) => setLang(v as Lang)}
        options={LANGS.map((l) => ({ value: l.code as Lang, label: l.label }))}
      />
    );
  }

  // icon variant: cycles or shows current; we show a compact segmented toggle
  const next = lang === "vi" ? "en" : "vi";
  return (
    <button
      onClick={() => setLang(next as Lang)}
      aria-label="Switch language"
      className="h-9 px-2.5 rounded-full border border-hairline/10 flex items-center gap-1 text-xs font-semibold text-fg-muted hover:text-fg hover:border-ink/30 transition-colors"
    >
      {LANGS.map((l, i) => (
        <span
          key={l.code}
          className={cn(
            "relative px-1.5 py-0.5 rounded-full transition-colors",
            lang === l.code ? "text-ember" : "text-fg-muted/50"
          )}
        >
          {l.short}
        </span>
      ))}
    </button>
  );
}
