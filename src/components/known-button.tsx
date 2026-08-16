"use client";

// "I already know this word." Mirrors StarButton: same endpoint, same optimistic
// pattern, same guest handling — a guest would otherwise watch the state fill in
// and then snap back when /api/notebook rejects the write.
//
// Always reversible. Tapping it again clears the mark, and the selection engine
// only de-prioritizes known words (x0.02) rather than removing them, so a word
// marked by mistake can still be probed back up.

import { CheckCheck } from "lucide-react";
import { useState } from "react";
import { useAuthGate } from "./auth-gate";
import { useI18n } from "./i18n-provider";
import { cn } from "@/lib/utils";

export function KnownButton({
  wordId,
  initialKnown,
  variant = "icon",
  onChange,
  className,
}: {
  wordId: string;
  initialKnown: boolean;
  /** "icon" for dense lists; "label" where there is room to say what it does. */
  variant?: "icon" | "label";
  /** Fired after a confirmed write — lets a study session drop the card. */
  onChange?: (known: boolean) => void;
  className?: string;
}) {
  const [known, setKnown] = useState(initialKnown);
  const [saving, setSaving] = useState(false);
  const { requireAuth } = useAuthGate();
  const { t } = useI18n();

  const toggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (saving) return;
    if (!requireAuth({ reason: "star" })) return;

    const next = !known;
    setKnown(next); // optimistic
    setSaving(true);
    try {
      const res = await fetch("/api/notebook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wordId, known: next }),
      });
      if (!res.ok) throw new Error("failed");
      const data = await res.json();
      const confirmed = typeof data.known === "boolean" ? data.known : next;
      setKnown(confirmed);
      onChange?.(confirmed);
    } catch {
      setKnown(!next); // revert on failure
    } finally {
      setSaving(false);
    }
  };

  const label = known ? t("known.marked") : t("known.mark");

  if (variant === "icon") {
    return (
      <button
        type="button"
        onClick={toggle}
        aria-pressed={known}
        title={label}
        aria-label={label}
        className={cn(
          "inline-flex items-center justify-center rounded-full p-1.5 transition-colors",
          known ? "text-moss-500" : "text-fg-muted hover:text-moss-500",
          className
        )}
      >
        <CheckCheck size={17} strokeWidth={2} />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={known}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-colors",
        known
          ? "border-moss-500 bg-moss-500/10 text-moss-500"
          : "border-ink/15 text-fg-muted hover:bg-ink/5",
        className
      )}
    >
      <CheckCheck size={15} strokeWidth={2.2} />
      {label}
    </button>
  );
}
