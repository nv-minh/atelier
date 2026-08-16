"use client";

import { motion, AnimatePresence } from "motion/react";
import { useI18n } from "./i18n-provider";
import { LANGS, type Lang } from "@/lib/i18n/dictionaries";
import { cn } from "@/lib/utils";

export function LangToggle({ variant = "icon" }: { variant?: "icon" | "full" }) {
  const { lang, setLang } = useI18n();

  if (variant === "full") {
    return (
      <div className="grid grid-cols-2 gap-2">
        {LANGS.map((l) => {
          const active = lang === l.code;
          return (
            <button
              key={l.code}
              onClick={() => setLang(l.code as Lang)}
              className={cn(
                "flex flex-col items-center gap-1 rounded-2xl border p-4 transition-colors",
                active ? "border-ember bg-ember/5 text-ember" : "border-hairline/10 text-fg-muted hover:text-fg"
              )}
            >
              <span className="text-sm font-semibold">{l.short}</span>
              <span className="text-xs">{l.label}</span>
            </button>
          );
        })}
      </div>
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
