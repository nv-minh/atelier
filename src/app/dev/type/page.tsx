"use client";

import { useEffect, useState } from "react";

// ── /dev/type — Font & glyph-coverage prover ─────────────────────────
//
// This is the tool Plan 1 Task 5 uses to prove (not assume) that a candidate
// font family actually contains a glyph, before it's wired into next/font in
// src/app/layout.tsx. See docs/superpowers/specs/2026-08-16-ui-atelier-v2-design.md
// §7 R7 for the ruling this exists to verify, and scripts/ui/check-type.mjs
// for the Playwright gate that reads this page's DOM.
//
// Why eyeballing a rendered string is not enough: Google Fonts' multi-subset
// CSS declares `unicode-range` per @font-face rule based on what the FONT
// FORMAT CLAIMS to cover, not what glyphs the woff2 file actually contains.
// ec6206e (2026-08-15) hit exactly this — the old mono family's latin-ext
// subset claimed the IPA Extensions block (U+0250–02AF) in its unicode-range
// but shipped no glyphs there, so the browser matched the range, downloaded
// the file, found nothing, and silently substituted a system font mid-word.
// A screenshot of that looks fine unless you know which characters to
// distrust. The fix here is mechanical: render the SAME character with the
// SAME candidate family but two DIFFERENT generic fallbacks appended
// (`monospace` vs `serif`, which have different metrics for virtually every
// glyph). If the candidate family has a real glyph, both measurements read
// off that glyph and land on the same width. If it doesn't, resolution falls
// through past the candidate to whichever generic comes next in each
// font-family list, and the two generics disagree.

const IPA_TORTURE =
  "/əbˈdʌk.ʃn̩/  /ˌækəˈdemɪk/  /ˈθɜːrəfɔːr/  ʒ ð ŋ ɒ ɑː ɔɪ eə ʊə ɡ ʃ ɪ ʊ ʌ ɔ ɜ ː ˈ ˌ n̩";
const VI_TORTURE = "Học tiếng Anh và nhớ được lâu — ệ ặ ỡ ữ ợ ẩ ẳ ỷ Ơ Ư Đ";

// The spec R7 "bắt buộc" (mandatory) character set is the actual gate — it is
// a superset of IPA_TORTURE (adds ɛ, which the illustrative torture string
// above happens not to contain) union'd with VI_TORTURE. Tested characters
// come from BOTH so the proof covers the ruling exactly, not just the demo
// string.
const R7_IPA_REQUIRED = "ˈˌːɪʊʌɒɔɑɜɛɡʃʒðŋn̩";
const R7_VI_REQUIRED = "ệặỡữợẩẳỷƠƯĐ";

const FALLBACK_A = "monospace";
const FALLBACK_B = "serif";
const DIFF_THRESHOLD_PX = 0.5;

// Temporary, dev-only <link> tags that load the two candidate/regression
// families under their literal Google Fonts family name, independent of
// next/font. This is deliberate, not a shortcut: next/font registers each
// family under a hashed local name (e.g. `__Noto_Sans_Mono_xxxxx`) PLUS an
// auto-generated, metrics-adjusted local-system fallback family appended
// right after it in the resolved font-family list. If we measured through
// that CSS var, a missing glyph would resolve to next/font's own fallback
// family (which is a real, always-available local font) before ever
// reaching our `monospace`/`serif` probes — both measurements would agree
// by accident, on a font that isn't the one being tested. Loading the
// literal family name here, with nothing else in the font-family list
// between it and our own two probes, is what makes the width-mismatch
// trick actually detect a missing glyph.
const GOOGLE_FONTS_LINKS: { id: string; href: string }[] = [
  {
    id: "dev-type-be-vietnam-pro",
    href: "https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700;800&display=swap",
  },
  {
    id: "dev-type-noto-sans-mono",
    href: "https://fonts.googleapis.com/css2?family=Noto+Sans+Mono:wght@400&display=swap",
  },
];

type GlyphResult = {
  char: string;
  family: string;
  codepoint: string;
  w1: number;
  w2: number;
  diff: number;
  ok: boolean;
};

type FontKbBreakdown = {
  entries: { name: string; kb: number }[];
  totalKb: number;
};

