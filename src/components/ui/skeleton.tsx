import { cn } from "@/lib/utils";
import { Card } from "./card";

// Skeleton primitive (Plan 1 Task 8) — folds the old src/components/skeletons.tsx
// (Skeleton, SkeletonLine, ShellSkeleton, StatCardSkeleton) into src/components/ui/.

export type SkeletonForm = "text" | "card" | "art3d";

// Shimmer sweep. Duration lives in tailwind.config.ts (`animation.shimmer`,
// 1.4s per this task's brief). Fully stopped under `prefers-reduced-motion:
// reduce` by the existing app-wide rule in globals.css
// (`animation-iteration-count: 1 !important` + `animation-duration: 0.01ms
// !important` on `*, *::before, *::after`) — that rule already covers every
// `animate-*` utility, so no component-level override is needed here.
// Verified with two Playwright screenshots 1.4s apart under forced
// reduced-motion, confirmed byte-identical — see task-8-report.md.
const SHIMMER =
  "animate-shimmer bg-ink/[0.06] bg-[length:200%_100%] " +
  "[background-image:linear-gradient(110deg,transparent_40%,rgba(255,255,255,0.5)_50%,transparent_60%),linear-gradient(rgb(var(--ink)/0.06),rgb(var(--ink)/0.06))] " +
  "dark:[background-image:linear-gradient(110deg,transparent_40%,rgba(255,255,255,0.08)_50%,transparent_60%),linear-gradient(rgb(var(--ink)/0.08),rgb(var(--ink)/0.08))]";

// Per-form default shape. Every existing call site overrides height/width/
// rounding via `className` anyway (cn() merges className AFTER these, so a
// call site's own sizing always wins) — these defaults only matter for a
// bare <Skeleton />.
const FORM_CLASSES: Record<SkeletonForm, string> = {
  text: "h-4 w-full rounded-md",
  card: "h-32 w-full rounded-xl",
  // Reserves the same 120px the EmptyState 3D slot reserves (Plan 2 wires the
  // real asset in later), so a loading placeholder and the eventual empty/
  // loaded states never jump in size.
  art3d: "mx-auto h-[120px] w-[120px] rounded-2xl",
};

export function Skeleton({
  form = "text",
  className,
  style,
}: {
  form?: SkeletonForm;
  className?: string;
  style?: React.CSSProperties;
}) {
  return <div style={style} className={cn(SHIMMER, FORM_CLASSES[form], className)} />;
}

/** Convenience wrapper for the common "one shimmering line, given w/h" case. */
export function SkeletonLine({
  w = "100%",
  h = "1rem",
  className,
}: {
  w?: string;
  h?: string;
  className?: string;
}) {
  return <Skeleton className={className} style={{ width: w, height: h }} />;
}

// Layout wrapper for a whole loading.tsx route fallback — unrelated to the
// shimmer visuals above, kept here only because it previously lived in the
// same file (src/components/skeletons.tsx, now retired).
export function ShellSkeleton({ children }: { children: React.ReactNode }) {
  return <div className="shell w-full py-10 sm:py-14 pb-28 md:pb-14">{children}</div>;
}

// The one real "card"-shaped consumer: a StatCard-shaped placeholder built
// from the same Card primitive the loaded StatCard now uses (Task 8), so the
// skeleton and the loaded content share one rounded-corner/shadow contract.
export function StatCardSkeleton() {
  return (
    <Card variant="flat" className="p-5 sm:p-6">
      <Skeleton form="text" className="h-3 w-2/5 mb-3" />
      <Skeleton form="text" className="h-9 w-3/5" />
      <Skeleton form="text" className="h-3 w-1/2 mt-2" />
    </Card>
  );
}
