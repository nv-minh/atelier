"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";

type Theme = "light" | "dark";

// Hex values for <meta name="theme-color">, matched to the --bg-canvas-solid
// token in src/styles/tokens.css (light = :root, dark = :root[data-theme="dark"]).
// Mirrors the inline boot script in src/app/layout.tsx — that script is a
// plain string (dangerouslySetInnerHTML) so it can't import this, but keep
// the two in sync by hand if either changes.
const THEME_COLOR_LIGHT = "#F5F7FF";
const THEME_COLOR_DARK = "#0A0E22";

function applyThemeColorMeta(t: Theme) {
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", t === "dark" ? THEME_COLOR_DARK : THEME_COLOR_LIGHT);
}

const ThemeCtx = createContext<{ theme: Theme; toggle: () => void; set: (t: Theme) => void }>({
  theme: "light",
  toggle: () => {},
  set: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const isDark = document.documentElement.dataset.theme === "dark";
    setTheme(isDark ? "dark" : "light");

    // Follow OS scheme changes only while the user has never made an explicit
    // in-app choice — once "theme" exists in localStorage, an app-side pick
    // always wins over a later OS-level change.
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e: MediaQueryListEvent) => {
      let stored: string | null = null;
      try {
        stored = localStorage.getItem("theme");
      } catch {}
      if (stored) return;
      const next: Theme = e.matches ? "dark" : "light";
      document.documentElement.dataset.theme = next;
      applyThemeColorMeta(next);
      setTheme(next);
    };
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  const set = useCallback((t: Theme) => {
    setTheme(t);
    try {
      localStorage.setItem("theme", t);
    } catch {}
    document.documentElement.dataset.theme = t;
    applyThemeColorMeta(t);
  }, []);

  const toggle = useCallback(() => {
    set(theme === "dark" ? "light" : "dark");
  }, [theme, set]);

  return <ThemeCtx.Provider value={{ theme, toggle, set }}>{children}</ThemeCtx.Provider>;
}

export const useTheme = () => useContext(ThemeCtx);