type ProbeState = {
  status: "loading" | "done" | "error";
  error?: string;
  beVietnamPro: GlyphResult[];
  notoSansMono: GlyphResult[];
  prodFontKb: FontKbBreakdown | null;
  testHarnessFontKb: FontKbBreakdown | null;
};

function isCombiningMark(ch: string): boolean {
  const cp = ch.codePointAt(0) ?? 0;
  return (
    (cp >= 0x0300 && cp <= 0x036f) ||
    (cp >= 0x1ab0 && cp <= 0x1aff) ||
    (cp >= 0x1dc0 && cp <= 0x1dff) ||
    (cp >= 0x20d0 && cp <= 0x20ff) ||
    (cp >= 0xfe20 && cp <= 0xfe2f)
  );
}

function codepointLabel(ch: string): string {
  const cp = ch.codePointAt(0) ?? 0;
  return `U+${cp.toString(16).toUpperCase().padStart(4, "0")}`;
}

// Array.from(str), not str.split(""), so astral surrogate pairs never get
// cut in half. Deduped via Set — repeated punctuation/letters across the two
// source strings would otherwise draw the same cell twice for no signal.
// Bare whitespace is dropped: every font resolves a space glyph trivially,
// so testing it adds noise, not proof.
function uniqueChars(...strings: string[]): string[] {
  const seen = new Set<string>();
  for (const s of strings) {
    for (const ch of Array.from(s)) {
      if (ch.trim() === "") continue;
      seen.add(ch);
    }
  }
  return [...seen];
}

const IPA_TEST_CHARS = uniqueChars(R7_IPA_REQUIRED, IPA_TORTURE);
const VI_TEST_CHARS = uniqueChars(R7_VI_REQUIRED, VI_TORTURE);

// Idempotent by id, fire-and-forget: appends the <link> if it isn't already
// in the DOM. Deliberately does NOT return a promise tied to the link's own
// `load` event — see the retry loop in measureFamily() for why: under
// React's Strict Mode, this effect runs twice (mount → cleanup → mount), and
// the second run would find the first run's <link> already present and — if
// it resolved on "element exists" — declare the stylesheet loaded before its
// network request (started by the first run) had actually finished, so
// @font-face rules for `family` might not exist in the CSSOM yet when
// measurement starts right after. Polling document.fonts.load() instead of
// trusting a single load event sidesteps that race entirely.
function ensureStylesheet(id: string, href: string): void {
  if (document.getElementById(id)) return;
  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href = href;
  // Without this, Chromium fetches the @font-face src in no-cors mode and
  // never records a PerformanceResourceTiming entry for the actual woff2 at
  // all (not just a zeroed one — it's absent from getEntriesByType
  // entirely), which silently zeroes out the 1c test-harness KB figure below
  // even though real bytes were transferred. Google's font CDN sends CORS
  // headers either way, so this doesn't change what loads, only whether the
  // browser reports it.
  link.crossOrigin = "anonymous";
  document.head.appendChild(link);
}

async function measureFamily(family: string, chars: string[]): Promise<GlyphResult[]> {
  // Force resolution of whichever unicode-range subset of `family` covers
  // exactly these codepoints. Google's multi-subset CSS declares many
  // disjoint @font-face rules under the same family name; nothing downloads
  // until something on the page needs a glyph inside a given range, so a
  // plain document.fonts.ready is not enough on its own.
  //
  // Retried, not a single call: document.fonts.load() resolves against
  // whatever @font-face rules are ALREADY registered at call time — if the
  // <link rel="stylesheet"> that declares `family` hasn't finished being
  // fetched and parsed yet, there is no matching rule, load() resolves to an
  // empty array immediately (it does not wait for a rule that might show up
  // later), and every character below would then measure a false fallback
  // mismatch — not because the font lacks the glyph, but because the font
  // was never really requested. Polling for a few seconds gives the
  // stylesheet fetch time to land first.
  let matched = false;
  for (let attempt = 0; attempt < 20 && !matched; attempt++) {
    try {
      const loaded = await document.fonts.load(`16px "${family}"`, chars.join(""));
      matched = loaded.length > 0;
    } catch {
      // No matching @font-face at all yet — keep retrying until the budget
      // above runs out, then let the measurement loop report the failure.
    }
    if (!matched) await new Promise((resolve) => setTimeout(resolve, 150));
  }

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  const results: GlyphResult[] = [];
  if (!ctx) return results;

  for (const ch of chars) {
    ctx.font = `16px "${family}", ${FALLBACK_A}`;
    const w1 = ctx.measureText(ch).width;
    ctx.font = `16px "${family}", ${FALLBACK_B}`;
    const w2 = ctx.measureText(ch).width;
    const diff = Math.abs(w1 - w2);
    results.push({
      char: ch,
      family,
      codepoint: codepointLabel(ch),
      w1,
      w2,
      diff,
      ok: diff < DIFF_THRESHOLD_PX,
    });
  }
  return results;
}

