"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Loader2, AlertCircle } from "lucide-react";
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
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSaved = useRef(initialNote);
  // Latest note text, readable from the unmount cleanup without making it a dep.
  const noteRef = useRef(note);
  noteRef.current = note;
  // Monotonic request id: only the most recent save may commit its result, so
  // a slow earlier response can't overwrite a newer note (out-of-order guard).
  const seq = useRef(0);

  const save = async (value: string) => {
    const id = ++seq.current;
    setStatus("saving");
    try {
      const res = await fetch("/api/notebook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wordId, note: value }),
      });
      if (!res.ok) throw new Error("failed");
      if (id !== seq.current) return; // superseded by a newer save
      lastSaved.current = value;
      setStatus("saved");
    } catch {
      if (id !== seq.current) return;
      setStatus("error");
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

  // Unmount-only: flush any text typed in the debounce window that never hit
  // the network, so a fast navigation away doesn't silently drop the last edit.
  // Depends only on wordId so the cleanup runs on unmount, not every keystroke;
  // noteRef supplies the current text.
  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
      if (noteRef.current !== lastSaved.current) {
        try {
          fetch("/api/notebook", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ wordId, note: noteRef.current }),
            keepalive: true,
          });
        } catch {}
      }
    };
  }, [wordId]);

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-mono text-fg-muted uppercase tracking-wide">{t("word.noteLabel")}</span>
        {status === "saving" && (
          <span className="inline-flex items-center gap-1 text-[11px] text-fg-muted">
            <Loader2 size={12} className="animate-spin" /> {t("word.saving")}
          </span>
        )}
        {status === "saved" && (
          <span className="inline-flex items-center gap-1 text-[11px] text-moss-600 dark:text-moss-400">
            <Check size={12} /> {t("word.saved")}
          </span>
        )}
        {status === "error" && (
          <span className="inline-flex items-center gap-1 text-[11px] text-red-400">
            <AlertCircle size={12} /> {t("word.noteError")}
          </span>
        )}
      </div>
      <textarea
        value={note}
        onChange={onChange}
        rows={4}
        maxLength={2000}
        placeholder={t("word.notePlaceholder")}
        className="w-full rounded-2xl border border-hairline/10 bg-surface px-4 py-3 text-sm outline-none focus:border-ember resize-y"
      />
    </div>
  );
}
