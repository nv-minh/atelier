"use client";

import { useEffect } from "react";
import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import type { ButtonVariant, ButtonSize } from "@/lib/ui/button-classes";

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
      className="fixed top-4 right-4 z-50 card-atelier px-3 py-1.5 text-sm cursor-pointer"
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
        Component gallery — Button/IconButton primitive (Plan 1 Task 6).
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
    </main>
  );
}
