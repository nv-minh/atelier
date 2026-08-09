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
export function WordImage({
  imageUrl,
  word,
  className,
  maxH = "max-h-48",
}: {
  imageUrl: string | null | undefined;
  word: string;
  className?: string;
  maxH?: string;
}) {
  const [err, setErr] = useState(false);
  if (!isRealImage(imageUrl) || err) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={imageUrl!}
      alt={word}
      loading="lazy"
      onError={() => setErr(true)}
      className={cn("rounded-2xl object-cover w-full border border-line", maxH, className)}
    />
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
