"use client";

import { Star } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

export function StarButton({
  wordId,
  initialStarred,
  size = "md",
  className,
}: {
  wordId: string;
  initialStarred: boolean;
  size?: "sm" | "md";
  className?: string;
}) {
  const [starred, setStarred] = useState(initialStarred);
  const [saving, setSaving] = useState(false);

  const toggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (saving) return;
    const next = !starred;
    setStarred(next); // optimistic
    setSaving(true);
    try {
      const res = await fetch("/api/notebook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wordId, starred: next }),
      });
      if (!res.ok) throw new Error("failed");
      const data = await res.json();
      if (typeof data.starred === "boolean") setStarred(data.starred);
    } catch {
      setStarred(!next); // revert on failure
    } finally {
      setSaving(false);
    }
  };

  const px = size === "sm" ? 15 : 18;

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={starred}
      className={cn(
        "inline-flex items-center justify-center rounded-full p-1.5 transition-colors",
        starred ? "text-ember" : "text-soft hover:text-ember",
        className
      )}
    >
      <Star size={px} strokeWidth={2} fill={starred ? "currentColor" : "none"} />
    </button>
  );
}
