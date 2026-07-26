"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";

export function NoteEditor({
  wordId,
  initialNote,
}: {
  wordId: string;
  initialNote: string;
}) {
  const { t } = useI18n();
  const [note, setNote] = useState(initialNote);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSaved = useRef(initialNote);

  const save = async (value: string) => {
    setStatus("saving");
    try {
      const res = await fetch("/api/notebook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wordId, note: value }),
      });
      if (!res.ok) throw new Error("failed");
      lastSaved.current = value;
      setStatus("saved");
    } catch {
      setStatus("idle");
    }
  };

  const onChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value.slice(0, 2000);
    setNote(value);
    setStatus("idle");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (value !== lastSaved.current) save(value);
    }, 800);
  };

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-mono text-soft uppercase tracking-wide">{t("word.noteLabel")}</span>
        {status === "saving" && (
          <span className="inline-flex items-center gap-1 text-[11px] text-soft">
            <Loader2 size={12} className="animate-spin" /> {t("word.saving")}
          </span>
        )}
        {status === "saved" && (
          <span className="inline-flex items-center gap-1 text-[11px] text-moss-600 dark:text-moss-400">
            <Check size={12} /> {t("word.saved")}
          </span>
        )}
      </div>
      <textarea
        value={note}
        onChange={onChange}
        rows={4}
        maxLength={2000}
        placeholder={t("word.notePlaceholder")}
        className="w-full rounded-2xl border border-line bg-surface px-4 py-3 text-sm outline-none focus:border-ember resize-y"
      />
    </div>
  );
}
