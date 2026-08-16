import { cn } from "@/lib/utils";
import { cefrStampClasses } from "@/lib/ui/cefr-stamp";

// Replaces src/components/cefr-badge.tsx (Plan 1 Task 7) — the CEFR "progress
// stamp" signature from design spec §2.3/§5.4: one blue hue getting bolder
// across A1→C1, instead of five unrelated colors. See src/lib/ui/cefr-stamp.ts
// for the per-level formula (and the measured contrast fix on top of it).
export function CefrStamp({ level, className }: { level: string; className?: string }) {
  return <span className={cn(cefrStampClasses(level), className)}>{level}</span>;
}
