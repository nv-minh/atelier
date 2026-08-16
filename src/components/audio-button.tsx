"use client";

import { Volume2 } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { playWord } from "@/lib/tts";

export function AudioButton({
  word,
  accent = "uk",
  label,
  className,
  size = "md",
}: {
  word: string;
  accent?: "uk" | "us";
  label?: string;
  className?: string;
  size?: "sm" | "md";
}) {
  const [playing, setPlaying] = useState(false);
  const text = label ?? accent.toUpperCase();

  const play = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (playing) return;
    setPlaying(true);
    await playWord(word, {
      accent,
      onEnd: () => setPlaying(false),
    });
  };

  return (
    <button
      type="button"
      data-nosound
      onClick={play}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-hairline/10 px-2.5 py-1 text-[11px] font-medium text-fg-muted hover:text-fg hover:border-ember/40 transition-colors",
        size === "sm" && "px-2 py-0.5 text-[10px]",
        playing && "text-ember border-ember/40",
        className
      )}
    >
      <Volume2 size={size === "sm" ? 11 : 13} className={playing ? "animate-pulse" : ""} />
      {text}
    </button>
  );
}
