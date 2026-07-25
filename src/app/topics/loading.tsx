import { ShellSkeleton, Skeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <ShellSkeleton>
      <div className="mb-10">
        <Skeleton className="h-4 w-32 mb-3" />
        <Skeleton className="h-10 w-2/3 mb-3" />
        <Skeleton className="h-5 w-full max-w-xl" />
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="card-atelier p-6">
            <div className="flex justify-between mb-4">
              <Skeleton className="h-9 w-9 rounded-xl" />
              <Skeleton className="h-7 w-10" />
            </div>
            <Skeleton className="h-5 w-2/3 mb-2" />
            <Skeleton className="h-3 w-full mb-1" />
            <Skeleton className="h-3 w-4/5" />
          </div>
        ))}
      </div>
    </ShellSkeleton>
  );
}
