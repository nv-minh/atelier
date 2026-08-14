"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { ExternalLink } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";

// Hosts that serve actual image files (vs legacy search-page links in old rows).
const REAL_IMAGE_PREFIXES = ["https://upload.wikimedia.org", "https://images.pexels.com/"];

export function isRealImage(url: string | null | undefined): boolean {
  return !!url && REAL_IMAGE_PREFIXES.some((p) => url.startsWith(p));
}

// Shows the word's image inline when a real image URL exists; otherwise nothing.
//
// Two fits, because the same picture does two different jobs:
//
//   "contain" — the whole picture, letterboxed inside a self-drawn frame whose
//     height is capped by `maxH`. Right where the image is the reference and a
//     crop would lose information (the word detail page).
//
//   "cover" — the frame's size wins and the picture fills it, cropping the
//     overflow. Right on cards: at "contain" a portrait photo collapses into a
//     sliver a third of the card wide, which reads as broken rather than
//     deliberate. The caller owns the frame's height here (`h-44`, `aspect-*`)
//     and `maxH` is ignored.
export function WordImage({
  imageUrl,
  word,
  className,
  maxH = "max-h-48",
  fit = "contain",
}: {
  imageUrl: string | null | undefined;
  word: string;
  className?: string;
  maxH?: string;
  fit?: "contain" | "cover";
}) {
  const [err, setErr] = useState(false);
  if (!isRealImage(imageUrl) || err) return null;
  return (
    <div
      className={cn(
        "flex items-center justify-center w-full overflow-hidden rounded-2xl border border-line bg-ink/5",
        className
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imageUrl!}
        alt={word}
        loading="lazy"
        onError={() => setErr(true)}
        className={
          fit === "cover"
            ? "h-full w-full object-cover"
            : cn("object-contain max-w-full h-auto", maxH)
        }
      />
    </div>
  );
}

// A compact "see image" link for when no real image exists (opens a search).
export function ImageSearchLink({
  word,
  imageUrl,
  className,
}: {
  word: string;
  imageUrl: string | null | undefined;
  className?: string;
}) {
  const { t } = useI18n();
  if (isRealImage(imageUrl)) return null;
  return (
    <a
      href={`https://www.google.com/search?tbm=isch&q=${encodeURIComponent(word)}`}
      target="_blank"
      rel="noopener noreferrer"
      className={cn("inline-flex items-center gap-1 text-xs text-soft hover:text-ember", className)}
    >
      {t("study.seeImage")} <ExternalLink size={11} />
    </a>
  );
}
