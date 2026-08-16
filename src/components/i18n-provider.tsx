"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { dictionaries, DEFAULT_LANG, type Lang } from "@/lib/i18n/dictionaries";

type I18nCtx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
};

const Ctx = createContext<I18nCtx>({
  lang: DEFAULT_LANG,
  setLang: () => {},
  t: (k) => k,
});

const STORAGE_KEY = "lang";

// Keys we've already warned about, so a missing key logs once instead of
// once per render (this fires on every render of the affected component).
const warnedMissingKeys = new Set<string>();

// Walks `dict` following the dot-separated `key`. Distinguishes two distinct
// failure shapes so callers don't conflate them:
// - "miss": some segment along the path doesn't exist at all.
// - "non-string": the path fully resolves, but the leaf is an object rather
//   than a string (e.g. `key` names a section like "topics", not a leaf).
type Walk = { found: true; value: string } | { found: false; reason: "miss" | "non-string" };

function walk(dict: Record<string, any>, key: string): Walk {
  const parts = key.split(".");
  let cur: any = dict;
  for (const p of parts) {
    if (cur && typeof cur === "object" && p in cur) cur = cur[p];
    else return { found: false, reason: "miss" };
  }
  return typeof cur === "string" ? { found: true, value: cur } : { found: false, reason: "non-string" };
}

// Resolves `key` against `dict`, falling back to `fallbackDict` (always
// dictionaries.en) when the lookup misses in production.
//
// Rationale: showing an English string to a Vietnamese user is a rough edge,
// but showing the raw key ("topics.blurbs.medical") to production users is
// far worse — it looks broken, not just untranslated. In dev we want the
// opposite: a loud console.warn (once per key, not once per render) and the
// raw key returned, so a developer notices immediately instead of silently
// falling back to English and shipping a hole in the vi dictionary. The
// coverage test in src/lib/i18n/coverage.test.ts is the real guardrail —
// both of these paths should be unreachable at runtime once it stays green.
function resolve(dict: Record<string, any>, key: string, fallbackDict?: Record<string, any>): string {
  const result = walk(dict, key);
  if (result.found) return result.value;

  // Pre-existing behavior: a key that resolves to an object (not a leaf
  // string) always returns the key as-is. This is a caller bug (e.g. `t`
  // called with a section key), not a missing translation, so it must never
  // fall through to the dev-warn or fallbackDict branches below.
  if (result.reason === "non-string") return key;

  // Genuine miss: no segment of the path exists in `dict`.
  if (process.env.NODE_ENV !== "production") {
    if (!warnedMissingKeys.has(key)) {
      warnedMissingKeys.add(key);
      console.warn(`[i18n] missing key: "${key}"`);
    }
    return key;
  }

  if (fallbackDict) {
    const fallback = walk(fallbackDict, key);
    if (fallback.found) return fallback.value;
  }
  return key;
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  // Default to DEFAULT_LANG so server render and first client render match (no hydration mismatch).
  const [lang, setLangState] = useState<Lang>(DEFAULT_LANG);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as Lang | null;
      if (stored && (stored === "vi" || stored === "en") && stored !== lang) {
        setLangState(stored);
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {}
    document.documentElement.lang = l;
  }, []);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => {
      let str = resolve(dictionaries[lang], key, dictionaries.en);
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          str = str.replaceAll(`{${k}}`, String(v));
        }
      }
      return str;
    },
    [lang]
  );

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n() {
  return useContext(Ctx);
}