function summarizeFontKb(matcher: (url: string) => boolean): FontKbBreakdown {
  const entries = performance
    .getEntriesByType("resource")
    .filter((e) => matcher(e.name))
    .map((e) => {
      const timing = e as PerformanceResourceTiming;
      return { name: timing.name, kb: Math.round(((timing.transferSize ?? 0) / 1024) * 10) / 10 };
    });
  const totalKb = Math.round(entries.reduce((sum, e) => sum + e.kb, 0) * 10) / 10;
  return { entries, totalKb };
}

function GlyphCell({ result }: { result: GlyphResult }) {
  const renderedChar = isCombiningMark(result.char) ? `◌${result.char}` : result.char;
  return (
    <div
      data-testid={result.ok ? "glyph-ok" : "glyph-fail"}
      data-char={result.char}
      data-family={result.family}
      data-codepoint={result.codepoint}
      title={`w(${FALLBACK_A})=${result.w1.toFixed(2)}px  w(${FALLBACK_B})=${result.w2.toFixed(2)}px  diff=${result.diff.toFixed(2)}px`}
      className={`flex flex-col items-center justify-center rounded-md border p-2 text-center ${
        result.ok ? "border-emerald-500/40 bg-emerald-500/10" : "border-red-500/50 bg-red-500/10"
      }`}
    >
      <span className="font-mono text-xl leading-none">{renderedChar}</span>
      <span className="mt-1 text-[10px] text-fg-muted">{result.codepoint}</span>
    </div>
  );
}

function CoverageGrid({ title, results }: { title: string; results: GlyphResult[] }) {
  const failCount = results.filter((r) => !r.ok).length;
  return (
    <div className="card-atelier p-6">
      <div className="mb-4 flex items-baseline justify-between gap-4">
        <h3 className="display text-xl">{title}</h3>
        <span className={failCount === 0 ? "text-emerald-600" : "text-red-600 font-semibold"}>
          {failCount}/{results.length} fell back to a generic
        </span>
      </div>
      <div className="grid grid-cols-8 gap-2 sm:grid-cols-10 md:grid-cols-12">
        {results.map((r) => (
          <GlyphCell key={`${r.family}::${r.codepoint}`} result={r} />
        ))}
      </div>
    </div>
  );
}

function FontKbTable({
  title,
  note,
  data,
  totalTestId,
}: {
  title: string;
  note: string;
  data: FontKbBreakdown | null;
  totalTestId?: string;
}) {
  if (!data) return null;
  return (
    <div>
      <h4 className="mb-1 font-semibold">{title}</h4>
      <p className="mb-2 text-xs text-fg-muted">{note}</p>
      {data.entries.length === 0 ? (
        <p className="text-sm text-fg-muted">No matching resources.</p>
      ) : (
        <ul className="mb-2 space-y-0.5 text-sm">
          {data.entries.map((e) => (
            <li key={e.name} className="truncate" title={e.name}>
              {e.name.split("/").pop()} — {e.kb} KB
            </li>
          ))}
        </ul>
      )}
      <p className="font-mono font-semibold" data-testid={totalTestId} data-kb={data.totalKb}>
        Total: {data.totalKb} KB
      </p>
    </div>
  );
}

