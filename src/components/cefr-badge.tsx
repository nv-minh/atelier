import { cn } from "@/lib/utils";

const styles: Record<string, string> = {
  A1: "text-cefr-a1 border-cefr-a1/30 bg-cefr-a1/10",
  A2: "text-cefr-a2 border-cefr-a2/30 bg-cefr-a2/10",
  B1: "text-cefr-b1 border-cefr-b1/30 bg-cefr-b1/10",
  B2: "text-cefr-b2 border-cefr-b2/30 bg-cefr-b2/10",
  C1: "text-cefr-c1 border-cefr-c1/30 bg-cefr-c1/10",
};

export function CefrBadge({ level, className }: { level: string; className?: string }) {
  return (
    <span className={cn("pill", styles[level] ?? "text-soft", className)}>{level}</span>
  );
}
