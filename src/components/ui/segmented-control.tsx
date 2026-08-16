"use client";

import { cn } from "@/lib/utils";

// Primitive (Plan 1 Task 7, kit §6.1). First real call site:
// src/components/lang-toggle.tsx's `variant="full"` branch (2 options).
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div className={cn("inline-flex h-10 items-center gap-1 rounded-pill bg-sunken p-1", className)}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            aria-pressed={active}
            className={cn(
              "flex-1 h-full rounded-pill px-4 text-sm font-medium transition-colors duration-instant",
              active ? "bg-surface text-fg shadow-sm" : "text-fg-muted hover:text-fg"
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
