import { ShellSkeleton, StatCardSkeleton, Skeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <ShellSkeleton>
      <div className="mb-10">
        <Skeleton className="h-4 w-32 mb-3" />
        <Skeleton className="h-10 w-2/3 mb-3" />
        <Skeleton className="h-5 w-full max-w-xl" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        {Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)}
      </div>
      <div className="grid lg:grid-cols-2 gap-4 sm:gap-6 mb-6">
        <Skeleton className="h-56 w-full rounded-3xl" />
        <Skeleton className="h-56 w-full rounded-3xl" />
      </div>
      <Skeleton className="h-48 w-full rounded-3xl mb-6" />
      <Skeleton className="h-40 w-full rounded-3xl" />
    </ShellSkeleton>
  );
}
