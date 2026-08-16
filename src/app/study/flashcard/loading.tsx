import { Skeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <main className="shell w-full min-h-[calc(100vh-4rem)] flex flex-col">
      <div className="shell w-full py-2.5 flex items-center gap-3 border-b border-hairline/10 mb-6">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-1.5 flex-1 rounded-full" />
      </div>
      <div className="w-full max-w-4xl mx-auto">
        <Skeleton className="h-[min(64vh,520px)] w-full rounded-3xl mb-8" />
        <div className="grid grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}
        </div>
      </div>
    </main>
  );
}
