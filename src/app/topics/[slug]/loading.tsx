import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <main className="shell w-full py-6 sm:py-8 pb-28 md:pb-10 min-h-[calc(100vh-4rem)]">
      <Skeleton className="h-4 w-24 mb-5" />
      <div className="mb-6">
        <Skeleton className="h-10 w-64 mb-1" />
        <Skeleton className="h-4 w-40" />
      </div>
      <Skeleton className="h-1.5 w-full mb-6 rounded-full" />
      <div className="w-full max-w-4xl mx-auto">
        <Skeleton className="h-[min(64vh,520px)] w-full rounded-3xl" />
      </div>
    </main>
  );
}
