"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { ExternalLink } from "lucide-react";

const WM = "https://upload.wikimedia.org";

export function isRealImage(url: string | null | undefined): boolean {
  return !!url && url.startsWith(WM);
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
export function ImageSearchLink({ imageUrl, className }: { imageUrl: string | null | undefined; className?: string }) {
  if (isRealImage(imageUrl)) return null;
  if (!imageUrl) return null;
  return (
    <a
      href={imageUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={cn("inline-flex items-center gap-1 text-xs text-soft hover:text-ember", className)}
    >
      See image <ExternalLink size={11} />
    </a>
  );
}
