"use client";

import { useEffect } from "react";

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

// ── /dev/ui — Component gallery ────────────────────────────────────
// Stub. Content will be filled by Tasks 6–9 of Plan 1 (ui-atelier-v2).
export default function DevUIPage() {
  return (
    <main className="shell py-12">
      <ThemeToggle />
      <h1 className="display text-display-lg mb-4">/dev/ui</h1>
      <p className="text-fg-muted text-lg mb-8">
        Component gallery — placeholder. Content arrives in Tasks 6–9.
      </p>
      <div className="card-atelier p-6">
        <p className="text-fg-muted">Preview area — empty for now.</p>
      </div>
    </main>
  );
}
