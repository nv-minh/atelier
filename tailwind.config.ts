import type { Config } from "tailwindcss";

const config: Config = {
  // Attribute-based selector, not "class": Tailwind 3.4 (corePlugins.js:264)
  // turns ["selector", X] into addVariant('dark', `&:where(${X}, ${X} *)`),
  // so with X = '[data-theme="dark"]' every existing `dark:` utility keeps
  // working unchanged — the 7 call sites (flashcard.tsx, skeletons.tsx,
  // feedback-strip.tsx, note-editor.tsx, word-detail-client.tsx,
  // lesson-reader.tsx, library-client.tsx) need no edits.
  darkMode: ["selector", '[data-theme="dark"]'],
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Atelier v2 "Studio xanh" palette — see src/styles/tokens.css and
        // design spec §5.1. Tier 1 keys read `rgb(var(--x-rgb) / <alpha-value>)`
        // so `/N` opacity works; Tier 2 keys (accent.soft/subtle, tint, glass,
        // overlay, due.subtle, …) read a bare `var(--x)` that already carries
        // baked-in alpha and must NEVER be given a `/N` suffix (see
        // src/styles/design-system.test.ts 4.5).
        canvas: "rgb(var(--bg-canvas-solid-rgb) / <alpha-value>)",
        surface: {
          DEFAULT: "rgb(var(--bg-surface-rgb) / <alpha-value>)",
          alt: "rgb(var(--bg-surface-alt-rgb) / <alpha-value>)",
        },
        sunken: "rgb(var(--bg-sunken-rgb) / <alpha-value>)",
        fg: {
          DEFAULT: "rgb(var(--fg-default-rgb) / <alpha-value>)",
          muted: "rgb(var(--fg-muted-rgb) / <alpha-value>)",
          subtle: "rgb(var(--fg-subtle-rgb) / <alpha-value>)",
          "on-accent": "rgb(var(--fg-on-accent-rgb) / <alpha-value>)",
          "on-tint": "rgb(var(--fg-on-tint-rgb) / <alpha-value>)",
        },
        accent: {
          DEFAULT: "rgb(var(--accent-rgb) / <alpha-value>)",
          hover: "rgb(var(--accent-hover-rgb) / <alpha-value>)",
          active: "rgb(var(--accent-active-rgb) / <alpha-value>)",
          fg: "rgb(var(--accent-fg-rgb) / <alpha-value>)",
          soft: "var(--accent-soft)",     // Tier 2 — KHÔNG nhận /N
          subtle: "var(--accent-subtle)", // Tier 2 — KHÔNG nhận /N
        },
        hairline: "rgb(var(--border-hairline-rgb) / <alpha-value>)",
        strong: "rgb(var(--border-strong-rgb) / <alpha-value>)",
        due: { DEFAULT: "rgb(var(--due-rgb) / <alpha-value>)", subtle: "var(--due-subtle)" },
        mastered: { DEFAULT: "rgb(var(--mastered-rgb) / <alpha-value>)", subtle: "var(--mastered-subtle)" },
        correct: { DEFAULT: "rgb(var(--correct-rgb) / <alpha-value>)", subtle: "var(--correct-subtle)" },
        wrong: { DEFAULT: "rgb(var(--wrong-rgb) / <alpha-value>)", subtle: "var(--wrong-subtle)" },

        // ── LEGACY · trỏ lại token v2, XOÁ Ở PLAN 8 — spec §5.4 ────────────
        // Không xoá các key này: ~500 chỗ chưa viết lại đọc chúng và phải lên
        // màu mới ngay. cefr.a1…c1 trỏ vào thang xanh 5 bậc → con dấu CEFR
        // §2.3 có sẵn. Ramp số cũ (ink.50-900, paper 50-400, ember 50-300 +
        // 600-900) bị xoá — grep xác nhận không còn call site thật nào dùng
        // chúng (xem task-3-report.md). paper.200, ember.400, ember.500 giữ
        // lại vì CÓ call site thật; ember.400/500 cố ý giữ nguyên hex CŨ
        // (không đổi sang token mới) — xem ghi chú trong report, đây là quyết
        // định cần người xem, task này không tự chế giá trị mới cho ramp.
        paper: {
          DEFAULT: "rgb(var(--bg-canvas-solid-rgb) / <alpha-value>)",
          200: "rgb(var(--bg-sunken-rgb) / <alpha-value>)",
        },
        ink: { DEFAULT: "rgb(var(--fg-default-rgb) / <alpha-value>)" },
        ember: {
          DEFAULT: "rgb(var(--accent-rgb) / <alpha-value>)",
          // Both shades feed the "Hard" rating swatch (rating-buttons.tsx,
          // session-summary.tsx) — an amber/caution role, not the primary
          // accent. `--due` is the token already built for exactly that hue
          // and tuned for both themes, so this isn't a new invented value:
          // it's routing an overloaded v1 accent to the v2 role it always
          // meant. Real primitive (RatingBar reading `due` directly) lands
          // in Plan 5; these two ramp entries die then.
          400: "rgb(var(--due-rgb) / <alpha-value>)",
          500: "rgb(var(--due-rgb) / <alpha-value>)",
        },
        moss: {
          400: "rgb(var(--correct-rgb) / <alpha-value>)",
          500: "rgb(var(--correct-rgb) / <alpha-value>)",
          600: "rgb(var(--correct-rgb) / <alpha-value>)",
        },
        cefr: {
          a1: "rgb(var(--p-blue-200-rgb) / <alpha-value>)",
          a2: "rgb(var(--p-blue-400-rgb) / <alpha-value>)",
          b1: "rgb(var(--p-blue-500-rgb) / <alpha-value>)",
          b2: "rgb(var(--p-blue-600-rgb) / <alpha-value>)",
          c1: "rgb(var(--p-blue-800-rgb) / <alpha-value>)",
        },
      },
      // Tailwind 3.4's opacity scale has no 8 or 12, so `bg-ember/12`,
      // `bg-ink/8`, etc. emitted nothing. Add them (used across the app for
      // subtle tints) rather than rewriting ~150 call sites.
      opacity: {
        8: ".08",
        12: ".12",
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      // Looser than before on both axes, for two reasons that only show up in
      // Vietnamese. Line height first: "Học tiếng Anh / và nhớ được lâu." stacks
      // a bottom-dot ọ over a top-accent ớ, and at 0.95 those two marks collide
      // at hero size. Tracking second: Literata is a serif, so it needs less
      // negative letter-spacing than the grotesque these values were tuned for.
      fontSize: {
        "display-xl": ["clamp(3rem, 8vw, 6rem)", { lineHeight: "1.02", letterSpacing: "-0.02em" }],
        "display-lg": ["clamp(2.25rem, 5vw, 3.75rem)", { lineHeight: "1.06", letterSpacing: "-0.016em" }],
        "display-md": ["clamp(1.75rem, 3.5vw, 2.5rem)", { lineHeight: "1.1", letterSpacing: "-0.012em" }],
        hero: ["var(--text-hero)", { lineHeight: "var(--leading-tight)", letterSpacing: "var(--tracking-display)" }],
        d1: ["var(--text-d1)", { lineHeight: "var(--leading-tight)", letterSpacing: "var(--tracking-display)" }],
        h1: ["var(--text-h1)", { lineHeight: "var(--leading-snug)" }],
        h2: ["var(--text-h2)", { lineHeight: "var(--leading-snug)" }],
        h3: ["var(--text-h3)", { lineHeight: "var(--leading-snug)" }],
        "2xs": ["var(--text-2xs)", { lineHeight: "1.3", letterSpacing: "var(--tracking-overline)" }],
      },
      borderRadius: {
        "4xl": "2rem",
        xs: "var(--r-xs)", sm: "var(--r-sm)", md: "var(--r-md)",
        lg: "var(--r-lg)", xl: "var(--r-xl)", "2xl": "var(--r-2xl)", pill: "var(--r-pill)",
      },
      boxShadow: {
        "soft": "0 2px 8px -2px rgba(31, 28, 22, 0.06), 0 8px 24px -8px rgba(31, 28, 22, 0.08)",
        "soft-lg": "0 4px 16px -4px rgba(31, 28, 22, 0.08), 0 16px 48px -12px rgba(31, 28, 22, 0.12)",
        "inset-line": "inset 0 -1px 0 0 rgba(31, 28, 22, 0.06)",
        xs: "var(--shadow-xs)", sm: "var(--shadow-sm)", md: "var(--shadow-md)",
        lg: "var(--shadow-lg)", accent: "var(--shadow-accent)", "card-lift": "var(--shadow-card-lift)",
        // "ember" key REMOVED — grep confirmed 0 real call sites for
        // `shadow-ember` in src/ (safe cleanup, see task-3-report.md).
      },
      backgroundImage: {
        // "paper-grain" key REMOVED — grep confirmed 0 real call sites for
        // `bg-paper-grain` in src/ (the only hits were English prose mentioning
        // "paper-grain" in comments, not a class usage); safe cleanup alongside
        // the body::before removal in globals.css.
        canvas: "var(--bg-canvas)",
        "accent-gradient": "var(--accent-gradient)",
        "glow-3d": "var(--glow-3d)",
      },
      spacing: {
        gutter: "var(--gutter)",
        nav: "var(--pad-bottom-nav)",
        "safe-t": "var(--safe-t)",
        "safe-b": "var(--safe-b)",
      },
      maxWidth: { content: "var(--content-max)", "content-wide": "var(--content-max-wide)" },
      minHeight: {
        screen: "100dvh", // OVERRIDES Tailwind's core value — every existing
        // `min-h-screen` in the app becomes 100dvh automatically.
        tap: "var(--tap-min)",
      },
      zIndex: {
        base: "var(--z-base)", sticky: "var(--z-sticky)", appbar: "var(--z-appbar)",
        tabbar: "var(--z-tabbar)", sheet: "var(--z-sheet)", overlay: "var(--z-overlay)",
        toast: "var(--z-toast)", tooltip: "var(--z-tooltip)",
      },
      transitionDuration: {
        instant: "var(--dur-instant)", fast: "var(--dur-fast)",
        base: "var(--dur-base)", slow: "var(--dur-slow)", flip: "var(--dur-flip)",
      },
      transitionTimingFunction: {
        standard: "var(--ease-standard)", out: "var(--ease-out)",
        spring: "var(--ease-spring)", bounce: "var(--ease-bounce)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "shimmer": {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.5s cubic-bezier(0.22, 1, 0.36, 1) both",
        "shimmer": "shimmer 2s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
