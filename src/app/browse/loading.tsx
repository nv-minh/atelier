import { ShellSkeleton, Skeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <ShellSkeleton>
      <div className="mb-8">
        <Skeleton className="h-4 w-24 mb-3" />
        <Skeleton className="h-10 w-2/3 mb-3" />
        <Skeleton className="h-5 w-80" />
      </div>
      <Skeleton className="h-11 w-full max-w-md rounded-full mb-6" />
      <div className="grid gap-2.5">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="card-atelier p-4 sm:p-5 flex gap-4">
            <div className="flex-1">
              <Skeleton className="h-5 w-32 mb-2" />
              <Skeleton className="h-3 w-full mb-1" />
              <Skeleton className="h-3 w-4/5" />
            </div>
            <Skeleton className="h-8 w-8 rounded-full" />
          </div>
        ))}
      </div>
    </ShellSkeleton>
  );
}
