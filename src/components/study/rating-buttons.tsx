"use client";

import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/components/i18n-provider";

export type RatingPreview = {
  rating: number;
  label: string;
  key: string;
  interval: string;
};

const styles = [
  { ring: "hover:border-red-400/50 hover:text-red-500 active:bg-red-500/10", dot: "bg-red-400", key: "1", tkey: "study.again" },
  { ring: "hover:border-ember/50 hover:text-ember-500 active:bg-ember-500/10", dot: "bg-ember-400", key: "2", tkey: "study.hard" },
  { ring: "hover:border-moss-500/50 hover:text-moss-500 active:bg-moss-500/10", dot: "bg-moss-500", key: "3", tkey: "study.good" },
  { ring: "hover:border-cefr-a2/50 hover:text-cefr-a2 active:bg-cefr-a2/10", dot: "bg-cefr-a2", key: "4", tkey: "study.easy" },
];

export function RatingButtons({
  previews,
  onRate,
  disabled,
}: {
  previews: RatingPreview[];
  onRate: (rating: number) => void;
  disabled?: boolean;
}) {
  const { t } = useI18n();
  return (
    <div className="grid grid-cols-4 gap-2 sm:gap-3" data-nosound>
      {previews.map((p, i) => {
        const s = styles[i];
        return (
          <motion.button
            key={p.rating}
            disabled={disabled}
            onClick={() => onRate(p.rating)}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            whileTap={{ scale: 0.95 }}
            className={cn(
              "group relative min-w-0 flex flex-col items-center gap-1.5 rounded-2xl border border-line bg-surface px-2.5 py-3 sm:px-3 sm:py-4 transition-colors disabled:opacity-50",
              s.ring
            )}
          >
            <span className={cn("h-1.5 w-1.5 rounded-full", s.dot)} />
            <span className="text-sm font-semibold">{t(s.tkey)}</span>
            <span className="text-[11px] tabular-nums text-soft">{p.interval}</span>
            <kbd className="hidden sm:block absolute top-1.5 right-1.5 text-[9px] text-soft/60 font-mono">
              {s.key}
            </kbd>
          </motion.button>
        );
      })}
    </div>
  );
}
