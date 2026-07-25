import { ShellSkeleton, StatCardSkeleton, Skeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <ShellSkeleton>
      <div className="max-w-3xl mb-10">
        <Skeleton className="h-4 w-40 mb-4" />
        <Skeleton className="h-12 w-3/4 mb-6" />
        <Skeleton className="h-5 w-full" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        {Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)}
      </div>
      <Skeleton className="h-48 w-full rounded-3xl" />
    </ShellSkeleton>
  );
}
