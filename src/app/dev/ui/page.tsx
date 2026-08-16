"use client";

import { useEffect, useState } from "react";
import { Heart, Info, Award, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import type { ButtonVariant, ButtonSize } from "@/lib/ui/button-classes";
import { Chip } from "@/components/ui/chip";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { CefrStamp } from "@/components/ui/cefr-stamp";
import { Card } from "@/components/ui/card";
import { cardClasses } from "@/lib/ui/card-classes";
import { ProgressBar } from "@/components/ui/progress-bar";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Tabs } from "@/components/ui/tabs";
import { Sheet } from "@/components/ui/sheet";
import { Toast } from "@/components/ui/toast";
import { Input } from "@/components/ui/input";
import { CEFR_LEVELS } from "@/lib/export-format";
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

// SegmentedControl needs live state to demonstrate — first real caller is
// lang-toggle.tsx's US/UK pronunciation switch (Task 7), mirrored here.
function SegmentedControlDemo() {
  const [value, setValue] = useState<"us" | "uk">("us");
  return (
    <SegmentedControl
      value={value}
      onChange={setValue}
      options={[
        { value: "us", label: "US" },
        { value: "uk", label: "UK" },
      ]}
    />
  );
}

// Sheet is a full-screen overlay, so unlike every other primitive above it
// can't just sit inline on the page — it needs a real trigger + open state.
// This ALSO doubles as the stable Playwright target for Task 9's manual
// verification (Tab×12 focus-trap, ESC, swipe-down-drag) without having to
// fight the real auth-gate's guest-only gating logic to reach one.
function SheetDemo() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" size="md" onClick={() => setOpen(true)} data-testid="sheet-trigger">
        Open sheet
      </Button>
      <Sheet open={open} onClose={() => setOpen(false)} closeLabel="Đóng" labelledBy="dev-sheet-title">
        <h2 id="dev-sheet-title" className="display text-2xl mb-2">
          Sheet demo
        </h2>
        <p className="text-sm text-fg-muted leading-relaxed mb-6">
          Vuốt xuống, nhấn ESC, hoặc bấm nền mờ để đóng. Nhấn Tab lặp lại để kiểm tra
          focus trap — tiêu điểm không được thoát khỏi sheet này.
        </p>
        <Button variant="primary" size="md" className="w-full mb-2" onClick={() => setOpen(false)} data-testid="sheet-confirm">
          Xác nhận
        </Button>
        <Button variant="ghost" size="md" className="w-full" onClick={() => setOpen(false)}>
          Huỷ
        </Button>
      </Sheet>
    </>
  );
}

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
        Component gallery — every primitive in src/components/ui/: Button/IconButton
        (Task 6), Chip/SegmentedControl/CefrStamp (Task 7), Card/ProgressBar/Skeleton/
        EmptyState/Tabs (Task 8), Sheet/Toast/Input (Task 9).
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
        <h2 className="text-lg font-semibold mb-4">Chip — tag / filter / choice (Task 7)</h2>
        <div className="flex flex-wrap gap-2 items-center">
          <Chip variant="tag">tag (real caller: 21 migrated legacy tag sites)</Chip>
          <Chip variant="filter">filter — inactive</Chip>
          <Chip variant="filter" active>filter — active</Chip>
          <Chip variant="choice">choice — inactive</Chip>
          <Chip variant="choice" active>choice — active</Chip>
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-lg font-semibold mb-4">
          SegmentedControl — height 40 (Task 7, real caller: lang-toggle.tsx)
        </h2>
        <SegmentedControlDemo />
      </section>

      <section className="mt-12">
        <h2 className="text-lg font-semibold mb-4">
          CefrStamp — A1→C1, một hue xanh, năm độ đậm (Task 7)
        </h2>
        <div className="flex flex-wrap gap-3 items-center">
          {CEFR_LEVELS.map((level) => (
            <CefrStamp key={level} level={level} />
          ))}
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

      <section className="mt-12">
        <h2 className="text-lg font-semibold mb-4">Tabs — pill, height 44, scroll-snap (Task 8)</h2>
        <Tabs
          items={[
            { key: "a", href: "#", active: true, label: "Đã lưu (12)" },
            { key: "b", href: "#", active: false, label: "Khó nhớ (3)" },
            { key: "c", href: "#", active: false, label: "Đã thuộc (48)" },
          ]}
        />
      </section>

      <section className="mt-12">
        <h2 className="text-lg font-semibold mb-4">
          Sheet — drag handle, swipe-down-to-dismiss, focus trap, ESC (Task 9)
        </h2>
        <p className="text-xs text-fg-muted mb-3">
          Real caller: auth-gate.tsx&apos;s AuthGateModal. This demo instance is the
          stable Playwright target for the manual verification steps (Tab focus
          trap, ESC, swipe-down) since the real one only opens for a guest.
        </p>
        <SheetDemo />
      </section>

      <section className="mt-12">
        <h2 className="text-lg font-semibold mb-4">
          Toast — info / success / error, auto-dismiss 3.2s (Task 9)
        </h2>
        <p className="text-xs text-fg-muted mb-3">
          Real caller: gamification/achievement-toast.tsx (form=&quot;success&quot;). Demo
          instances below use a very long autoDismissMs so they stay put for
          inspection instead of vanishing after 3.2s like the real ones do.
        </p>
        <div className="flex flex-col gap-3 max-w-sm">
          <Toast
            form="info"
            icon={<Info size={20} strokeWidth={1.75} />}
            eyebrow="Info"
            title="Đã lưu bản nháp"
            onDismiss={() => {}}
            autoDismissMs={999_999_999}
          />
          <Toast
            form="success"
            icon={<Award size={20} strokeWidth={1.75} />}
            eyebrow="Achievement unlocked"
            title="Chuỗi 7 ngày liên tiếp"
            onDismiss={() => {}}
            autoDismissMs={999_999_999}
          />
          <Toast
            form="error"
            icon={<AlertTriangle size={20} strokeWidth={1.75} />}
            eyebrow="Error"
            title="Không thể kết nối máy chủ"
            action={{ label: "Hoàn tác", onClick: () => {} }}
            onDismiss={() => {}}
            autoDismissMs={999_999_999}
          />
        </div>
      </section>

      <section className="mt-12 mb-12">
        <h2 className="text-lg font-semibold mb-4">
          Input — text / search, height 48, font-size 16px (Task 9)
        </h2>
        <div className="flex flex-col gap-4 max-w-sm">
          <div>
            <p className="text-xs text-fg-muted mb-2">form=&quot;text&quot;</p>
            <Input form="text" placeholder="Nhập từ..." data-testid="input-text" />
          </div>
          <div>
            <p className="text-xs text-fg-muted mb-2">
              form=&quot;search&quot; (real caller: browse/library-client.tsx)
            </p>
            <Input form="search" placeholder="Tìm từ..." data-testid="input-search" />
          </div>
          <div>
            <p className="text-xs text-fg-muted mb-2">disabled</p>
            <Input form="text" placeholder="Không thể nhập" disabled data-testid="input-disabled" />
          </div>
        </div>
      </section>
    </main>
  );
}
