import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

export function StatCard({
  label,
  value,
  sub,
  accent,
  delay = 0,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: string;
  delay?: number;
}) {
  return (
    <Card
      variant="flat"
      className="p-5 sm:p-6 animate-fade-up"
      style={{ animationDelay: `${delay}ms`, animationFillMode: "both" }}
    >
      <p className="text-[11px] uppercase tracking-wider text-fg-muted font-semibold mb-2">{label}</p>
      <p className={cn("display text-3xl sm:text-4xl tabular-nums", accent)}>{value}</p>
      {sub && <p className="text-xs text-fg-muted mt-1">{sub}</p>}
    </Card>
  );
}
