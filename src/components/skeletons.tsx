// Skeleton primitives for loading.tsx fallbacks. Shimmer on warm paper.
import { cn } from "@/lib/utils";

export function Skeleton({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      style={style}
      className={cn(
        "animate-shimmer rounded-xl bg-ink/[0.06] bg-[length:200%_100%]",
        "[background-image:linear-gradient(110deg,transparent_40%,rgba(255,255,255,0.5)_50%,transparent_60%),linear-gradient(rgb(var(--ink)/0.06),rgb(var(--ink)/0.06))]",
        "dark:[background-image:linear-gradient(110deg,transparent_40%,rgba(255,255,255,0.08)_50%,transparent_60%),linear-gradient(rgb(var(--ink)/0.08),rgb(var(--ink)/0.08))]",
        className
      )}
    />
  );
}

export function SkeletonLine({ w = "100%", h = "1rem", className }: { w?: string; h?: string; className?: string }) {
  return <Skeleton className={className} style={{ width: w, height: h }} />;
}

// A full page shell wrapper so the nav stays put and content area shimmers.
export function ShellSkeleton({ children }: { children: React.ReactNode }) {
  return <div className="shell w-full py-10 sm:py-14 pb-28 md:pb-14">{children}</div>;
}

export function StatCardSkeleton() {
  return (
    <div className="card-atelier p-5 sm:p-6">
      <SkeletonLine w="40%" h="0.7rem" className="mb-3" />
      <SkeletonLine w="60%" h="2.25rem" />
      <SkeletonLine w="50%" h="0.7rem" className="mt-2" />
    </div>
  );
}
