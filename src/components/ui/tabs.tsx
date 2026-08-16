import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

// Tabs primitive (Plan 1 Task 8): pill-shaped, height 44 (h-11), horizontally
// scrollable with scroll-snap. First real caller: /notebook's starred/leeches/
// known tabs (src/app/notebook/notebook-client.tsx), which navigate via
// next/link + a query param rather than client-side state — so Tab takes
// href/active per item instead of assuming a controlled/uncontrolled model.
// Replaces the old underline-style TabLink helper that used to live inline in
// notebook-client.tsx.

export type TabItem = {
  key: string;
  href: string;
  active: boolean;
  label: React.ReactNode;
};

export function Tabs({ items, className }: { items: TabItem[]; className?: string }) {
  return (
    <div className={cn("flex gap-2 overflow-x-auto scrollbar-hide snap-x snap-mandatory pb-1", className)}>
      {items.map((item) => (
        <Tab key={item.key} href={item.href} active={item.active}>
          {item.label}
        </Tab>
      ))}
    </div>
  );
}

export function Tab({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex shrink-0 snap-start items-center h-11 gap-1.5 rounded-pill px-4 text-sm font-medium transition-colors",
        active ? "bg-accent text-fg-on-accent" : "bg-sunken text-fg-muted hover:text-fg"
      )}
    >
      {children}
    </Link>
  );
}
