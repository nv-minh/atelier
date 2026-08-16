import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { buttonClasses } from "@/lib/ui/button-classes";

// Tagged union (not an optional-property union) so `action.kind === "link"`
// reliably narrows `action.href` to `string` — a bare `"href" in action`
// check doesn't fully exclude `undefined` here, since TS still considers the
// other branch's `href` key "known" (typed `never`) rather than absent.
type EmptyStateAction =
  | { kind: "link"; label: string; href: string }
  | { kind: "button"; label: string; onClick: () => void };

// EmptyState primitive (Plan 1 Task 8): a reserved 120px slot for a 3D asset
// (left empty here on purpose — Plan 2 wires the real art in later, per the
// brief's explicit "don't stub in real 3D asset logic"), one line of copy,
// one button. First real caller: src/components/study/empty-study.tsx.
//
// The reserved slot is a plain empty box, NOT a <Skeleton form="art3d" />:
// Skeleton's shimmer means "content is loading", but here there genuinely is
// no content yet (Plan 2 hasn't shipped) — shimmering would be a false
// promise, not a loading state.
export function EmptyState({
  title,
  body,
  action,
  className,
}: {
  title: string;
  body?: string;
  action?: EmptyStateAction;
  className?: string;
}) {
  return (
    <div className={cn("text-center", className)}>
      <div className="mx-auto mb-6 h-[120px] w-[120px]" aria-hidden />
      <h2 className="display text-xl mb-2">{title}</h2>
      {body && <p className="text-fg-muted text-sm mb-6 max-w-sm mx-auto">{body}</p>}
      {action &&
        (action.kind === "link" ? (
          <Link href={action.href} className={buttonClasses("primary", "md")}>
            {action.label}
          </Link>
        ) : (
          <button onClick={action.onClick} className={buttonClasses("primary", "md")}>
            {action.label}
          </button>
        ))}
    </div>
  );
}