export default function DevTypePage() {
  const [state, setState] = useState<ProbeState>({
    status: "loading",
    beVietnamPro: [],
    notoSansMono: [],
    prodFontKb: null,
    testHarnessFontKb: null,
  });

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        for (const l of GOOGLE_FONTS_LINKS) ensureStylesheet(l.id, l.href);

        const [beVietnamPro, notoSansMono] = await Promise.all([
          measureFamily("Be Vietnam Pro", VI_TEST_CHARS),
          measureFamily("Noto Sans Mono", IPA_TEST_CHARS),
        ]);

        // A FontFace's `status` flips to "loaded" (what document.fonts.load()
        // above awaits) slightly before the browser appends the matching
        // PerformanceResourceTiming entry to the buffer — reading
        // getEntriesByType("resource") in the very same tick can miss the
        // just-finished font fetches, especially the Google-CDN ones
        // triggered programmatically here rather than by initial page load.
        await new Promise((resolve) => setTimeout(resolve, 500));

        const prodFontKb = summarizeFontKb((url) => url.includes("/_next/static/media/"));
        const testHarnessFontKb = summarizeFontKb((url) => url.includes("fonts.gstatic.com"));

        if (!cancelled) {
          setState({ status: "done", beVietnamPro, notoSansMono, prodFontKb, testHarnessFontKb });
        }
      } catch (err) {
        if (!cancelled) {
          setState((s) => ({
            ...s,
            status: "error",
            error: err instanceof Error ? err.message : String(err),
          }));
        }
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="shell space-y-10 py-12">
      <div>
        <h1 className="display text-display-lg mb-2">/dev/type</h1>
        <p className="text-fg-muted text-lg">
          Glyph-coverage prover for Plan 1 Task 5 (font swap to Be Vietnam Pro). Dev/preview only —
          404s in production, see src/app/dev/layout.tsx.
        </p>
      </div>

      {/* 1a — eyeball only. Not proof: two glyphs can render as visually
          distinct shapes that are both, coincidentally, the wrong font. */}
      <section className="space-y-4">
        <h2 className="display text-xl">1a — Torture strings (eyeball only, not proof)</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {[
            { family: "Be Vietnam Pro", label: "Be Vietnam Pro — candidate for headings & body text" },
            { family: "Noto Sans Mono", label: "Noto Sans Mono — current mono/IPA (regression check)" },
          ].map(({ family, label }) => (
            <div key={family} className="card-atelier space-y-3 p-6">
              <p className="text-sm font-semibold">{label}</p>
              {[16, 24, 48].map((size) => (
                <div key={size} style={{ fontFamily: `"${family}", sans-serif`, fontSize: `${size}px` }}>
                  <div>{IPA_TORTURE}</div>
                  <div>{VI_TORTURE}</div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>

      {/* 1b — the real proof: per-codepoint canvas measurement. */}
      <section className="space-y-4">
        <h2 className="display text-xl">1b — Codepoint coverage (real proof)</h2>
        <p className="text-fg-muted text-sm">
          Each cell measures one character twice against the same candidate family, with two
          different-metric generic fallbacks appended (<code>monospace</code>, <code>serif</code>). Equal
          widths (&lt;0.5px) mean the candidate family rendered the glyph itself; unequal widths mean
          resolution fell through to the fallback — the candidate has no glyph for that character.
        </p>
        {state.status === "loading" && <p>Measuring…</p>}
        {state.status === "error" && <p className="text-red-600">Probe failed: {state.error}</p>}
        {state.status === "done" && (
          <>
            <CoverageGrid title="Be Vietnam Pro — Vietnamese diacritics" results={state.beVietnamPro} />
            <CoverageGrid title="Noto Sans Mono — IPA transcription (regression check for ec6206e)" results={state.notoSansMono} />
          </>
        )}
      </section>

      {/* 1c — real transferred KB, split so the production figure (what
          every real page load ships) isn't inflated by this page's own
          test-harness <link> fetches. */}
      <section className="space-y-4">
        <h2 className="display text-xl">1c — Font payload</h2>
        {state.status === "done" ? (
          <div className="card-atelier grid gap-6 p-6 sm:grid-cols-2">
            <FontKbTable
              title="Production (self-hosted via next/font, _next/static/media)"
              note="What every real page load actually ships. Compare against the §11 budget (< 120 KB)."
              data={state.prodFontKb}
              totalTestId="font-kb-total"
            />
            <FontKbTable
              title="Test-harness only (Google CDN, this page's own probe <link>s)"
              note="Loaded only by this page for literal-name access to the candidate families before they're wired into next/font. Not part of the production budget."
              data={state.testHarnessFontKb}
            />
          </div>
        ) : (
          <p>Measuring…</p>
        )}
      </section>

      {state.status === "done" && <div data-testid="glyph-probe-done" className="sr-only" />}
    </main>
  );
}
