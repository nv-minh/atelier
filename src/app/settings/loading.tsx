import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

export default function Loading() {
  return (
    <main className="shell w-full py-10 sm:py-14 pb-28 md:pb-14 max-w-2xl">
      <div className="mb-10">
        <Skeleton className="h-4 w-24 mb-3" />
        <Skeleton className="h-10 w-2/3 mb-3" />
        <Skeleton className="h-5 w-full" />
      </div>
      <div className="space-y-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <Card variant="flat" key={i} className="p-6 sm:p-7">
            <Skeleton className="h-6 w-40 mb-2" />
            <Skeleton className="h-3 w-72 mb-6" />
            <Skeleton className="h-12 w-full rounded-2xl" />
          </Card>
        ))}
      </div>
    </main>
  );
}
