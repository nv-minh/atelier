"use client";

import { useEffect } from "react";
import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import type { ButtonVariant, ButtonSize } from "@/lib/ui/button-classes";
import { Card } from "@/components/ui/card";
import { cardClasses } from "@/lib/ui/card-classes";
import { ProgressBar } from "@/components/ui/progress-bar";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Tabs } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

// A tiny client-side toggle so developers can preview both palettes without
// going to Settings. Dark mode uses the `data-theme` attribute on <html>
// (migrated from the `.dark` class in Task 2).
function ThemeToggle() {
  useEffect(() => {
    // Sync initial state with the current DOM.
    const sw = document.getElementById("theme-switch") as HTMLButtonElement | null;
    if (sw) {
      sw.textContent = document.documentElement.dataset.theme === "dark"
        ? "☀ Light"
        : "🌙 Dark";
    }
  }, []);

  const toggle = () => {
    const html = document.documentElement;
    const next = html.dataset.theme !== "dark";
    html.dataset.theme = next ? "dark" : "light";
    const sw = document.getElementById("theme-switch");
    if (sw) sw.textContent = next ? "☀ Light" : "🌙 Dark";
  };

  return (
    <button
      id="theme-switch"
      onClick={toggle}
      className={cn(cardClasses("flat"), "fixed top-4 right-4 z-50 px-3 py-1.5 text-sm cursor-pointer")}
    >
      🌙 Dark
    </button>
  );
}

const VARIANTS: ButtonVariant[] = ["primary", "secondary", "ghost", "danger"];
const SIZES: ButtonSize[] = ["sm", "md", "lg"];

// ── /dev/ui — Component gallery ────────────────────────────────────
// Button/IconButton primitive matrix (Plan 1 Task 6). `data-testid` on the
// default-state cells is a hook for a one-off Playwright height check
// (getBoundingClientRect() ≥ 40/48/56px per size, ≥44px tap-target floor) —
// see task-6-report.md for how that check was run.
export default function DevUIPage() {
  return (
    <main className="shell py-12">
      <ThemeToggle />
      <h1 className="text-2xl font-semibold mb-2">/dev/ui</h1>
      <p className="text-fg-muted mb-8">
        Component gallery — Button/IconButton (Task 6), Card/ProgressBar/Skeleton/
        EmptyState/Tabs (Task 8). Chip/SegmentedControl/CefrStamp (Task 7) and
        Sheet/Toast/Input (Task 9) render here once those tasks add their sections.
      </p>

      <section className="mb-12">
        <h2 className="text-lg font-semibold mb-4">
          Button — 4 variants × 3 sizes × default/disabled
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="text-left p-2 text-fg-muted font-medium">Variant</th>
                {SIZES.map((size) => (
                  <th key={size} className="text-left p-2 text-fg-muted font-medium">
                    {size} ({size === "sm" ? "40px" : size === "md" ? "48px" : "56px"})
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {VARIANTS.map((variant) => (
                <tr key={variant} className="border-t border-hairline/20">
                  <td className="p-2 font-mono text-xs text-fg-muted align-top">{variant}</td>
                  {SIZES.map((size) => (
                    <td key={size} className="p-2 align-top">
                      <div className="flex flex-col items-start gap-2">
                        <Button variant={variant} size={size} data-testid={`btn-${variant}-${size}`}>
                          Button
                        </Button>
                        <Button variant={variant} size={size} disabled>
                          Disabled
                        </Button>
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-lg font-semibold mb-4">Button — loading</h2>
        <div className="flex flex-wrap gap-3">
          {VARIANTS.map((variant) => (
            <Button key={variant} variant={variant} size="md" loading>
              Loading
            </Button>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-4">
          IconButton — sm (44px tap-target floor) / md (48px)
        </h2>
        <div className="flex flex-wrap items-center gap-3">
          <IconButton aria-label="Favorite" variant="primary" size="sm" data-testid="icon-btn-sm">
            <Heart size={18} />
          </IconButton>
          <IconButton aria-label="Favorite" variant="primary" size="md" data-testid="icon-btn-md">
            <Heart size={20} />
          </IconButton>
          <IconButton aria-label="Favorite, disabled" variant="secondary" size="md" disabled>
            <Heart size={20} />
          </IconButton>
          <IconButton aria-label="Favorite, loading" variant="primary" size="md" loading />
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-lg font-semibold mb-4">Card — flat / raised / interactive (Task 8)</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Card variant="flat" className="p-5">
            <p className="text-sm font-semibold mb-1">flat</p>
            <p className="text-xs text-fg-muted">1:1 replacement for the retired global card class.</p>
          </Card>
          <Card variant="raised" className="p-5">
            <p className="text-sm font-semibold mb-1">raised</p>
            <p className="text-xs text-fg-muted">Stronger shadow — single hero dashboard tiles (GoalRing/LevelCard).</p>
          </Card>
          <Card variant="interactive" className="p-5" role="button" tabIndex={0}>
            <p className="text-sm font-semibold mb-1">interactive</p>
            <p className="text-xs text-fg-muted">Hover lift + accent border — clickable cards/list rows.</p>
          </Card>
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-lg font-semibold mb-4">ProgressBar — line / ring (Task 8)</h2>
        <div className="flex flex-wrap items-center gap-8">
          <div className="w-64">
            <p className="text-xs text-fg-muted mb-2">form=&quot;line&quot; (real caller: grammar/hub-view.tsx)</p>
            <ProgressBar form="line" value={62} />
          </div>
          <div>
            <p className="text-xs text-fg-muted mb-2">form=&quot;ring&quot; (evaluated against GoalRing, kept bespoke — see progress-bar.tsx)</p>
            <ProgressBar
              form="ring"
              value={70}
              size={96}
              label={<span className="display text-xl tabular-nums">70%</span>}
            />
          </div>
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-lg font-semibold mb-4">Skeleton — text / card / art3d (Task 8)</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <p className="text-xs text-fg-muted mb-2">form=&quot;text&quot;</p>
            <Skeleton form="text" className="mb-2" />
            <Skeleton form="text" className="w-2/3" />
          </div>
          <div>
            <p className="text-xs text-fg-muted mb-2">form=&quot;card&quot;</p>
            <Skeleton form="card" />
          </div>
          <div>
            <p className="text-xs text-fg-muted mb-2">form=&quot;art3d&quot; (120px reserved slot)</p>
            <Skeleton form="art3d" />
          </div>
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-lg font-semibold mb-4">EmptyState (Task 8)</h2>
        <Card variant="flat" className="p-8">
          <EmptyState
            title="Bạn đã ôn hết cho hôm nay"
            body="Quay lại vào lúc từ tiếp theo đến hạn, hoặc chọn một chế độ học khác."
            action={{ kind: "link", label: "Đổi chế độ học", href: "/study" }}
          />
        </Card>
      </section>

      <section className="mt-12 mb-12">
        <h2 className="text-lg font-semibold mb-4">Tabs — pill, height 44, scroll-snap (Task 8)</h2>
        <Tabs
          items={[
            { key: "a", href: "#", active: true, label: "Đã lưu (12)" },
            { key: "b", href: "#", active: false, label: "Khó nhớ (3)" },
            { key: "c", href: "#", active: false, label: "Đã thuộc (48)" },
          ]}
        />
      </section>
    </main>
  );
}
