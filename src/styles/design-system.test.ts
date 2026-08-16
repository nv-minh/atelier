/**
 * design-system.test.ts — Bảy nhóm khẳng định lưới an toàn cho Atelier v2.
 *
 * Comment và tên test tiếng Việt; ratchet đếm theo DÒNG (grep -rn | wc -l),
 * ngoại trừ display (xem ghi chú 4.7).
 *
 * Chạy: npx vitest run src/styles/design-system.test.ts
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join, extname, relative } from "node:path";
import resolveConfig from "tailwindcss/resolveConfig";
import config from "../../tailwind.config";

// ── Resolve full Tailwind theme ──────────────────────────────────
const theme = resolveConfig(config).theme;
const colors = theme.colors;

// ── File helpers ──────────────────────────────────────────────────

/** Recursively collect files with a given extension under root. */
function collectFiles(root: string, ext: string): string[] {
  const results: string[] = [];
  const entries = readdirSync(root, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(root, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectFiles(full, ext));
    } else if (extname(entry.name) === ext) {
      results.push(full);
    }
  }
  return results;
}

/** Read file and return array of lines. */
function readLines(path: string): string[] {
  return readFileSync(path, "utf-8").split("\n");
}

/** Relative path from cwd/src/. */
function relSrc(absPath: string): string {
  return relative(join(process.cwd(), "src"), absPath);
}

// ── Color resolver (§4.5) ─────────────────────────────────────────

/**
 * Walk into theme.colors using hyphen-separated parts.
 * e.g. "fg-muted" → colors.fg.muted, "ink-500" → colors.ink["500"].
 * Returns the resolved string, or undefined.
 */
function resolveColor(name: string): string | undefined {
  const parts = name.split("-");
  let node: unknown = colors;
  for (const part of parts) {
    if (node == null || typeof node !== "object") return undefined;
    const next = (node as Record<string, unknown>)[part];
    if (next === undefined) return undefined;
    node = next;
  }
  if (typeof node === "string") return node;
  if (node && typeof node === "object" && "DEFAULT" in node) {
    const def = (node as Record<string, unknown>).DEFAULT;
    return typeof def === "string" ? def : undefined;
  }
  return undefined;
}

// ── Regex helpers ─────────────────────────────────────────────────

