"use client";

import { motion } from "motion/react";
import { useI18n } from "@/components/i18n-provider";

// Shared reveal strip for the auto-graded modes (quiz, typing, dictation). This
// supersedes the FeedbackStrip that used to live in
// src/components/study/practice-session.tsx (removed in the final cleanup) —
// same container, same moss/red variants, same entrance, kept visually
// unchanged from that predecessor.
export function FeedbackStrip({
  reveal,
  message,
  example,
  exampleVi,
}: {
  reveal: "correct" | "wrong";
  message?: string;
  example?: string | null;
  exampleVi?: string | null;
}) {
  const { t } = useI18n();
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`mt-5 rounded-2xl p-4 border ${
        reveal === "correct" ? "bg-moss-500/8 border-moss-500/30" : "bg-red-400/8 border-red-400/30"
      }`}
    >
      <p
        className={`text-sm font-semibold ${
          reveal === "correct" ? "text-moss-600 dark:text-moss-400" : "text-red-500"
        }`}
      >
        {reveal === "correct" ? t("practice.correct") : t("practice.wrong")}{" "}
        {message && <span className="font-normal opacity-80">— {message}</span>}
      </p>
      {example && <p className="text-xs text-soft mt-1.5 italic">“{example}”</p>}
      {exampleVi && <p className="text-xs text-soft/70 mt-0.5">{exampleVi}</p>}
    </motion.div>
  );
}
