import { cn } from "@/lib/utils";

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
    <div
      className="card-atelier p-5 sm:p-6 animate-fade-up"
      style={{ animationDelay: `${delay}ms`, animationFillMode: "both" }}
    >
      <p className="text-[11px] uppercase tracking-wider text-soft font-semibold mb-2">{label}</p>
      <p className={cn("display text-3xl sm:text-4xl tabular-nums", accent)}>{value}</p>
      {sub && <p className="text-xs text-soft mt-1">{sub}</p>}
    </div>
  );
}
