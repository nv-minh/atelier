import * as React from "react";
import { cn } from "@/lib/utils";
import { cardClasses, type CardVariant } from "@/lib/ui/card-classes";

type CardProps = {
  variant?: CardVariant;
} & React.HTMLAttributes<HTMLDivElement>;

// The first Card primitive (Plan 1 Task 8). Migrates the real `.card-atelier`
// call sites (72 measured pre-task, recounted before/after — see
// task-8-report.md) onto one shared class builder — see
// src/lib/ui/card-classes.ts for the variant values. Call sites that need a
// non-<div> element (Link, <section>, <ul>/<ol>, motion.div, …) import
// `cardClasses()` directly instead — same precedent as Button/IconButton
// (Task 6) and Chip/chipClasses (Task 7): this primitive is not polymorphic.
export function Card({ variant = "flat", className, children, ...props }: CardProps) {
  return (
    <div className={cn(cardClasses(variant), className)} {...props}>
      {children}
    </div>
  );
}
