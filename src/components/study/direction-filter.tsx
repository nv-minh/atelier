"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { useI18n } from "@/components/i18n-provider";

const dirs = [
  { key: "forward" },
  { key: "reverse" },
  { key: "cloze" },
] as const;

export function DirectionFilter() {
  const router = useRouter();
  const params = useSearchParams();
  const { t } = useI18n();
  const active = params.get("dir") || "forward";

  const labels: Record<string, string> = {
    forward: t("study.dirForward"),
    reverse: t("study.dirReverse"),
    cloze: t("study.dirCloze"),
  };

  const set = (key: string) => {
    const sp = new URLSearchParams(params.toString());
    sp.set("dir", key);
    router.push(`/study?${sp.toString()}`);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-fg-muted font-mono mr-1">{t("study.dirLabel")}</span>
      {dirs.map((d) => {
        const isActive = active === d.key;
        return (
          <button
            key={d.key}
            onClick={() => set(d.key)}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-sm font-medium border transition-all",
              isActive ? "bg-ember text-paper border-ember" : "border-hairline/10 text-fg-muted hover:text-fg hover:border-ink/30"
            )}
          >
            {labels[d.key]}
          </button>
        );
      })}
    </div>
  );
}