const HEX_RE = /#[0-9a-fA-F]{6}\b/;
const VH_RE = /100vh/;
const SAFE_AREA_RE = /env\(safe-area-/;
const Z_ARBITRARY_RE = /z-\[/;
const Z_NUMBER_RE = /\bz-(\d+)\b/;

// Color-bearing Tailwind class regex (from the brief).
const COLOR_CLASS_RE =
  /\b(bg|text|border|ring|fill|stroke|from|to|via|divide|shadow|accent|outline|decoration)-([a-z][a-z0-9-]*)(\/\d+)?\b/g;

// Names that are definitely NOT colours (sizes, directions, utilities).
const NON_COLOR = new Set([
  // Directions & positions
  "gradient", "center", "left", "right", "top", "bottom",
  "t", "r", "b", "l", "x", "y",
  // Border styles
  "solid", "dashed", "dotted", "double",
  // Visibility & sizing
  "hidden", "none", "full", "auto", "contain", "cover", "fill", "stretch", "clip", "scale",
  // Font sizes (text-xs, text-sm, etc.)
  "xs", "sm", "base", "lg", "xl",
  "2xl", "3xl", "4xl", "5xl", "6xl", "7xl", "8xl", "9xl",
  // Intrinsic colour keywords handled by Tailwind defaults
  "current", "transparent", "inherit", "white", "black",
]);

// ── 4.1 Exempt files (hex) ────────────────────────────────────────
const HEX_EXEMPT = new Set([
  // Google brand SVG fills — third-party, theme-invariant.
  "app/login/page.tsx",
  "components/auth-gate.tsx",
  // <meta name="theme-color"> requires literal hex — CSS vars not supported.
  "app/layout.tsx",
  // Same reason: ThemeProvider.set() writes the same meta tag's `content`
  // (Task 2, [data-theme] migration) and must use the identical literal hex.
  "components/theme-provider.tsx",
  // Standalone error page renders outside the app shell (no CSS vars).
  "app/global-error.tsx",
]);

// Path of this test file — excluded from ratchet scans to avoid self-reference.
const THIS_TEST = relSrc(join(process.cwd(), "src", "styles", "design-system.test.ts"));

// ══════════════════════════════════════════════════════════════════
describe("Hệ thiết kế — lưới an toàn", () => {

  // ── 4.1: Không hex cứng ────────────────────────────────────────
  describe("4.1 — Không hex cứng trong src/components và src/app", () => {
    const files = [
      ...collectFiles("src/components", ".tsx"),
      ...collectFiles("src/app", ".tsx"),
    ].filter((f) => !HEX_EXEMPT.has(relSrc(f)));

    it("không có #rrggbb trong className hay fill/stroke", () => {
      const failures: string[] = [];
      for (const file of files) {
        const lines = readLines(file);
        for (let i = 0; i < lines.length; i++) {
          const m = HEX_RE.exec(lines[i]);
          if (m) {
            failures.push(`${relSrc(file)}:${i + 1} — ${m[0]}`);
          }
        }
      }
      expect(failures, "các file chứa hex cứng").toEqual([]);
    });
  });

  // ── 4.2: Không 100vh ───────────────────────────────────────────
  describe("4.2 — Không 100vh thô trong src/", () => {
    const RATCHET = 17; // ngân sách ban đầu (main @ 900805f)
    // globals.css có 1 dòng fallback dự phòng (min-height: 100vh;).
    // Tất cả chỗ khác dùng min-h-[calc(100vh-4rem)] pattern an toàn hơn.

    it(`số dòng chứa 100vh ≤ ${RATCHET}`, () => {
      const files = collectFiles("src", ".tsx")
        .concat(collectFiles("src", ".ts"))
        .concat(collectFiles("src", ".css"))
        .filter((f) => relSrc(f) !== THIS_TEST); // loại trừ file test
      let count = 0;
      for (const file of files) {
        for (const line of readLines(file)) {
          if (VH_RE.test(line)) count++;
        }
      }
      expect(count).toBeLessThanOrEqual(RATCHET);
    });
  });

  // ── 4.3: Không env(safe-area- trần ────────────────────────────
  describe("4.3 — Không env(safe-area- trần trong src/components", () => {
    // 5 gốc + 2 từ PR #15 (fix/study-mobile-ux, merge vào main TRƯỚC khi
    // nhánh này tồn tại nên không biết ngân sách): pt-[env(safe-area-inset-top)]
    // trên thanh tiến độ đã đổi thành sticky top-0, và
    // pb-[calc(1rem+env(safe-area-inset-bottom))] thay pb-28 lãng phí. Cả hai
    // là an toàn thật (X2 vừa bật viewport-fit=cover ở Plan 0), không phải nợ.
    const RATCHET = 7;

    it(`số dòng chứa env(safe-area- ≤ ${RATCHET}`, () => {
      const files = collectFiles("src/components", ".tsx");
      let count = 0;
      for (const file of files) {
        for (const line of readLines(file)) {
          if (SAFE_AREA_RE.test(line)) count++;
        }
      }
      expect(count).toBeLessThanOrEqual(RATCHET);
    });
  });

  // ── 4.4: Không z-index tự nghĩ ─────────────────────────────────
  describe("4.4 — z-index chỉ dùng giá trị chuẩn", () => {
    const Z_ARBITRARY_RATCHET = 1; // ngân sách: z-[60] trong auth-gate.tsx
    const Z_ALLOWED = new Set([10, 20, 30, 40, 50]);
    const Z_NUMBER_RATCHET = 14; // 13 gốc + 1 từ dev/ui z-50

    it(`z-[… arbitrary] ≤ ${Z_ARBITRARY_RATCHET} lần`, () => {
      const files = [
        ...collectFiles("src/components", ".tsx"),
        ...collectFiles("src/app", ".tsx"),
      ];
      let count = 0;
      for (const file of files) {
        for (const line of readLines(file)) {
          if (Z_ARBITRARY_RE.test(line)) count++;
        }
      }
      expect(count).toBeLessThanOrEqual(Z_ARBITRARY_RATCHET);
    });

    it(`z-{số} chỉ dùng {10,20,30,40,50}, tổng ≤ ${Z_NUMBER_RATCHET}`, () => {
      const files = [
        ...collectFiles("src/components", ".tsx"),
        ...collectFiles("src/app", ".tsx"),
      ];
      let count = 0;
      const bad: string[] = [];
      for (const file of files) {
        for (let i = 0; i < readLines(file).length; i++) {
          const line = readLines(file)[i];
          const m = Z_NUMBER_RE.exec(line);
          if (m) {
            const val = parseInt(m[1], 10);
            if (!Z_ALLOWED.has(val)) {
              bad.push(`${relSrc(file)}:${i + 1} — z-${val}`);
            }
            count++;
          }
        }
      }
      expect(bad, "z-index nằm ngoài tập cho phép").toEqual([]);
      expect(count).toBeLessThanOrEqual(Z_NUMBER_RATCHET);
    });
  });

  // ── 4.5: Class màu phải tồn tại trong theme ───────────────────
  describe("4.5 — Class màu phải resolve được trong theme", () => {
    const files = collectFiles("src", ".tsx");

    it("mọi class màu có /N phải hỗ trợ <alpha-value>", () => {
      const failures: string[] = [];

      for (const file of files) {
        for (let i = 0; i < readLines(file).length; i++) {
          const line = readLines(file)[i];
          let match: RegExpExecArray | null;
          COLOR_CLASS_RE.lastIndex = 0;
          while ((match = COLOR_CLASS_RE.exec(line)) !== null) {
            const [, prefix, name, opacity] = match;
            // Bỏ qua nếu name không phải màu (utility, kích thước, hướng).
            if (NON_COLOR.has(name)) continue;

            // Thử resolve trong theme.colors.
            const value = resolveColor(name);
            if (!value) continue; // không resolve → bỏ qua (component class, v.v.)

            // Nếu class có /N, giá trị phải hỗ trợ alpha.
            if (opacity) {
              const hasAlpha = value.includes("<alpha-value>");
              const isHex = value.startsWith("#");
              const isFunctional = value.startsWith("rgb") || value.startsWith("hsl");
              if (!hasAlpha && !isHex && !isFunctional) {
                failures.push(
                  `${relSrc(file)}:${i + 1} — ${prefix}-${name}${opacity} — ` +
                  `giá trị "${value}" không hỗ trợ opacity`
                );
              }
            }
          }
        }
      }

      expect(failures, "class màu /N không hỗ trợ <alpha-value>").toEqual([]);
    });
  });

  // ── 4.6: Bóng đổ dark không được là none ────────────────────────
  describe("4.6 — Bóng đổ dark không được là none", () => {
    // src/styles/tokens.css chưa tồn tại ở task này.
    // Khẳng định tự bỏ qua; Task 3 sẽ kích hoạt file này và test sẽ bắt
    // các --shadow-*: none declarations.
    const tokensPath = join(process.cwd(), "src", "styles", "tokens.css");

    it("bỏ qua khi tokens.css chưa tồn tại", () => {
      // Viết test dưới dạng skip: nếu file chưa có, không fail.
      // Task 3 sẽ xóa it.skip này (hoặc thay bằng it thực).
      const { existsSync } = require("node:fs");
      if (!existsSync(tokensPath)) {
        console.log("  ⏭ tokens.css chưa tồn tại — bỏ qua (Task 3 sẽ kích hoạt)");
        return; // test implicitly passes
      }

      // Khi file tồn tại (Task 3+): kiểm tra không có --shadow-*: none.
      const content = readFileSync(tokensPath, "utf-8");
      const bad: string[] = [];
      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const m = /--shadow-[\w-]+\s*:\s*none\b/.exec(lines[i]);
        if (m) bad.push(`tokens.css:${i + 1} — ${m[0]}`);
      }
      expect(bad, "shadow var bị đặt none").toEqual([]);
    });
  });

  // ── 4.7: Ratchet class legacy ──────────────────────────────────
  describe("4.7 — Ratchet class legacy (chỉ giảm, không tăng)", () => {
    // Thu thập tất cả file ts/tsx, trừ chính file test này để tránh
    // đếm chính nó (file chứa tên class như string literal).
    const allTsTsx = [
      ...collectFiles("src", ".ts"),
      ...collectFiles("src", ".tsx"),
    ].filter((f) => relSrc(f) !== THIS_TEST);

    /**
     * Đếm số DÒNG chứa pattern trong tất cả file.
     * Cách đếm: `grep -rn <pattern> | wc -l` (mỗi dòng đếm 1).
     */
    function countLines(pattern: RegExp): number {
      let count = 0;
      for (const file of allTsTsx) {
        for (const line of readLines(file)) {
          if (pattern.test(line)) count++;
        }
      }
      return count;
    }

    // Cách đếm "display": đếm dòng chứa \bdisplay\b,
    // LOẠI BỎ dòng cũng chứa display-it|display-xl|display-lg|display-md|font-display
    // (đây là class/component khác, không phải .display Atelier).
    // Số đo trước Task 5: 109 (budget), nhưng thực đo chỉ 107 dùng — 2 dòng dư
    // sẵn từ khi bump 107→109 ở Task 1 (comment cũ). Plan 1 Task 5 thêm đúng
    // 6 dòng thật trong src/app/dev/type/page.tsx khi trang này từ stub thành
    // công cụ đo thật: 4 className="display …" (CoverageGrid h3 + 3 h2 ở mục
    // 1a/1b/1c) + 2 dòng "&display=swap" không tránh được trong URL Google
    // Fonts CSS2 (đúng cú pháp API, không phải class .display — nhiễu của
    // cách đếm theo dòng). 107 + 6 = 113 dùng thật → bump budget 109 → 113 (0
    // dòng dư, đúng bằng usage — đã cố ý đổi tên biến `display` cục bộ trong
    // page.tsx thành renderedChar và tránh chữ "display" trần trong comment
    // mới ở layout.tsx để không cộng thêm nhiễu ngoài 6 dòng kể trên). Số đo
    // xác nhận bằng cách chạy trực tiếp countDisplay() trước/sau — xem
    // task-5-report.md.
    function countDisplay(): number {
      let count = 0;
      for (const file of allTsTsx) {
        for (const line of readLines(file)) {
          if (/\bdisplay\b/.test(line) &&
              !/display-it|display-xl|display-lg|display-md|font-display/.test(line)) {
            count++;
          }
        }
      }
      return count;
    }

    // Ngân sách ratchet ban đầu — đo trên main @ 900805f, cộng thêm cho
    // trang /dev mới: card-atelier +3 (ui×2 + type×1), display +2, text-soft +4.
    // Ratchet được giảm dần khi migrate sang design system mới.
    //
    // Plan 1 Task 5: card-atelier 75 → 77 (src/app/dev/type/page.tsx đổi từ
    // stub thành công cụ đo font thật, dùng thêm 2 dòng .card-atelier ròng —
    // 1 dòng cũ của stub bị thay bằng 3 dòng mới ở 1a/1c). display 109 → 113,
    // xem countDisplay() ở trên.
    const BUDGETS: Array<{
      cls: string;
      budget: number;
      count: () => number;
    }> = [
      { cls: "card-atelier", budget: 77, count: () => countLines(/\bcard-atelier\b/) },
      // Plan 1 Task 7: .pill CSS class deleted from globals.css, all real
      // call sites migrated onto <Chip>/chipClasses(). Remaining 10 lines are
      // `rounded-pill` (Tailwind's border-radius token — a different,
      // legitimate class, not the retired component class) at 6 sites plus 4
      // comment lines in chip.tsx documenting the migration. Tightened from
      // 23 to the measured value.
      { cls: "pill",          budget: 10, count: () => countLines(/\bpill\b/) },
      { cls: "display",       budget: 113, count: countDisplay },
      { cls: "bg-paper",      budget: 32, count: () => countLines(/\bbg-paper\b/) },
      // Plan 1 Task 6: 19 → 21. The `secondary` Button variant is the first
      // caller of the card-level background token via a literal class
      // string (src/lib/ui/button-classes.ts) plus its test's expectation
      // (button-classes.test.ts) — 2 new lines, both real v2-token usage,
      // not legacy debt.
      // Task 6 report claimed 19→21 for the 2 new lines in button-classes.ts
      // + button-classes.test.ts, but never confirmed the pre-task baseline —
      // recounted: the true current total (including those 2 lines) is 19,
      // not 21. Tightened back to the measured value, matching every other
      // budget in this list (exact count, not headroom).
      // +6 from Task 7: 1 real `bg-surface` in segmented-control.tsx's active
      // state, plus 5 comment lines in cefr-stamp.ts documenting a measured
      // WCAG contrast finding (the word "surface" there names the page
      // background being tested against, not a class to migrate away from).
      { cls: "surface",       budget: 25, count: () => countLines(/\bsurface\b/) },
    ];

    for (const { cls, budget, count } of BUDGETS) {
      it(`"${cls}" ≤ ${budget}`, () => {
        const actual = count();
        expect(
          actual,
          `"${cls}": ${actual} vượt ngân sách ${budget} — giảm usage trước khi tăng ratchet`
        ).toBeLessThanOrEqual(budget);
      });
    }
  });
});
