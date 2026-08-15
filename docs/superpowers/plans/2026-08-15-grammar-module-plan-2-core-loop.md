# Grammar Module — Plan 2/3: Vòng lặp học cốt lõi (hub → lý thuyết → test → mastery/XP/streak) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Người dùng vào tab "Ngữ pháp" mới, duyệt 33 chủ đề theo 4 cụm, đọc bài lý thuyết song ngữ có span màu ngữ nghĩa + ảnh phóng to được, làm phiên test 10 câu của đúng chủ đề đó, thấy mastery tăng, nhận XP vào sổ `bonusXp` và ngày học ngữ pháp nối được streak.

**Architecture:** Server components đọc thẳng Prisma qua một lib dữ liệu (`src/lib/grammar/data.ts`); ba API mutation (`answer`, `lesson-read`, `session-end`) dùng chung auth/CSRF/rate-limit hiện có; XP đi qua một awarder mới `awardGrammarXp` trong `gamification.ts` (chỉ ghi sổ `bonusXp`, nhận được transaction client để nguyên tử với ghi tiến độ). Session UI là component riêng `GrammarSession` — mượn pattern UX của practice-shell (progress bar, reveal, tap-to-advance, sound/haptics) nhưng KHÔNG tái dụng shell (shell dính chặt FSRS/cardId/rating, grammar server-graded qua API riêng).

**Tech Stack:** Next.js 14 App Router, Prisma 5, motion/react (đã có), lucide-react, vitest.

**Spec:** `docs/superpowers/specs/2026-08-14-grammar-module-design.md` (§5 routes, §6 UX, §7 gamification, §8 error handling). Plan này = phase 2+3 của §10. Plan 1 (data) đã merge (`ad01511`): DB có đủ 33/292/9380/10000/832/687, các lib `src/lib/grammar/*` và ảnh `public/grammar/images/` đã sẵn.

## Global Constraints

- Branch làm việc: tạo `feat/grammar-core-loop` từ `docs/grammar-plan-2` (branch chứa plan này).
- Repo không có ESLint. Comment tiếng Anh trong `src/lib/` + API routes; UI component để comment tiếng Anh theo style hiện hành (nav.tsx, practice-shell.tsx đều comment EN).
- Test: vitest chỉ include `src/**/*.test.{ts,tsx}`, test KHÔNG import prisma/server-only. Logic cần test phải là hàm thuần.
- **XP ngữ pháp chỉ được ghi sổ `bonusXp`** (DailyStat + UserProgress, cùng một transaction) — sổ `xp` là ReviewLog-derived, backfill sẽ xóa mọi thứ ghi nhầm vào đó.
- Hằng số XP (spec §7): `+2`/câu đúng LẦN ĐẦU (sổ cái `GrammarAnswerState.firstCorrectAt`, set đúng một lần — retry/double-submit không thể cộng đôi); `+5` đọc xong bài lần đầu; `+5` hoàn thành phiên đủ 10 câu (idempotent theo sessionKey); câu đã từng đúng → 0 XP.
- **Mastery** = `30% × (bài đã đọc / tổng bài) + 70% × accuracy(ring buffer ≤20 câu test gần nhất)`; dưới 5 câu đã trả lời → hiện "Mới bắt đầu" thay vì %.
- **Streak**: mọi câu trả lời tăng `DailyStat.grammarCount`; `computeStreakFromDb` nới where thành OR — KHÔNG đụng `totalCount` (stats từ vựng phải sạch).
- Ngày tính theo UTC qua `todayStr()` (`src/lib/utils.ts:18`) — giữ nguyên.
- Nội dung song ngữ bám `lang` toàn app (`useI18n()`), KHÔNG tự chế state ngôn ngữ riêng; field VI null → fallback EN + nhãn "bản dịch đang cập nhật".
- HTML bài học trong DB ĐÃ sanitize (Plan 1) — client render `dangerouslySetInnerHTML` thẳng, không sanitize lại.
- 4 chủ đề KHÔNG có câu test (`going-to-future`, `other-tenses`, `comparison-of-tenses`, `participles`) — mọi UI nút test phải ẩn khi `testQuestionCount === 0`.
- `SEMANTIC_SPAN_CLASSES` phải chuyển sang module client-safe TRƯỚC khi client import (hiện nằm trong `lesson-html.ts` vốn import `sanitize-html` — devDependency, kéo vào bundle là build surprise).
- Đọc hub/chủ đề/bài học: public; mọi hành động ghi (test, đánh dấu đã đọc) yêu cầu đăng nhập (pattern `AuthRequired`/`useGuestGuard` của `src/components/auth-gate.tsx`, như `src/app/topics/`).
- API mutation: `isSameOrigin`/`forbiddenCrossOrigin` (csrf), `requireUserId`, `checkRateLimit` — đúng bộ ba như `src/app/api/study/review/route.ts`.
- Tiện sửa spec: cập nhật path cũ `scripts/grammar/import.ts` ở header §4.1 của spec thành `prisma/import-grammar.ts` (mục park từ Plan 1).

---

### Task 1: Nền hiển thị — module semantic classes client-safe, hằng số XP, token màu ngữ pháp + stylesheet `.grammar-prose`

**Files:**
- Create: `src/lib/grammar/semantic-classes.ts`
- Modify: `src/lib/grammar/lesson-html.ts` (chuyển constant sang import/re-export)
- Modify: `src/lib/gamification-defs.ts` (thêm hằng số XP grammar)
- Modify: `src/app/globals.css` (token màu + `.grammar-prose`)
- Modify: `docs/superpowers/specs/2026-08-14-grammar-module-design.md` (§4.1 header: `scripts/grammar/import.ts` → `prisma/import-grammar.ts`)
- Test: suite hiện có phải xanh nguyên vẹn (lesson-html.test.ts không đổi)

**Interfaces:**
- Consumes: `SEMANTIC_SPAN_CLASSES` hiện tại trong `lesson-html.ts`
- Produces: `src/lib/grammar/semantic-classes.ts` exports `SEMANTIC_SPAN_CLASSES: readonly string[]` và `SEMANTIC_LEGEND: { cls: string; labelKey: string }[]` (Task 7 dùng cho chú giải); `gamification-defs.ts` exports `GRAMMAR_XP_FIRST_CORRECT = 2`, `GRAMMAR_XP_LESSON_READ = 5`, `GRAMMAR_XP_SESSION_BONUS = 5`, `GRAMMAR_SESSION_SIZE = 10`; class CSS `.grammar-prose` + CSS vars `--gr-*`.

- [ ] **Step 1: Tạo `src/lib/grammar/semantic-classes.ts`**

```ts
// The 16 semantic span classes present in the imported lesson HTML (measured
// across all 292 lessons × 2 languages in Plan 1). Client-safe, zero-dep:
// the lesson reader's legend and the import-time sanitizer whitelist both
// read this list. It lives OUTSIDE lesson-html.ts on purpose — that module
// imports sanitize-html (a devDependency) and must never reach a client bundle.
export const SEMANTIC_SPAN_CLASSES = [
  "adjective", "adverb", "verb", "subject", "object", "auxiliary",
  "infinitive", "negation", "signal-word", "ending", "irregular-past",
  "irregular-participle", "place", "mistake", "consonant", "vowel",
] as const;

export type SemanticSpanClass = (typeof SEMANTIC_SPAN_CLASSES)[number];

// The classes worth a legend chip, in display order. The conjugation-table
// helpers (ending, irregular-*) and the rare phonetics pair are colored in CSS
// but not chipped — an 8-chip legend already covers what a reader must decode.
export const SEMANTIC_LEGEND: { cls: SemanticSpanClass; labelKey: string }[] = [
  { cls: "subject", labelKey: "grammar.legend.subject" },
  { cls: "verb", labelKey: "grammar.legend.verb" },
  { cls: "auxiliary", labelKey: "grammar.legend.auxiliary" },
  { cls: "infinitive", labelKey: "grammar.legend.infinitive" },
  { cls: "object", labelKey: "grammar.legend.object" },
  { cls: "adjective", labelKey: "grammar.legend.adjective" },
  { cls: "adverb", labelKey: "grammar.legend.adverb" },
  { cls: "negation", labelKey: "grammar.legend.negation" },
];
```

- [ ] **Step 2: Sửa `src/lib/grammar/lesson-html.ts`**

Xóa khai báo mảng `SEMANTIC_SPAN_CLASSES` tại chỗ (giữ nguyên comment dẫn giải nếu muốn, trỏ sang module mới), thay bằng:

```ts
import { SEMANTIC_SPAN_CLASSES } from "./semantic-classes";

// Re-export for existing consumers (the import pipeline and its tests).
export { SEMANTIC_SPAN_CLASSES };
```

`allowedClasses: { span: [...SEMANTIC_SPAN_CLASSES] }` giữ nguyên.

- [ ] **Step 3: Chạy test xác nhận không vỡ**

Run: `npx vitest run src/lib/grammar`
Expected: PASS toàn bộ (30 test hiện có — re-export giữ nguyên hợp đồng).

- [ ] **Step 4: Thêm hằng số XP vào `src/lib/gamification-defs.ts`**

Ngay dưới `export const NONSRS_XP_CAP = 30;`:

```ts
// ── Grammar XP economy (grammar design §7) ───────────────────────────
// All grammar XP lands on the BONUS ledgers (DailyStat.bonusXp +
// UserProgress.bonusXp) via awardGrammarXp — never `xp`, which stays strictly
// ReviewLog-derived so the backfill can rebuild it.
export const GRAMMAR_XP_FIRST_CORRECT = 2; // per question, first-ever correct answer
export const GRAMMAR_XP_LESSON_READ = 5; // per lesson, first "Đã hiểu" only
export const GRAMMAR_XP_SESSION_BONUS = 5; // completing a full round
export const GRAMMAR_SESSION_SIZE = 10; // questions per round
```

- [ ] **Step 5: Token màu + stylesheet trong `src/app/globals.css`**

Vào `:root` (sau `--grain-opacity`), thêm:

```css
    /* Grammar semantic-span palette (grammar design §6). Channel triplets like
       the rest — keep both blocks in sync with the .dark overrides below. */
    --gr-subject: 59 116 166;
    --gr-verb: 181 85 46;
    --gr-auxiliary: 58 141 139;
    --gr-infinitive: 122 82 148;
    --gr-object: 158 74 122;
    --gr-adjective: 91 138 96;
    --gr-adverb: 176 116 24;
    --gr-negation: 185 61 61;
```

Vào `.dark` (sau `--grain-opacity`), thêm:

```css
    --gr-subject: 121 168 210;
    --gr-verb: 219 128 94;
    --gr-auxiliary: 105 184 181;
    --gr-infinitive: 176 141 199;
    --gr-object: 204 128 168;
    --gr-adjective: 133 178 138;
    --gr-adverb: 226 162 74;
    --gr-negation: 226 111 111;
```

Vào `@layer components` (cuối layer), thêm:

```css
  /* ── Grammar lesson typography ─────────────────────────────────────
     Applied to sanitized lesson HTML rendered via dangerouslySetInnerHTML.
     The DB content only contains the whitelisted tags/classes from Plan 1's
     sanitizer, so every selector here targets a known-possible node. */
  .grammar-prose {
    line-height: 1.75;
    font-size: 0.975rem;
  }
  .grammar-prose h1 { display: none; } /* duplicates the page title */
  .grammar-prose h2 {
    font-family: var(--font-display), Georgia, serif;
    font-weight: 420;
    font-size: 1.35rem;
    margin: 2rem 0 0.75rem;
  }
  .grammar-prose h3 { font-weight: 650; font-size: 1.08rem; margin: 1.5rem 0 0.5rem; }
  .grammar-prose h4 { font-weight: 650; font-size: 0.95rem; margin: 1.25rem 0 0.5rem; }
  .grammar-prose p { margin: 0.65rem 0; }
  .grammar-prose ul, .grammar-prose ol { margin: 0.65rem 0 0.65rem 1.35rem; }
  .grammar-prose ul { list-style: disc; }
  .grammar-prose ol { list-style: decimal; }
  .grammar-prose li { margin: 0.3rem 0; }
  .grammar-prose hr { border: 0; border-top: 1px solid rgb(var(--ink-line) / 0.1); margin: 1.75rem 0; }
  .grammar-prose blockquote {
    border-left: 3px solid rgb(var(--ember) / 0.5);
    padding-left: 1rem;
    margin: 1rem 0;
    color: rgb(var(--ink-soft));
  }
  .grammar-prose table {
    width: 100%;
    margin: 1rem 0;
    border-collapse: collapse;
    font-size: 0.9rem;
    display: block;
    overflow-x: auto; /* nguồn có bảng chia thì rất rộng — cuộn trong bảng, không vỡ trang */
  }
  .grammar-prose th, .grammar-prose td {
    border: 1px solid rgb(var(--ink-line) / 0.12);
    padding: 0.45rem 0.7rem;
    text-align: left;
    vertical-align: top;
  }
  .grammar-prose thead th { background-color: rgb(var(--ink) / 0.04); font-weight: 650; }
  .grammar-prose img {
    max-width: 100%;
    height: auto;
    border-radius: 0.75rem;
    margin: 1rem auto;
    display: block;
    cursor: zoom-in;
    background: white; /* timeline PNG nền trắng — giữ đọc được ở dark mode */
    padding: 0.5rem;
  }
  .grammar-prose s, .grammar-prose del { color: rgb(var(--gr-negation)); }
  .grammar-prose sup { font-size: 0.7em; }

  /* Semantic span colors — one hue per grammatical role, stable everywhere. */
  .grammar-prose span.subject { color: rgb(var(--gr-subject)); font-weight: 550; }
  .grammar-prose span.verb { color: rgb(var(--gr-verb)); font-weight: 550; }
  .grammar-prose span.auxiliary { color: rgb(var(--gr-auxiliary)); font-weight: 550; }
  .grammar-prose span.infinitive { color: rgb(var(--gr-infinitive)); font-weight: 550; }
  .grammar-prose span.object { color: rgb(var(--gr-object)); font-weight: 550; }
  .grammar-prose span.adjective { color: rgb(var(--gr-adjective)); font-weight: 550; }
  .grammar-prose span.adverb { color: rgb(var(--gr-adverb)); font-weight: 550; }
  .grammar-prose span.negation { color: rgb(var(--gr-negation)); font-weight: 550; }
  .grammar-prose span.place { color: rgb(var(--gr-adjective)); font-style: italic; }
  .grammar-prose span.ending { color: rgb(var(--ember)); font-weight: 700; }
  .grammar-prose span.irregular-past,
  .grammar-prose span.irregular-participle { color: rgb(var(--gr-verb)); font-weight: 650; }
  .grammar-prose span.signal-word {
    color: rgb(var(--gr-adverb));
    text-decoration: underline dotted rgb(var(--gr-adverb) / 0.6);
    text-underline-offset: 3px;
  }
  .grammar-prose span.mistake { color: rgb(var(--gr-negation)); }
  .grammar-prose span.consonant { color: rgb(var(--gr-subject)); }
  .grammar-prose span.vowel { color: rgb(var(--gr-adverb)); }

  /* Legend chip — colored by the same vars via a CSS custom property the
     component sets inline (style={{ "--chip": `var(--gr-subject)` }}). */
  .grammar-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.7rem;
    padding: 0.15rem 0.55rem;
    border-radius: 999px;
    border: 1px solid rgb(var(--chip) / 0.35);
    color: rgb(var(--chip));
    background-color: rgb(var(--chip) / 0.08);
  }
```

- [ ] **Step 6: Sửa path cũ trong spec §4.1**

Trong `docs/superpowers/specs/2026-08-14-grammar-module-design.md`, header §4.1 — thay `` (`scripts/grammar/import.ts`, `` bằng `` (`prisma/import-grammar.ts`, ``.

- [ ] **Step 7: Build sanity + commit**

Run: `npx tsc --noEmit && npx vitest run src/lib/grammar`
Expected: sạch, 30/30.

```bash
git add src/lib/grammar/semantic-classes.ts src/lib/grammar/lesson-html.ts src/lib/gamification-defs.ts src/app/globals.css docs/superpowers/specs/2026-08-14-grammar-module-design.md
git commit -m "feat(grammar): token màu ngữ nghĩa + grammar-prose; tách semantic-classes client-safe; hằng số XP"
```

---

### Task 2: Mastery thuần (`mastery.ts`)

**Files:**
- Create: `src/lib/grammar/mastery.ts`
- Test: `src/lib/grammar/mastery.test.ts`

**Interfaces:**
- Consumes: —
- Produces: `RECENT_WINDOW = 20` · `MASTERY_MIN_ANSWERED = 5` · `sanitizeRecent(recent: unknown): boolean[]` (đọc Json từ DB an toàn) · `pushRecent(recent: unknown, correct: boolean): boolean[]` (append + cắt còn 20, mới nhất ở CUỐI) · `masteryPct(i: { lessonsRead: number; lessonsTotal: number; recent: unknown; answered: number }): number | null` (null = "Mới bắt đầu"). Task 4 (data lib) và Task 8 (answer API) dùng cả ba.

- [ ] **Step 1: Viết test fail**

```ts
// src/lib/grammar/mastery.test.ts
import { describe, expect, it } from "vitest";
import { MASTERY_MIN_ANSWERED, RECENT_WINDOW, masteryPct, pushRecent, sanitizeRecent } from "./mastery";

describe("sanitizeRecent", () => {
  it("accepts a boolean array and coerces truthiness", () => {
    expect(sanitizeRecent([true, false, 1, 0, "x"])).toEqual([true, false, true, false, true]);
  });
  it("returns [] for null/garbage json values", () => {
    expect(sanitizeRecent(null)).toEqual([]);
    expect(sanitizeRecent("not an array")).toEqual([]);
    expect(sanitizeRecent({ a: 1 })).toEqual([]);
  });
});

describe("pushRecent", () => {
  it("appends newest at the END", () => {
    expect(pushRecent([true], false)).toEqual([true, false]);
  });
  it("caps at RECENT_WINDOW, dropping the oldest", () => {
    const full = Array.from({ length: RECENT_WINDOW }, () => false);
    const out = pushRecent(full, true);
    expect(out).toHaveLength(RECENT_WINDOW);
    expect(out[RECENT_WINDOW - 1]).toBe(true);
  });
  it("tolerates garbage stored json", () => {
    expect(pushRecent(null, true)).toEqual([true]);
  });
});

describe("masteryPct", () => {
  it("returns null below MASTERY_MIN_ANSWERED answers", () => {
    expect(
      masteryPct({ lessonsRead: 3, lessonsTotal: 10, recent: [true, true], answered: MASTERY_MIN_ANSWERED - 1 })
    ).toBeNull();
  });
  it("computes 30% read + 70% recent accuracy, rounded", () => {
    // read 5/10 = 0.5 → 15 điểm; recent 8/10 đúng = 0.8 → 56 điểm; tổng 71
    const recent = [true, true, true, true, true, true, true, true, false, false];
    expect(masteryPct({ lessonsRead: 5, lessonsTotal: 10, recent, answered: 10 })).toBe(71);
  });
  it("clamps lessonsRead above total and handles lessonsTotal=0", () => {
    const recent = [true, true, true, true, true];
    expect(masteryPct({ lessonsRead: 7, lessonsTotal: 5, recent, answered: 5 })).toBe(100);
    expect(masteryPct({ lessonsRead: 0, lessonsTotal: 0, recent, answered: 5 })).toBe(70);
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `npx vitest run src/lib/grammar/mastery.test.ts`
Expected: FAIL — module chưa tồn tại.

- [ ] **Step 3: Viết `src/lib/grammar/mastery.ts`**

```ts
// Topic mastery (grammar design §7): 30% theory read + 70% recent test
// accuracy over a ring buffer of the last RECENT_WINDOW answers. Pure module —
// the answer API and the hub data lib both call it; tests never touch prisma.

export const RECENT_WINDOW = 20;
export const MASTERY_MIN_ANSWERED = 5;

// GrammarTopicProgress.recent is a Json column — treat whatever comes back as
// untrusted and coerce to boolean[].
export function sanitizeRecent(recent: unknown): boolean[] {
  if (!Array.isArray(recent)) return [];
  return recent.map(Boolean);
}

export function pushRecent(recent: unknown, correct: boolean): boolean[] {
  return [...sanitizeRecent(recent), correct].slice(-RECENT_WINDOW);
}

// null = "not enough signal yet" — the UI shows "Mới bắt đầu" instead of a
// number, so one lucky answer can never read as 70% mastery.
export function masteryPct(i: {
  lessonsRead: number;
  lessonsTotal: number;
  recent: unknown;
  answered: number;
}): number | null {
  if (i.answered < MASTERY_MIN_ANSWERED) return null;
  const readRatio = i.lessonsTotal > 0 ? Math.min(1, i.lessonsRead / i.lessonsTotal) : 0;
  const recent = sanitizeRecent(i.recent);
  const acc = recent.length > 0 ? recent.filter(Boolean).length / recent.length : 0;
  return Math.round((0.3 * readRatio + 0.7 * acc) * 100);
}
```

- [ ] **Step 4: Chạy test, xác nhận pass**

Run: `npx vitest run src/lib/grammar/mastery.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/grammar/mastery.ts src/lib/grammar/mastery.test.ts
git commit -m "feat(grammar): công thức mastery + ring buffer thuần"
```

---

### Task 3: Streak nới nguồn + awarder XP grammar

**Files:**
- Modify: `src/lib/gamification-checks.ts` (`computeStreakFromDb` where clause, ~dòng 27-32)
- Modify: `src/lib/gamification.ts` (thêm `awardGrammarXp`)

**Interfaces:**
- Consumes: `DailyStat.grammarCount` (schema Plan 1), `totalXp`/`levelFromXp` (gamification-defs)
- Produces: `awardGrammarXp(userId: string, amount: number, db?: PrismaClient | Prisma.TransactionClient): Promise<{ leveledUp: number | null }>` — Task 7/8 gọi; tham số `db` cho phép chạy trong transaction của answer API.

- [ ] **Step 1: Nới `computeStreakFromDb`**

Trong `src/lib/gamification-checks.ts`, thay block where của `findMany`:

```ts
  const stats = await prisma.dailyStat.findMany({
    // A day counts toward the streak if it has EITHER vocab SRS reviews
    // (totalCount) OR grammar answers (grammarCount) — the user chose full
    // gamification integration for grammar (design §7). totalCount itself
    // stays SRS-only so vocab accuracy/heatmap stats remain pure.
    where: {
      userId,
      dateStr: { gte: since },
      OR: [{ totalCount: { gt: 0 } }, { grammarCount: { gt: 0 } }],
    },
    orderBy: { dateStr: "desc" },
    take: 400,
    select: { dateStr: true },
  });
```

(Chỉ đổi `where`; giữ nguyên phần còn lại của hàm.)

- [ ] **Step 2: Thêm `awardGrammarXp` vào `src/lib/gamification.ts`**

Đặt ngay TRƯỚC `awardForSessionEnd`. File đã import `prisma`, `totalXp`, `levelFromXp`, `todayStr`; thêm type import nếu thiếu: `import type { Prisma, PrismaClient } from "@prisma/client";`

```ts
// ── awardGrammarXp: the grammar module's ONLY XP path ─────────────────
// Bumps BOTH bonus ledgers (DailyStat.bonusXp + UserProgress.bonusXp) — never
// `xp`, which stays strictly ReviewLog-derived for the backfill. Callers pass
// their interactive-transaction client via `db` when the XP must be atomic
// with progress writes (the answer API); standalone callers (lesson-read,
// session-end) use the default singleton, where the two upserts run inside
// one $transaction like awardForSessionEnd's non-SRS path.
export async function awardGrammarXp(
  userId: string,
  amount: number,
  db: PrismaClient | Prisma.TransactionClient = prisma
): Promise<{ leveledUp: number | null }> {
  if (amount <= 0) return { leveledUp: null };
  const dateStr = todayStr();
  const before = await db.userProgress.findUnique({ where: { userId } });
  const beforeXp = totalXp(before ?? {});
  const dailyOp = {
    where: { userId_dateStr: { userId, dateStr } },
    update: { bonusXp: { increment: amount } },
    create: { userId, dateStr, bonusXp: amount },
  } as const;
  const progressOp = {
    where: { userId },
    update: { bonusXp: { increment: amount } },
    create: { userId, bonusXp: amount },
  } as const;
  let after;
  if (db === prisma) {
    [, after] = await prisma.$transaction([
      prisma.dailyStat.upsert(dailyOp),
      prisma.userProgress.upsert(progressOp),
    ]);
  } else {
    // Already inside the caller's interactive transaction — just run in order.
    await db.dailyStat.upsert(dailyOp);
    after = await db.userProgress.upsert(progressOp);
  }
  const afterXp = totalXp(after);
  const leveledUp = levelFromXp(afterXp) > levelFromXp(beforeXp) ? levelFromXp(afterXp) : null;
  return { leveledUp };
}
```

- [ ] **Step 3: Kiểm ảnh hưởng chéo của streak widening**

Run: `grep -rn "computeStreakFromDb\|computeStreak" src --include="*.ts" --include="*.tsx" | grep -v ".test."`
Expected: các call site (stats, gamification, reminders) đều NHẬN diện đúng ngữ nghĩa mới "ngày hoạt động = vocab HOẶC grammar" — đây là chủ đích của design §7 (nhắc học/badge streak cũng theo). Ghi nhận danh sách call site vào report; không sửa gì thêm.

- [ ] **Step 4: Build sanity**

Run: `npx tsc --noEmit && npm test`
Expected: sạch; toàn bộ suite pass (không test mới — cả hai hàm chạm prisma; logic mirror đường award đã review).

- [ ] **Step 5: Commit**

```bash
git add src/lib/gamification-checks.ts src/lib/gamification.ts
git commit -m "feat(grammar): streak tính cả ngày học ngữ pháp; awardGrammarXp vào sổ bonusXp"
```

---

### Task 4: Lib dữ liệu server (`src/lib/grammar/data.ts`)

**Files:**
- Create: `src/lib/grammar/data.ts`

**Interfaces:**
- Consumes: prisma (`@/lib/db`), `masteryPct`/`sanitizeRecent` (Task 2), `GRAMMAR_TOPICS` không cần (topics đọc từ DB)
- Produces (Task 6/7/9 dùng):

```ts
export type TopicCard = {
  id: number; slug: string; nameEn: string; nameVi: string | null;
  cluster: string; order: number;
  lessonsTotal: number; lessonsRead: number;
  testQuestionCount: number; answered: number;
  mastery: number | null; // null = chưa đủ 5 câu
};
export type GrammarHub = {
  clusters: { key: string; topics: TopicCard[] }[];
  continueTarget: { topicSlug: string; topicNameEn: string; topicNameVi: string | null; lessonOrder: number; lessonTitleEn: string; lessonTitleVi: string | null } | null;
  totals: { lessonsRead: number; lessonsTotal: number; answered: number };
};
export async function getGrammarHub(userId: string | null): Promise<GrammarHub>;
export type TopicPageData = {
  topic: TopicCard;
  lessons: { id: number; order: number; titleEn: string; titleVi: string | null; read: boolean }[];
} | null;
export async function getTopicPage(slug: string, userId: string | null): Promise<TopicPageData>;
export type LessonPageData = {
  topic: { slug: string; nameEn: string; nameVi: string | null; testQuestionCount: number };
  lesson: { id: number; order: number; titleEn: string; titleVi: string | null; contentEnHtml: string; contentViHtml: string | null };
  read: boolean; prevOrder: number | null; nextOrder: number | null;
} | null;
export async function getLessonPage(slug: string, order: number, userId: string | null): Promise<LessonPageData>;
```

- [ ] **Step 1: Viết `src/lib/grammar/data.ts`**

```ts
// Server-side reads for the grammar pages. Pages call these directly (server
// components query prisma, no API hop — same pattern as topics-data.ts).
import { prisma } from "@/lib/db";
import { masteryPct } from "./mastery";

const CLUSTER_ORDER = ["tenses", "word-classes", "sentence", "other"] as const;

export type TopicCard = {
  id: number;
  slug: string;
  nameEn: string;
  nameVi: string | null;
  cluster: string;
  order: number;
  lessonsTotal: number;
  lessonsRead: number;
  testQuestionCount: number;
  answered: number;
  mastery: number | null;
};

export type GrammarHub = {
  clusters: { key: string; topics: TopicCard[] }[];
  continueTarget: {
    topicSlug: string;
    topicNameEn: string;
    topicNameVi: string | null;
    lessonOrder: number;
    lessonTitleEn: string;
    lessonTitleVi: string | null;
  } | null;
  totals: { lessonsRead: number; lessonsTotal: number; answered: number };
};

// One round trip per aggregate, all cheap: 33 topics, 292 lesson stubs, two
// groupBys, and (when signed in) the user's read-marks + progress rows.
async function loadTopicCards(userId: string | null): Promise<{
  cards: TopicCard[];
  lessonStubs: { id: number; topicId: number; order: number }[];
  readIds: Set<number>;
}> {
  const [topics, lessonStubs, lessonCounts, questionCounts] = await Promise.all([
    prisma.grammarTopic.findMany({ orderBy: [{ cluster: "asc" }, { order: "asc" }] }),
    prisma.grammarLesson.findMany({ select: { id: true, topicId: true, order: true } }),
    prisma.grammarLesson.groupBy({ by: ["topicId"], _count: { _all: true } }),
    prisma.grammarTestQuestion.groupBy({ by: ["topicId"], _count: { _all: true } }),
  ]);
  const [reads, progress] = userId
    ? await Promise.all([
        prisma.grammarLessonRead.findMany({ where: { userId }, select: { lessonId: true } }),
        prisma.grammarTopicProgress.findMany({ where: { userId } }),
      ])
    : [[], []];

  const lessonsByTopic = new Map(lessonCounts.map((r) => [r.topicId, r._count._all]));
  const questionsByTopic = new Map(questionCounts.map((r) => [r.topicId, r._count._all]));
  const readIds = new Set(reads.map((r) => r.lessonId));
  const topicOfLesson = new Map(lessonStubs.map((l) => [l.id, l.topicId]));
  const readByTopic = new Map<number, number>();
  for (const id of readIds) {
    const t = topicOfLesson.get(id);
    if (t != null) readByTopic.set(t, (readByTopic.get(t) ?? 0) + 1);
  }
  const progressByTopic = new Map(progress.map((p) => [p.topicId, p]));

  const cards: TopicCard[] = topics.map((t) => {
    const lessonsTotal = lessonsByTopic.get(t.id) ?? 0;
    const lessonsRead = readByTopic.get(t.id) ?? 0;
    const p = progressByTopic.get(t.id);
    return {
      id: t.id,
      slug: t.slug,
      nameEn: t.nameEn,
      nameVi: t.nameVi,
      cluster: t.cluster,
      order: t.order,
      lessonsTotal,
      lessonsRead,
      testQuestionCount: questionsByTopic.get(t.id) ?? 0,
      answered: p?.answered ?? 0,
      mastery: masteryPct({
        lessonsRead,
        lessonsTotal,
        recent: p?.recent ?? [],
        answered: p?.answered ?? 0,
      }),
    };
  });
  return { cards, lessonStubs, readIds };
}

export async function getGrammarHub(userId: string | null): Promise<GrammarHub> {
  const { cards, lessonStubs, readIds } = await loadTopicCards(userId);

  const clusters = CLUSTER_ORDER.map((key) => ({
    key,
    topics: cards.filter((c) => c.cluster === key),
  })).filter((c) => c.topics.length > 0);

  // "Continue": the first unread lesson of the most-recently-read topic; when
  // the user has read nothing yet, the very first lesson of the first topic.
  let continueTarget: GrammarHub["continueTarget"] = null;
  const lastRead = userId
    ? await prisma.grammarLessonRead.findFirst({
        where: { userId },
        orderBy: { readAt: "desc" },
        select: { lessonId: true },
      })
    : null;
  const cardById = new Map(cards.map((c) => [c.id, c]));
  const pickLesson = async (topicId: number): Promise<{ topicId: number; order: number } | null> => {
    const next = lessonStubs
      .filter((l) => l.topicId === topicId && !readIds.has(l.id))
      .sort((a, b) => a.order - b.order)[0];
    return next ? { topicId, order: next.order } : null;
  };
  let target: { topicId: number; order: number } | null = null;
  if (lastRead) {
    const lastTopic = lessonStubs.find((l) => l.id === lastRead.lessonId)?.topicId;
    if (lastTopic != null) target = await pickLesson(lastTopic);
  }
  if (!target) {
    // First topic (cluster order) that still has an unread lesson.
    for (const c of cards) {
      target = await pickLesson(c.id);
      if (target) break;
    }
  }
  if (target) {
    const lesson = await prisma.grammarLesson.findUnique({
      where: { topicId_order: { topicId: target.topicId, order: target.order } },
      select: { order: true, titleEn: true, titleVi: true },
    });
    const card = cardById.get(target.topicId);
    if (lesson && card) {
      continueTarget = {
        topicSlug: card.slug,
        topicNameEn: card.nameEn,
        topicNameVi: card.nameVi,
        lessonOrder: lesson.order,
        lessonTitleEn: lesson.titleEn,
        lessonTitleVi: lesson.titleVi,
      };
    }
  }

  return {
    clusters,
    continueTarget,
    totals: {
      lessonsRead: cards.reduce((s, c) => s + c.lessonsRead, 0),
      lessonsTotal: cards.reduce((s, c) => s + c.lessonsTotal, 0),
      answered: cards.reduce((s, c) => s + c.answered, 0),
    },
  };
}

export type TopicPageData = {
  topic: TopicCard;
  lessons: { id: number; order: number; titleEn: string; titleVi: string | null; read: boolean }[];
} | null;

export async function getTopicPage(slug: string, userId: string | null): Promise<TopicPageData> {
  const topic = await prisma.grammarTopic.findUnique({ where: { slug } });
  if (!topic) return null;
  const [lessons, questionCount, reads, progress] = await Promise.all([
    prisma.grammarLesson.findMany({
      where: { topicId: topic.id },
      orderBy: { order: "asc" },
      select: { id: true, order: true, titleEn: true, titleVi: true },
    }),
    prisma.grammarTestQuestion.count({ where: { topicId: topic.id } }),
    userId
      ? prisma.grammarLessonRead.findMany({
          where: { userId, lessonId: { in: (await prisma.grammarLesson.findMany({ where: { topicId: topic.id }, select: { id: true } })).map((l) => l.id) } },
          select: { lessonId: true },
        })
      : Promise.resolve([]),
    userId
      ? prisma.grammarTopicProgress.findUnique({
          where: { userId_topicId: { userId, topicId: topic.id } },
        })
      : Promise.resolve(null),
  ]);
  const readIds = new Set(reads.map((r) => r.lessonId));
  const lessonsRead = lessons.filter((l) => readIds.has(l.id)).length;
  return {
    topic: {
      id: topic.id,
      slug: topic.slug,
      nameEn: topic.nameEn,
      nameVi: topic.nameVi,
      cluster: topic.cluster,
      order: topic.order,
      lessonsTotal: lessons.length,
      lessonsRead,
      testQuestionCount: questionCount,
      answered: progress?.answered ?? 0,
      mastery: masteryPct({
        lessonsRead,
        lessonsTotal: lessons.length,
        recent: progress?.recent ?? [],
        answered: progress?.answered ?? 0,
      }),
    },
    lessons: lessons.map((l) => ({ ...l, read: readIds.has(l.id) })),
  };
}

export type LessonPageData = {
  topic: { slug: string; nameEn: string; nameVi: string | null; testQuestionCount: number };
  lesson: {
    id: number;
    order: number;
    titleEn: string;
    titleVi: string | null;
    contentEnHtml: string;
    contentViHtml: string | null;
  };
  read: boolean;
  prevOrder: number | null;
  nextOrder: number | null;
} | null;

export async function getLessonPage(
  slug: string,
  order: number,
  userId: string | null
): Promise<LessonPageData> {
  const topic = await prisma.grammarTopic.findUnique({ where: { slug } });
  if (!topic) return null;
  const lesson = await prisma.grammarLesson.findUnique({
    where: { topicId_order: { topicId: topic.id, order } },
  });
  if (!lesson) return null;
  const [orders, questionCount, readRow] = await Promise.all([
    prisma.grammarLesson.findMany({
      where: { topicId: topic.id },
      select: { order: true },
      orderBy: { order: "asc" },
    }),
    prisma.grammarTestQuestion.count({ where: { topicId: topic.id } }),
    userId
      ? prisma.grammarLessonRead.findUnique({
          where: { userId_lessonId: { userId, lessonId: lesson.id } },
        })
      : Promise.resolve(null),
  ]);
  const list = orders.map((o) => o.order);
  const idx = list.indexOf(order);
  return {
    topic: { slug: topic.slug, nameEn: topic.nameEn, nameVi: topic.nameVi, testQuestionCount: questionCount },
    lesson: {
      id: lesson.id,
      order: lesson.order,
      titleEn: lesson.titleEn,
      titleVi: lesson.titleVi,
      contentEnHtml: lesson.contentEnHtml,
      contentViHtml: lesson.contentViHtml,
    },
    read: !!readRow,
    prevOrder: idx > 0 ? list[idx - 1] : null,
    nextOrder: idx >= 0 && idx < list.length - 1 ? list[idx + 1] : null,
  };
}
```

- [ ] **Step 2: Build sanity**

Run: `npx tsc --noEmit`
Expected: sạch. (Lib server chạm prisma — không unit test theo hợp đồng repo; được vận hành qua các trang ở Task 6/7 và smoke ở đó.)

- [ ] **Step 3: Commit**

```bash
git add src/lib/grammar/data.ts
git commit -m "feat(grammar): lib dữ liệu server cho hub / trang chủ đề / trình đọc"
```

---

### Task 5: i18n keys + nav + card trang chủ

**Files:**
- Modify: `src/lib/i18n/dictionaries.ts` (nav.grammar + section `grammar` + auth.reasons.grammar, CẢ vi lẫn en)
- Modify: `src/components/nav.tsx` (thêm mục Ngữ pháp)
- Modify: `src/app/home-view.tsx` (thêm ModeCard vào MODE GRID)

**Interfaces:**
- Consumes: `useI18n().t` dot-path
- Produces: toàn bộ key `grammar.*`, `nav.grammar`, `auth.reasons.grammar` mà Task 6/7/9 dùng — danh sách CHÍNH XÁC ở Step 1; component nào dùng key ngoài danh sách này là bug.

- [ ] **Step 1: Thêm keys vào `dictionaries.ts`**

Trong `vi.nav` thêm `grammar: "Ngữ pháp",`; trong `en.nav` thêm `grammar: "Grammar",`.
Trong `vi.auth.reasons` thêm `grammar: "Đăng nhập để làm bài test và lưu tiến độ ngữ pháp.",`; trong `en.auth.reasons` thêm `grammar: "Sign in to take tests and save your grammar progress.",`.

Thêm section `grammar` (đặt cạnh section `topics`) — bản `vi`:

```ts
    grammar: {
      header: "NGỮ PHÁP · 33 CHỦ ĐỀ",
      title: "Học ngữ pháp",
      titleAccent: "có hệ thống.",
      subtitle: "{lessons} bài lý thuyết song ngữ và {questions} câu hỏi luyện tập, sắp xếp theo {topics} chủ đề.",
      continueTitle: "Tiếp tục học",
      continueCta: "Đọc tiếp",
      startTitle: "Bắt đầu học",
      startCta: "Bài đầu tiên",
      lessonsRead: "{read}/{total} bài",
      questionsN: "{n} câu hỏi",
      masteryNew: "Mới bắt đầu",
      clusters: {
        tenses: "Các thì",
        "word-classes": "Từ loại",
        sentence: "Cấu trúc câu",
        other: "Khác",
      },
      legend: {
        title: "Chú giải màu",
        subject: "Chủ ngữ",
        verb: "Động từ",
        auxiliary: "Trợ động từ",
        infinitive: "Nguyên thể",
        object: "Tân ngữ",
        adjective: "Tính từ",
        adverb: "Trạng từ",
        negation: "Phủ định",
      },
      lesson: {
        viUpdating: "Bản dịch tiếng Việt đang cập nhật — hiển thị bản tiếng Anh.",
        markRead: "Đã hiểu",
        markedRead: "Đã đọc",
        prev: "Bài trước",
        next: "Bài sau",
        takeTest: "Làm test chủ đề này",
        ofTopic: "Bài {order} · {topic}",
      },
      test: {
        title: "Kiểm tra: {topic}",
        empty: "Chủ đề này chưa có câu hỏi kiểm tra.",
        repeatPill: "Ôn lại — không XP",
        pickAnswer: "Chọn đáp án đúng",
        answerWas: "Đáp án đúng:",
        summaryTitle: "Hoàn thành!",
        accuracy: "Chính xác",
        retryWrong: "Làm lại {n} câu sai",
        backToTopic: "Về chủ đề",
        anotherRound: "Vòng mới",
        wrongList: "Câu trả lời sai",
        unsavedN: "{n} câu chưa lưu được — kiểm tra mạng.",
      },
      home: {
        title: "Ngữ pháp",
        desc: "33 chủ đề, lý thuyết + test",
      },
    },
```

Bản `en` (cùng cấu trúc):

```ts
    grammar: {
      header: "GRAMMAR · 33 TOPICS",
      title: "Grammar,",
      titleAccent: "structured.",
      subtitle: "{lessons} bilingual theory lessons and {questions} practice questions across {topics} topics.",
      continueTitle: "Continue learning",
      continueCta: "Keep reading",
      startTitle: "Start learning",
      startCta: "First lesson",
      lessonsRead: "{read}/{total} lessons",
      questionsN: "{n} questions",
      masteryNew: "Just started",
      clusters: {
        tenses: "Tenses",
        "word-classes": "Word classes",
        sentence: "Sentence structure",
        other: "Other",
      },
      legend: {
        title: "Color legend",
        subject: "Subject",
        verb: "Verb",
        auxiliary: "Auxiliary",
        infinitive: "Infinitive",
        object: "Object",
        adjective: "Adjective",
        adverb: "Adverb",
        negation: "Negation",
      },
      lesson: {
        viUpdating: "Vietnamese translation coming soon — showing English.",
        markRead: "Got it",
        markedRead: "Read",
        prev: "Previous",
        next: "Next",
        takeTest: "Take the topic test",
        ofTopic: "Lesson {order} · {topic}",
      },
      test: {
        title: "Test: {topic}",
        empty: "This topic has no test questions yet.",
        repeatPill: "Review — no XP",
        pickAnswer: "Pick the correct answer",
        answerWas: "Correct answer:",
        summaryTitle: "Done!",
        accuracy: "Accuracy",
        retryWrong: "Retry {n} wrong",
        backToTopic: "Back to topic",
        anotherRound: "New round",
        wrongList: "Wrong answers",
        unsavedN: "{n} answers not saved — check your connection.",
      },
      home: {
        title: "Grammar",
        desc: "33 topics, theory + tests",
      },
    },
```

Lưu ý: kiểm tra cú pháp interpolation hiện hành của `t()` (đã thấy `t("home.of", { n: ... })` dùng `{n}`) — dùng đúng dạng đó.

- [ ] **Step 2: Nav**

Trong `src/components/nav.tsx`: thêm `GraduationCap` vào import lucide; chèn vào mảng `links` ngay SAU mục `/topics`:

```ts
    { href: "/grammar", label: t("nav.grammar"), icon: GraduationCap, mobile: true, locked: false },
```

Mobile tab bar thành 6 mục. Chạy dev, kiểm bằng mắt ở viewport 375px (labels 10px, icon 20px — 6 mục vẫn vừa); nếu chật thấy rõ, hạ `/notebook` xuống `mobile: false` và ghi vào report.

- [ ] **Step 3: Card trang chủ**

Trong `src/app/home-view.tsx`, MODE GRID (sau ModeCard pronunciation):

```tsx
          <ModeCard href="/grammar" title={t("grammar.home.title")} desc={t("grammar.home.desc")} emoji="📖" />
```

- [ ] **Step 4: Build + smoke**

Run: `npx tsc --noEmit && npm test`
Expected: sạch. Chạy `npm run dev` mở `/` — thấy tab "Ngữ pháp" (desktop + mobile) và card mới; `/grammar` 404 là ĐÚNG ở task này.

- [ ] **Step 5: Commit**

```bash
git add src/lib/i18n/dictionaries.ts src/components/nav.tsx src/app/home-view.tsx
git commit -m "feat(grammar): nav + i18n keys + card trang chủ"
```

---

### Task 6: Hub `/grammar` + trang chủ đề `/grammar/[topic]`

**Files:**
- Create: `src/app/grammar/page.tsx`
- Create: `src/app/grammar/hub-view.tsx`
- Create: `src/app/grammar/loading.tsx`
- Create: `src/app/grammar/[topic]/page.tsx`
- Create: `src/app/grammar/[topic]/topic-view.tsx`

**Interfaces:**
- Consumes: `getGrammarHub`/`getTopicPage` (Task 4), `getCurrentUser` (`@/lib/session`), i18n keys (Task 5), `TopicCard` type
- Produces: routes `/grammar`, `/grammar/[topic]`; component client `MasteryBadge` (export từ `hub-view.tsx`, topic-view dùng lại)

- [ ] **Step 1: `src/app/grammar/page.tsx`**

```tsx
import { getGrammarHub } from "@/lib/grammar/data";
import { getCurrentUser } from "@/lib/session";
import { HubView } from "./hub-view";

export const dynamic = "force-dynamic";

export default async function GrammarHubPage() {
  // The hub is open to guests (browse freely); per-user progress only renders
  // when signed in. Same posture as /topics.
  const user = await getCurrentUser();
  const hub = await getGrammarHub(user?.id ?? null);
  return <HubView hub={hub} authed={!!user} />;
}
```

- [ ] **Step 2: `src/app/grammar/hub-view.tsx`**

```tsx
"use client";

import Link from "next/link";
import { ArrowRight, BookOpen } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import type { GrammarHub, TopicCard } from "@/lib/grammar/data";

// Small shared badge: a number when mastery is measurable, the "just started"
// pill otherwise (design §7 — no % below 5 answers).
export function MasteryBadge({ mastery, answered }: { mastery: number | null; answered: number }) {
  const { t } = useI18n();
  if (mastery == null) {
    return answered > 0 ? (
      <span className="pill text-soft">{t("grammar.masteryNew")}</span>
    ) : null;
  }
  const tone = mastery >= 90 ? "text-moss-500" : mastery >= 50 ? "text-ember" : "text-soft";
  return <span className={`display text-2xl tabular-nums ${tone}`}>{mastery}%</span>;
}

function localName(nameEn: string, nameVi: string | null, lang: string): string {
  return lang === "vi" && nameVi ? nameVi : nameEn;
}

export function HubView({ hub, authed }: { hub: GrammarHub; authed: boolean }) {
  const { t, lang } = useI18n();
  const c = hub.continueTarget;

  return (
    <main className="shell py-10 sm:py-14 pb-28 md:pb-14">
      <header className="mb-8 max-w-2xl">
        <p className="text-sm text-soft font-mono mb-3">{t("grammar.header")}</p>
        <h1 className="display text-display-lg mb-3">
          {t("grammar.title")} <span className="display-it text-ember">{t("grammar.titleAccent")}</span>
        </h1>
        <p className="text-soft text-lg leading-relaxed">
          {t("grammar.subtitle", {
            lessons: hub.totals.lessonsTotal.toLocaleString(),
            questions: (9380).toLocaleString(),
            topics: hub.clusters.reduce((s, cl) => s + cl.topics.length, 0),
          })}
        </p>
      </header>

      {c && (
        <Link
          href={`/grammar/${c.topicSlug}/lesson/${c.lessonOrder}`}
          className="group card-atelier p-5 sm:p-6 mb-10 flex items-center gap-4 hover:border-ember/30 transition-all"
        >
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-ember/10 text-ember">
            <BookOpen size={22} strokeWidth={1.7} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] uppercase tracking-wider text-soft font-semibold">
              {authed && hub.totals.lessonsRead > 0 ? t("grammar.continueTitle") : t("grammar.startTitle")}
            </span>
            <span className="block truncate display text-lg">
              {localName(c.lessonTitleEn, c.lessonTitleVi, lang)}
            </span>
            <span className="block text-xs text-soft truncate">
              {localName(c.topicNameEn, c.topicNameVi, lang)}
            </span>
          </span>
          <span className="inline-flex items-center gap-1.5 text-sm text-ember font-medium whitespace-nowrap">
            {authed && hub.totals.lessonsRead > 0 ? t("grammar.continueCta") : t("grammar.startCta")}
            <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
          </span>
        </Link>
      )}

      {hub.clusters.map((cl) => (
        <section key={cl.key} className="mb-10">
          <h2 className="display text-2xl mb-4">{t(`grammar.clusters.${cl.key}`)}</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {cl.topics.map((tp: TopicCard, i) => (
              <Link
                key={tp.slug}
                href={`/grammar/${tp.slug}`}
                className="group card-atelier p-5 hover:-translate-y-0.5 transition-all hover:border-ember/30 flex flex-col"
                style={{ animationDelay: `${i * 30}ms` }}
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <h3 className="display text-lg leading-snug">{localName(tp.nameEn, tp.nameVi, lang)}</h3>
                  <MasteryBadge mastery={tp.mastery} answered={tp.answered} />
                </div>
                <div className="mt-auto">
                  <div className="flex items-center justify-between text-[11px] text-soft mb-1.5">
                    <span>{t("grammar.lessonsRead", { read: tp.lessonsRead, total: tp.lessonsTotal })}</span>
                    {tp.testQuestionCount > 0 && (
                      <span>{t("grammar.questionsN", { n: tp.testQuestionCount })}</span>
                    )}
                  </div>
                  <div className="h-1.5 rounded-full bg-ink/8 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-ember/70 transition-all"
                      style={{ width: `${tp.lessonsTotal > 0 ? (tp.lessonsRead / tp.lessonsTotal) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}
```

- [ ] **Step 3: `src/app/grammar/loading.tsx`**

```tsx
export default function Loading() {
  return (
    <main className="shell py-10 sm:py-14 animate-pulse">
      <div className="h-4 w-40 rounded bg-ink/8 mb-4" />
      <div className="h-10 w-72 rounded bg-ink/8 mb-8" />
      <div className="h-24 rounded-2xl bg-ink/5 mb-10" />
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="h-32 rounded-2xl bg-ink/5" />
        ))}
      </div>
    </main>
  );
}
```

- [ ] **Step 4: `src/app/grammar/[topic]/page.tsx`**

```tsx
import { notFound } from "next/navigation";
import { getTopicPage } from "@/lib/grammar/data";
import { getCurrentUser } from "@/lib/session";
import { TopicView } from "./topic-view";

export const dynamic = "force-dynamic";

export default async function GrammarTopicPage({ params }: { params: { topic: string } }) {
  const user = await getCurrentUser();
  const data = await getTopicPage(params.topic, user?.id ?? null);
  if (!data) notFound();
  return <TopicView data={data} authed={!!user} />;
}
```

- [ ] **Step 5: `src/app/grammar/[topic]/topic-view.tsx`**

```tsx
"use client";

import Link from "next/link";
import { ArrowLeft, CheckCircle2, Circle, PencilRuler } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { useGuestGuard } from "@/components/auth-gate";
import { MasteryBadge } from "../hub-view";
import type { TopicPageData } from "@/lib/grammar/data";

export function TopicView({ data, authed }: { data: NonNullable<TopicPageData>; authed: boolean }) {
  const { t, lang } = useI18n();
  const guard = useGuestGuard(authed);
  const { topic, lessons } = data;
  const name = lang === "vi" && topic.nameVi ? topic.nameVi : topic.nameEn;

  return (
    <main className="shell py-10 sm:py-14 pb-28 md:pb-14 max-w-3xl">
      <Link href="/grammar" className="inline-flex items-center gap-1.5 text-sm text-soft hover:text-ink mb-6">
        <ArrowLeft size={15} /> {t("common.back")}
      </Link>

      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-soft font-mono mb-2">{t(`grammar.clusters.${topic.cluster}`)}</p>
          <h1 className="display text-display-md">{name}</h1>
          <p className="text-sm text-soft mt-2">
            {t("grammar.lessonsRead", { read: topic.lessonsRead, total: topic.lessonsTotal })}
            {topic.testQuestionCount > 0 && <> · {t("grammar.questionsN", { n: topic.testQuestionCount })}</>}
          </p>
        </div>
        <MasteryBadge mastery={topic.mastery} answered={topic.answered} />
      </header>

      {topic.testQuestionCount > 0 && (
        <Link
          href={`/grammar/${topic.slug}/test`}
          onClick={guard(`/grammar/${topic.slug}/test`, "grammar")}
          className="mb-8 inline-flex items-center gap-2 rounded-full bg-ink text-paper px-5 py-2.5 text-sm font-medium hover:opacity-90"
        >
          <PencilRuler size={15} /> {t("grammar.lesson.takeTest")}
        </Link>
      )}

      <ol className="card-atelier divide-y divide-ink/10 overflow-hidden">
        {lessons.map((l) => {
          const title = lang === "vi" && l.titleVi ? l.titleVi : l.titleEn;
          return (
            <li key={l.id}>
              <Link
                href={`/grammar/${topic.slug}/lesson/${l.order}`}
                className="flex items-center gap-3.5 px-5 py-3.5 hover:bg-paper-200/40 transition-colors"
              >
                {l.read ? (
                  <CheckCircle2 size={18} className="shrink-0 text-moss-500" />
                ) : (
                  <Circle size={18} className="shrink-0 text-ink/20" />
                )}
                <span className="text-xs font-mono text-soft w-6 shrink-0">{l.order}</span>
                <span className="text-sm leading-snug">{title}</span>
              </Link>
            </li>
          );
        })}
      </ol>
    </main>
  );
}
```

- [ ] **Step 6: Smoke bằng dev server**

Run `npm run dev` (AUTH_BYPASS=1 sẵn trong .env):
- `/grammar`: hero + card "Bắt đầu học" + 4 cụm (15/12/5/1 card), toggle EN/VI đổi tên chủ đề.
- `/grammar/past-perfect`: 8 bài, nút test hiện; `/grammar/participles`: nút test PHẢI ẨN (0 câu); `/grammar/khong-ton-tai`: 404.
Ghi kết quả (kèm screenshot mô tả text) vào report.

- [ ] **Step 7: Build + commit**

Run: `npx tsc --noEmit && npm test` → sạch.

```bash
git add src/app/grammar
git commit -m "feat(grammar): hub 4 cụm chủ đề + trang chủ đề với tick bài đã đọc"
```

---

### Task 7: Trình đọc lý thuyết + API lesson-read

**Files:**
- Create: `src/app/grammar/[topic]/lesson/[order]/page.tsx`
- Create: `src/app/grammar/[topic]/lesson/[order]/lesson-reader.tsx`
- Create: `src/app/api/grammar/lesson-read/route.ts`

**Interfaces:**
- Consumes: `getLessonPage` (Task 4), `.grammar-prose`/`.grammar-chip` + `SEMANTIC_LEGEND` (Task 1), `awardGrammarXp` + `GRAMMAR_XP_LESSON_READ` (Task 3/1), i18n (Task 5)
- Produces: route `/grammar/[topic]/lesson/[order]`; API `POST /api/grammar/lesson-read` body `{ lessonId: number }` → `{ ok: true, alreadyRead: boolean, xpGained: number, leveledUp: number | null }`.

- [ ] **Step 1: `page.tsx`**

```tsx
import { notFound } from "next/navigation";
import { getLessonPage } from "@/lib/grammar/data";
import { getCurrentUser } from "@/lib/session";
import { LessonReader } from "./lesson-reader";

export const dynamic = "force-dynamic";

export default async function GrammarLessonPage({
  params,
}: {
  params: { topic: string; order: string };
}) {
  const order = Number.parseInt(params.order, 10);
  if (!Number.isInteger(order) || order < 1) notFound();
  const user = await getCurrentUser();
  const data = await getLessonPage(params.topic, order, user?.id ?? null);
  if (!data) notFound();
  return <LessonReader data={data} authed={!!user} />;
}
```

- [ ] **Step 2: `lesson-reader.tsx`**

```tsx
"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, ArrowRight, CheckCircle2, PencilRuler, X } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { SEMANTIC_LEGEND } from "@/lib/grammar/semantic-classes";
import type { LessonPageData } from "@/lib/grammar/data";

// Legend chips only for roles actually present in the rendered HTML — a tense
// lesson shouldn't open with an "Adjective" chip it never uses.
function presentLegend(html: string) {
  return SEMANTIC_LEGEND.filter((l) => html.includes(`class="${l.cls}"`));
}

export function LessonReader({ data, authed }: { data: NonNullable<LessonPageData>; authed: boolean }) {
  const { t, lang } = useI18n();
  const router = useRouter();
  const { topic, lesson } = data;
  const [read, setRead] = useState(data.read);
  const [justEarned, setJustEarned] = useState(0);
  const [saving, setSaving] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);

  const wantVi = lang === "vi";
  const viMissing = wantVi && !lesson.contentViHtml;
  const html = wantVi && lesson.contentViHtml ? lesson.contentViHtml : lesson.contentEnHtml;
  const title = wantVi && lesson.titleVi ? lesson.titleVi : lesson.titleEn;
  const topicName = wantVi && topic.nameVi ? topic.nameVi : topic.nameEn;
  const legend = useMemo(() => presentLegend(html), [html]);

  // Event delegation for the zoomable timeline images — the HTML is server-
  // sanitized (Plan 1's whitelist is the only gate), we only read `src` here.
  const onProseClick = (e: React.MouseEvent) => {
    const img = (e.target as Element).closest("img");
    if (img instanceof HTMLImageElement && img.src) setLightbox(img.src);
  };

  const markRead = async () => {
    if (read || saving) return;
    if (!authed) {
      router.push(`/login?callbackUrl=${encodeURIComponent(`/grammar/${topic.slug}/lesson/${lesson.order}`)}`);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/grammar/lesson-read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonId: lesson.id }),
      });
      if (res.ok) {
        const d = await res.json();
        setRead(true);
        if (typeof d.xpGained === "number") setJustEarned(d.xpGained);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="shell py-8 sm:py-12 pb-28 md:pb-14 max-w-3xl">
      <Link href={`/grammar/${topic.slug}`} className="inline-flex items-center gap-1.5 text-sm text-soft hover:text-ink mb-5">
        <ArrowLeft size={15} /> {topicName}
      </Link>

      <header className="mb-5">
        <p className="text-xs font-mono text-soft mb-2">
          {t("grammar.lesson.ofTopic", { order: lesson.order, topic: topicName })}
        </p>
        <h1 className="display text-display-md">{title}</h1>
      </header>

      {viMissing && (
        <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-line px-3.5 py-1.5 text-xs text-soft">
          {t("grammar.lesson.viUpdating")}
        </p>
      )}

      {legend.length > 0 && (
        <div className="mb-6 flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] uppercase tracking-wider text-soft font-semibold mr-1">
            {t("grammar.legend.title")}
          </span>
          {legend.map((l) => (
            <span key={l.cls} className="grammar-chip" style={{ ["--chip" as string]: `var(--gr-${l.cls === "signal-word" ? "adverb" : l.cls})` }}>
              {t(l.labelKey)}
            </span>
          ))}
        </div>
      )}

      {/* Sanitized at import time (Plan 1) — the DB never holds unsafe HTML. */}
      <article className="grammar-prose" onClick={onProseClick} dangerouslySetInnerHTML={{ __html: html }} />

      <div className="mt-10 flex flex-wrap items-center gap-3">
        <button
          onClick={markRead}
          disabled={saving}
          className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium transition-colors ${
            read
              ? "border border-moss-500/40 bg-moss-500/10 text-moss-600 dark:text-moss-400 cursor-default"
              : "bg-ink text-paper hover:opacity-90"
          }`}
        >
          <CheckCircle2 size={15} />
          {read ? t("grammar.lesson.markedRead") : t("grammar.lesson.markRead")}
          {justEarned > 0 && <span className="text-ember font-semibold">+{justEarned} XP</span>}
        </button>
        {topic.testQuestionCount > 0 && (
          <Link
            href={`/grammar/${topic.slug}/test`}
            className="inline-flex items-center gap-2 rounded-full border border-line px-5 py-2.5 text-sm font-medium hover:bg-paper-200/50"
          >
            <PencilRuler size={15} /> {t("grammar.lesson.takeTest")}
          </Link>
        )}
      </div>

      <nav className="mt-8 flex items-center justify-between border-t border-line pt-5">
        {data.prevOrder != null ? (
          <Link href={`/grammar/${topic.slug}/lesson/${data.prevOrder}`} className="inline-flex items-center gap-1.5 text-sm text-soft hover:text-ink">
            <ArrowLeft size={15} /> {t("grammar.lesson.prev")}
          </Link>
        ) : (
          <span />
        )}
        {data.nextOrder != null ? (
          <Link href={`/grammar/${topic.slug}/lesson/${data.nextOrder}`} className="inline-flex items-center gap-1.5 text-sm text-soft hover:text-ink">
            {t("grammar.lesson.next")} <ArrowRight size={15} />
          </Link>
        ) : (
          <span />
        )}
      </nav>

      <AnimatePresence>
        {lightbox && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-ink/85 flex items-center justify-center p-4 cursor-zoom-out"
            onClick={() => setLightbox(null)}
          >
            <button aria-label="Close" className="absolute top-4 right-4 text-paper/80 hover:text-paper">
              <X size={26} />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={lightbox} alt="" className="max-h-[90vh] max-w-full rounded-xl bg-white p-2" />
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
```

- [ ] **Step 3: `src/app/api/grammar/lesson-read/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/session";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { isSameOrigin, forbiddenCrossOrigin } from "@/lib/csrf";
import { awardGrammarXp } from "@/lib/gamification";
import { GRAMMAR_XP_LESSON_READ } from "@/lib/gamification-defs";

export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) return forbiddenCrossOrigin();
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  // Reading a lesson takes minutes; 30/min already covers a fast skimmer while
  // capping a scripted loop farming the +5 first-read XP across 292 lessons.
  const limit = checkRateLimit(`${userId}:grammar:lesson-read`, 30, 60_000);
  if (!limit.allowed) return rateLimitResponse(limit.retryAfterSec);

  const body = await req.json().catch(() => ({}));
  const lessonId = Number((body as { lessonId?: unknown }).lessonId);
  if (!Number.isInteger(lessonId) || lessonId < 1) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  const lesson = await prisma.grammarLesson.findUnique({ where: { id: lessonId }, select: { id: true } });
  if (!lesson) return NextResponse.json({ error: "not found" }, { status: 404 });

  try {
    await prisma.grammarLessonRead.create({ data: { userId, lessonId } });
  } catch (e) {
    // Unique violation = already read: idempotent success, no second XP.
    if ((e as { code?: string }).code === "P2002") {
      return NextResponse.json({ ok: true, alreadyRead: true, xpGained: 0, leveledUp: null });
    }
    throw e;
  }
  const { leveledUp } = await awardGrammarXp(userId, GRAMMAR_XP_LESSON_READ);
  return NextResponse.json({ ok: true, alreadyRead: false, xpGained: GRAMMAR_XP_LESSON_READ, leveledUp });
}
```

- [ ] **Step 4: Smoke dev**

- Mở `/grammar/simple-past/lesson/1`: span màu hiện (subject xanh dương, verb rỉ sắt…), chú giải chỉ chip có mặt, toggle VI/EN đổi nội dung; bài thiếu VI (3 bài titleVi null — tìm 1 bài, ví dụ query nhanh `npx tsx -e` list `titleVi: null`) hiện pill "đang cập nhật" khi lang=vi.
- Bài có ảnh (`/grammar/simple-past/lesson/…` — bài nhúng simple_past1e.png): click ảnh mở lightbox, click nền đóng.
- Bấm "Đã hiểu": nút chuyển "Đã đọc" + "+5 XP"; reload giữ trạng thái; bấm qua API lần 2 (curl same-origin) trả `alreadyRead: true, xpGained: 0`.
- Kiểm DB: `DailyStat.bonusXp` hôm nay +5, `UserProgress.bonusXp` +5, cột `xp` KHÔNG đổi.
Ghi output vào report.

- [ ] **Step 5: Build + test + commit**

Run: `npx tsc --noEmit && npm test` → sạch.

```bash
git add src/app/grammar/\[topic\]/lesson src/app/api/grammar/lesson-read
git commit -m "feat(grammar): trình đọc lý thuyết (span màu, chú giải, lightbox) + đánh dấu đã hiểu +5 XP"
```

---

### Task 8: API `answer` + `session-end`

**Files:**
- Create: `src/lib/grammar/session-types.ts`
- Create: `src/app/api/grammar/answer/route.ts`
- Create: `src/app/api/grammar/session-end/route.ts`

**Interfaces:**
- Consumes: `pushRecent` (Task 2), `awardGrammarXp` (Task 3), `GRAMMAR_XP_FIRST_CORRECT`/`GRAMMAR_XP_SESSION_BONUS`/`GRAMMAR_SESSION_SIZE` (Task 1), `todayStr` (`@/lib/utils`)
- Produces:
  - `session-types.ts` (client-safe): `type GrammarSource = "topic_test"` · `GRAMMAR_SOURCES: readonly GrammarSource[]` · `type GrammarSessionItem = { id: number; questionEn: string; questionVi: string | null; choices: string[]; repeat: boolean }`
  - `POST /api/grammar/answer` body `{ source: "topic_test", questionId: number, chosenIndex: number }` → `{ ok, correct: boolean, answerIndex: number, xpGained: number, leveledUp: number | null }`
  - `POST /api/grammar/session-end` body `{ sessionKey: string, source: "topic_test", total: number, correct: number, durationSec: number }` → `{ ok, xpGained: number, leveledUp: number | null, replay: boolean }`

- [ ] **Step 1: `src/lib/grammar/session-types.ts`**

```ts
// Shared client/server types for grammar answer sessions. Plan 3 extends
// GrammarSource with "practice" and "confused" — the answer API whitelists
// against GRAMMAR_SOURCES so the union is the single source of truth.
export const GRAMMAR_SOURCES = ["topic_test"] as const;
export type GrammarSource = (typeof GRAMMAR_SOURCES)[number];

// One question as the session UI sees it. answerIndex deliberately ABSENT:
// grading happens server-side in /api/grammar/answer, so the payload can't be
// read out of devtools to cheat, and the server stays the XP authority.
export type GrammarSessionItem = {
  id: number;
  questionEn: string;
  questionVi: string | null;
  choices: string[];
  repeat: boolean; // already answered correctly before — replays earn 0 XP
};
```

- [ ] **Step 2: `src/app/api/grammar/answer/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/session";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { isSameOrigin, forbiddenCrossOrigin } from "@/lib/csrf";
import { todayStr } from "@/lib/utils";
import { awardGrammarXp } from "@/lib/gamification";
import { GRAMMAR_XP_FIRST_CORRECT } from "@/lib/gamification-defs";
import { pushRecent } from "@/lib/grammar/mastery";
import { GRAMMAR_SOURCES, type GrammarSource } from "@/lib/grammar/session-types";

export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) return forbiddenCrossOrigin();
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  // Same ceiling as vocab reviews: 3/sec sustained covers fast tapping,
  // bounds a scripted first-correct XP farm.
  const limit = checkRateLimit(`${userId}:grammar:answer`, 180, 60_000);
  if (!limit.allowed) return rateLimitResponse(limit.retryAfterSec);

  const body = await req.json().catch(() => ({}));
  const { source, questionId, chosenIndex } = body as {
    source?: unknown;
    questionId?: unknown;
    chosenIndex?: unknown;
  };
  if (
    typeof source !== "string" ||
    !GRAMMAR_SOURCES.includes(source as GrammarSource) ||
    !Number.isInteger(questionId) ||
    !Number.isInteger(chosenIndex) ||
    (chosenIndex as number) < 0
  ) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  // v1: the only source is topic_test → GrammarTestQuestion. Plan 3 switches
  // on `source` here to route to practice/confused tables.
  const q = await prisma.grammarTestQuestion.findUnique({
    where: { id: questionId as number },
    select: { topicId: true, answerIndex: true, choicesEn: true },
  });
  if (!q) return NextResponse.json({ error: "not found" }, { status: 404 });
  const choiceCount = Array.isArray(q.choicesEn) ? q.choicesEn.length : 0;
  if ((chosenIndex as number) >= choiceCount) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  const correct = chosenIndex === q.answerIndex;
  const now = new Date();
  const dateStr = todayStr();
  const key = { userId, source: source as string, questionId: questionId as number };

  // One interactive transaction: answer-state ledger + topic counters + the
  // day's grammarCount + (when first-ever-correct) the XP bump — atomic, so a
  // network retry can never double-award (firstCorrectAt flips NULL→set once).
  const { firstCorrect, leveledUp } = await prisma.$transaction(async (tx) => {
    let first = false;
    const existing = await tx.grammarAnswerState.findUnique({
      where: { userId_source_questionId: key },
    });
    if (!existing) {
      try {
        await tx.grammarAnswerState.create({
          data: {
            ...key,
            firstCorrectAt: correct ? now : null,
            wrongCount: correct ? 0 : 1,
            lastWrongAt: correct ? null : now,
          },
        });
        first = correct;
      } catch (e) {
        if ((e as { code?: string }).code !== "P2002") throw e;
        // Concurrent create raced us — fall through to the update semantics.
        if (correct) {
          const r = await tx.grammarAnswerState.updateMany({
            where: { ...key, firstCorrectAt: null },
            data: { firstCorrectAt: now },
          });
          first = r.count === 1;
        } else {
          await tx.grammarAnswerState.update({
            where: { userId_source_questionId: key },
            data: { wrongCount: { increment: 1 }, lastWrongAt: now, resolvedAt: null },
          });
        }
      }
    } else if (correct) {
      // Guarded transition: count===1 ⇔ this request is THE first correct.
      const r = await tx.grammarAnswerState.updateMany({
        where: { ...key, firstCorrectAt: null },
        data: { firstCorrectAt: now },
      });
      first = r.count === 1;
    } else {
      await tx.grammarAnswerState.update({
        where: { userId_source_questionId: key },
        data: { wrongCount: { increment: 1 }, lastWrongAt: now, resolvedAt: null },
      });
    }

    // Topic ring buffer + counters (read-modify-write is fine inside the tx —
    // a user answers one question at a time; a rare concurrent session only
    // costs one ring-buffer entry, never corruption).
    const progress = await tx.grammarTopicProgress.findUnique({
      where: { userId_topicId: { userId, topicId: q.topicId } },
    });
    const recent = pushRecent(progress?.recent ?? [], correct);
    await tx.grammarTopicProgress.upsert({
      where: { userId_topicId: { userId, topicId: q.topicId } },
      update: { answered: { increment: 1 }, correct: { increment: correct ? 1 : 0 }, recent },
      create: { userId, topicId: q.topicId, answered: 1, correct: correct ? 1 : 0, recent },
    });

    // Streak source: every grammar answer marks the day active (design §7).
    await tx.dailyStat.upsert({
      where: { userId_dateStr: { userId, dateStr } },
      update: { grammarCount: { increment: 1 } },
      create: { userId, dateStr, grammarCount: 1 },
    });

    const award = first ? await awardGrammarXp(userId, GRAMMAR_XP_FIRST_CORRECT, tx) : { leveledUp: null };
    return { firstCorrect: first, leveledUp: award.leveledUp };
  });

  return NextResponse.json({
    ok: true,
    correct,
    answerIndex: q.answerIndex,
    xpGained: firstCorrect ? GRAMMAR_XP_FIRST_CORRECT : 0,
    leveledUp,
  });
}
```

- [ ] **Step 3: `src/app/api/grammar/session-end/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/session";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { isSameOrigin, forbiddenCrossOrigin } from "@/lib/csrf";
import { awardGrammarXp } from "@/lib/gamification";
import { GRAMMAR_SESSION_SIZE, GRAMMAR_XP_SESSION_BONUS } from "@/lib/gamification-defs";
import { GRAMMAR_SOURCES } from "@/lib/grammar/session-types";

// The client mints one uuid per round; the StudySession PK makes the replay
// (summary-screen reload, network retry) a no-op — same idempotency-by-unique
// trick as ReviewLog.idempotencyKey on the vocab side.
const KEY_RE = /^[A-Za-z0-9-]{8,64}$/;

export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) return forbiddenCrossOrigin();
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const limit = checkRateLimit(`${userId}:grammar:session-end`, 30, 60_000);
  if (!limit.allowed) return rateLimitResponse(limit.retryAfterSec);

  const body = await req.json().catch(() => ({}));
  const { sessionKey, source, total, correct, durationSec } = body as Record<string, unknown>;
  if (
    typeof sessionKey !== "string" ||
    !KEY_RE.test(sessionKey) ||
    typeof source !== "string" ||
    !GRAMMAR_SOURCES.includes(source as never)
  ) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  const clamp = (v: unknown) => Math.max(0, Math.floor(Number(v) || 0));
  const totals = { total: clamp(total), correct: clamp(correct), durationSec: clamp(durationSec) };

  try {
    await prisma.studySession.create({
      data: {
        id: `grammar_${sessionKey}`,
        userId,
        mode: `grammar_${source}`,
        cardsReviewed: totals.total,
        correctCount: Math.min(totals.correct, totals.total),
        durationSec: totals.durationSec,
        endedAt: new Date(),
      },
    });
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") {
      return NextResponse.json({ ok: true, xpGained: 0, leveledUp: null, replay: true });
    }
    throw e;
  }

  const bonus = totals.total >= GRAMMAR_SESSION_SIZE ? GRAMMAR_XP_SESSION_BONUS : 0;
  const { leveledUp } = bonus > 0 ? await awardGrammarXp(userId, bonus) : { leveledUp: null };
  return NextResponse.json({ ok: true, xpGained: bonus, leveledUp, replay: false });
}
```

- [ ] **Step 4: Kiểm StudySession không lẫn vào thống kê vocab**

Run: `grep -rn "studySession" src/lib src/app --include="*.ts" --include="*.tsx" | grep -v "api/grammar" | grep -v ".test."`
Đọc từng call site: nơi nào aggregate theo `mode` cụ thể (SRS_MODES…) thì rows `grammar_*` tự bị loại; nơi nào đếm MỌI StudySession thì grammar rows sẽ lẫn — ghi rõ từng nơi vào report kèm phán đoán. Nếu có nơi lẫn gây sai hiển thị vocab, thêm filter `mode: { not: { startsWith: "grammar_" } }`… (Prisma không có startsWith trong not — dùng `NOT: { mode: { startsWith: "grammar_" } }`) và ghi lại.

- [ ] **Step 5: Smoke API bằng curl/tsx (AUTH_BYPASS dev)**

Với dev server chạy, lấy 1 questionId của topic `simple-past` (`npx tsx -e` query id + answerIndex đầu tiên):
- POST answer đúng lần 1 → `{ correct: true, xpGained: 2 }`; POST lại cùng câu → `xpGained: 0`.
- POST answer sai → `correct: false, xpGained: 0`, DB `wrongCount` 1, `resolvedAt` null.
- DB check: `GrammarTopicProgress.recent` có đúng boolean; `DailyStat.grammarCount` tăng từng lần; `bonusXp` chỉ tăng ở lần first-correct.
- session-end với sessionKey uuid, total 10 → `xpGained: 5`; POST LẠI cùng key → `{ replay: true, xpGained: 0 }`; total 7 → `xpGained: 0`.
Ghi toàn bộ output vào report.

- [ ] **Step 6: Build + test + commit**

Run: `npx tsc --noEmit && npm test` → sạch.

```bash
git add src/lib/grammar/session-types.ts src/app/api/grammar
git commit -m "feat(grammar): API answer (first-correct XP nguyên tử) + session-end idempotent"
```

---

### Task 9: Phiên test — `GrammarSession` + trang `/grammar/[topic]/test`

**Files:**
- Create: `src/components/grammar/grammar-session.tsx`
- Create: `src/app/grammar/[topic]/test/page.tsx`

**Interfaces:**
- Consumes: `GrammarSessionItem`/`GrammarSource` (Task 8), API answer/session-end (Task 8), `playSound` (`@/lib/sound`), `vibrate` (`@/lib/haptics`), i18n (Task 5), `GRAMMAR_SESSION_SIZE` (Task 1), `AuthRequired` (`@/components/auth-required`)
- Produces: route `/grammar/[topic]/test`; component `GrammarSession({ source, topicSlug, topicNameEn, topicNameVi, items })` — Plan 3 tái dùng cho practice/review với source khác.

- [ ] **Step 1: `src/components/grammar/grammar-session.tsx`**

```tsx
"use client";

// Grammar answer session. Borrows practice-shell's UX grammar (progress bar,
// reveal window, tap/key advance, sound+haptics) but is its own component:
// the practice shell is welded to FSRS cards/ratings and /api/study/review,
// while grammar questions are server-graded via /api/grammar/answer.
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { CheckCircle2, RotateCcw, XCircle } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { playSound } from "@/lib/sound";
import { vibrate } from "@/lib/haptics";
import { GRAMMAR_SESSION_SIZE } from "@/lib/gamification-defs";
import type { GrammarSessionItem, GrammarSource } from "@/lib/grammar/session-types";

const LETTERS = ["A", "B", "C", "D"];
const REVEAL_MS = 1400;

function newSessionKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

type Answered = { item: GrammarSessionItem; chosen: number; answerIndex: number; correct: boolean };

export function GrammarSession({
  source,
  topicSlug,
  topicNameEn,
  topicNameVi,
  items,
}: {
  source: GrammarSource;
  topicSlug: string;
  topicNameEn: string;
  topicNameVi: string | null;
  items: GrammarSessionItem[];
}) {
  const { t, lang } = useI18n();
  const [queue, setQueue] = useState(items);
  const [index, setIndex] = useState(0);
  const [chosen, setChosen] = useState<number | null>(null);
  const [serverAnswer, setServerAnswer] = useState<number | null>(null);
  const [reveal, setReveal] = useState<"hidden" | "correct" | "wrong">("hidden");
  const [results, setResults] = useState<Answered[]>([]);
  const [xp, setXp] = useState(0);
  const [unsaved, setUnsaved] = useState(0);
  const [done, setDone] = useState(false);
  const [posting, setPosting] = useState(false);

  const sessionKeyRef = useRef(newSessionKey());
  const startedAtRef = useRef(Date.now());
  const endedRef = useRef(false);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const current = queue[index];
  const topicName = lang === "vi" && topicNameVi ? topicNameVi : topicNameEn;

  const advance = useCallback(() => {
    if (advanceTimer.current) {
      clearTimeout(advanceTimer.current);
      advanceTimer.current = null;
    }
    setChosen(null);
    setServerAnswer(null);
    setReveal("hidden");
    setIndex((i) => i + 1);
  }, []);

  const pick = useCallback(
    async (i: number) => {
      if (!current || chosen !== null || posting) return;
      setPosting(true);
      setChosen(i);
      const send = () =>
        fetch("/api/grammar/answer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ source, questionId: current.id, chosenIndex: i }),
        });
      let d: { correct: boolean; answerIndex: number; xpGained: number } | null = null;
      try {
        let res = await send();
        if (!res.ok) res = await send(); // one retry — the ledger makes replays XP-safe
        if (res.ok) d = await res.json();
      } catch {
        try {
          const res = await send();
          if (res.ok) d = await res.json();
        } catch {}
      }
      setPosting(false);
      // Offline fallback: grade locally is impossible (answer lives server-side)
      // — count it unsaved and move on rather than trapping the session.
      if (!d) {
        setUnsaved((n) => n + 1);
        advance();
        return;
      }
      setServerAnswer(d.answerIndex);
      setReveal(d.correct ? "correct" : "wrong");
      setResults((r) => [...r, { item: current, chosen: i, answerIndex: d!.answerIndex, correct: d!.correct }]);
      if (d.xpGained > 0) setXp((x) => x + d.xpGained);
      if (d.correct) {
        playSound("correct");
        vibrate(10);
      } else {
        playSound("wrong");
        vibrate([20, 40, 20]);
      }
      advanceTimer.current = setTimeout(advance, REVEAL_MS);
    },
    [current, chosen, posting, source, advance]
  );

  // Tap/key advances immediately during the reveal (same affordance as the
  // practice shell, same aria-disabled carve-out for the option buttons).
  useEffect(() => {
    if (reveal === "hidden") return;
    const h = (e: Event) => {
      if (e instanceof KeyboardEvent && e.repeat) return;
      const el = e.target;
      const control =
        el instanceof Element ? el.closest("button,a,input,textarea,select,[role='button']") : null;
      if (control && control.getAttribute("aria-disabled") !== "true") return;
      advance();
    };
    window.addEventListener("pointerdown", h);
    window.addEventListener("keydown", h);
    return () => {
      window.removeEventListener("pointerdown", h);
      window.removeEventListener("keydown", h);
    };
  }, [reveal, advance]);

  // Keyboard 1-4 / A-D picks an option while unanswered.
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (reveal !== "hidden" || !current) return;
      const byDigit = Number.parseInt(e.key, 10) - 1;
      const byLetter = LETTERS.indexOf(e.key.toUpperCase());
      const i = Number.isInteger(byDigit) && byDigit >= 0 ? byDigit : byLetter;
      if (i >= 0 && i < current.choices.length) void pick(i);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [reveal, current, pick]);

  // Session end: report once, idempotent server-side by sessionKey.
  useEffect(() => {
    if (done || index < queue.length) return;
    if (endedRef.current) return;
    endedRef.current = true;
    setDone(true);
    playSound("complete");
    const correct = results.filter((r) => r.correct).length;
    fetch("/api/grammar/session-end", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionKey: sessionKeyRef.current,
        source,
        total: results.length,
        correct,
        durationSec: Math.round((Date.now() - startedAtRef.current) / 1000),
      }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d && typeof d.xpGained === "number" && d.xpGained > 0) setXp((x) => x + d.xpGained);
      })
      .catch(() => {});
  }, [index, queue.length, done, results, source]);

  const retryWrong = () => {
    const wrong = results.filter((r) => !r.correct).map((r) => ({ ...r.item }));
    if (wrong.length === 0) return;
    sessionKeyRef.current = newSessionKey();
    startedAtRef.current = Date.now();
    endedRef.current = false;
    setResults([]);
    setXp(0);
    setUnsaved(0);
    setQueue(wrong);
    setIndex(0);
    setDone(false);
    setChosen(null);
    setServerAnswer(null);
    setReveal("hidden");
  };

  if (done) {
    const correct = results.filter((r) => r.correct).length;
    const pct = results.length > 0 ? Math.round((correct / results.length) * 100) : 0;
    const wrong = results.filter((r) => !r.correct);
    const mm = String(Math.floor((Date.now() - startedAtRef.current) / 60000)).padStart(2, "0");
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-6 py-10">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md">
          <motion.div
            initial={{ scale: 0, rotate: -30 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: 0.1, type: "spring", stiffness: 200 }}
            className="mx-auto mb-5 grid h-20 w-20 place-items-center rounded-full bg-moss-500/15 text-moss-500"
          >
            <CheckCircle2 size={40} strokeWidth={1.5} />
          </motion.div>
          <h2 className="display text-display-md mb-1 text-center">{t("grammar.test.summaryTitle")}</h2>
          {xp > 0 && (
            <p className="text-center mb-1 text-sm font-semibold text-ember">{t("gamify.xpEarned", { n: xp })}</p>
          )}
          {unsaved > 0 && (
            <p className="text-center mb-1 text-sm text-red-500">{t("grammar.test.unsavedN", { n: unsaved })}</p>
          )}
          <div className="grid grid-cols-2 gap-3 my-5">
            <div className="card-atelier p-4 text-center">
              <p className="display text-2xl text-moss-500 tabular-nums">{pct}%</p>
              <p className="text-[10px] uppercase tracking-wide text-soft">{t("grammar.test.accuracy")}</p>
            </div>
            <div className="card-atelier p-4 text-center">
              <p className="display text-2xl tabular-nums">
                {correct}/{results.length}
              </p>
              <p className="text-[10px] uppercase tracking-wide text-soft">{topicName}</p>
            </div>
          </div>
          {wrong.length > 0 && (
            <div className="card-atelier p-5 mb-6 max-h-60 overflow-y-auto">
              <p className="text-[11px] uppercase tracking-wider text-soft font-semibold mb-3">
                {t("grammar.test.wrongList")}
              </p>
              <ul className="space-y-3">
                {wrong.map((w) => (
                  <li key={w.item.id} className="text-sm">
                    <p className="leading-snug">{w.item.questionEn}</p>
                    <p className="text-xs mt-0.5">
                      <span className="text-red-500 line-through">{w.item.choices[w.chosen]}</span>{" "}
                      <span className="text-moss-500 font-medium">→ {w.item.choices[w.answerIndex]}</span>
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            {wrong.length > 0 && (
              <button
                onClick={retryWrong}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-ink text-paper px-6 py-3 font-medium hover:opacity-90"
              >
                <RotateCcw size={16} /> {t("grammar.test.retryWrong", { n: wrong.length })}
              </button>
            )}
            <Link
              href={`/grammar/${topicSlug}`}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-line px-6 py-3 font-medium hover:bg-paper-200/50"
            >
              {t("grammar.test.backToTopic")}
            </Link>
          </div>
        </motion.div>
      </div>
    );
  }

  if (!current) return null;
  const question = lang === "vi" && current.questionVi ? current.questionVi : current.questionEn;

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col">
      <div className="sticky top-16 z-30 bg-paper/80 backdrop-blur-md border-b border-line">
        <div className="shell py-2.5 flex items-center gap-3">
          <span className="text-xs text-soft tabular-nums whitespace-nowrap">
            {index + 1} <span className="opacity-50">/ {queue.length}</span>
          </span>
          <div className="flex-1 h-1.5 rounded-full bg-ink/10 overflow-hidden">
            <motion.div
              className="h-full bg-ember rounded-full"
              animate={{ width: `${(index / Math.max(queue.length, 1)) * 100}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
          <span className="text-xs font-mono text-soft">
            {results.filter((r) => r.correct).length}/{results.length}
          </span>
        </div>
      </div>

      <div className="shell w-full flex-1 flex flex-col justify-center py-6 sm:py-10 pb-28 md:pb-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={`${current.id}-${index}`}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.2 }}
            className="max-w-2xl mx-auto w-full"
          >
            <div className="text-center mb-8">
              <p className="text-xs text-soft font-mono mb-3">{t("grammar.test.title", { topic: topicName })}</p>
              {current.repeat && <p className="mb-3"><span className="pill text-soft">{t("grammar.test.repeatPill")}</span></p>}
              <h2 className="display text-xl sm:text-2xl leading-relaxed break-words">{question}</h2>
              {lang === "vi" && current.questionVi && current.questionEn !== question && (
                <p className="text-sm text-soft mt-2">{current.questionEn}</p>
              )}
              <p className="text-xs text-soft mt-3">{t("grammar.test.pickAnswer")}</p>
            </div>

            <div className="grid sm:grid-cols-2 gap-2.5" data-nosound>
              {current.choices.map((opt, i) => {
                const shown = reveal !== "hidden";
                const isCorrect = serverAnswer === i;
                const isPicked = chosen === i;
                return (
                  <button
                    key={i}
                    aria-disabled={shown || posting}
                    onClick={() => void pick(i)}
                    className={`text-left rounded-2xl border p-4 transition-all flex items-start gap-3 ${
                      shown && isCorrect
                        ? "border-moss-500 bg-moss-500/10 cursor-default"
                        : shown && isPicked
                          ? "border-red-400 bg-red-400/10 cursor-default"
                          : shown
                            ? "border-line opacity-60 cursor-default"
                            : "border-line hover:border-ink/30 hover:bg-paper-200/40"
                    }`}
                  >
                    <span className="text-xs font-mono text-soft mt-0.5">{LETTERS[i]}</span>
                    <span className="text-sm leading-snug">{opt}</span>
                    {shown && isCorrect && <CheckCircle2 size={16} className="ml-auto shrink-0 text-moss-500" />}
                    {shown && isPicked && !isCorrect && <XCircle size={16} className="ml-auto shrink-0 text-red-400" />}
                  </button>
                );
              })}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: `src/app/grammar/[topic]/test/page.tsx`**

```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { AuthRequired } from "@/components/auth-required";
import { GrammarSession } from "@/components/grammar/grammar-session";
import { GRAMMAR_SESSION_SIZE } from "@/lib/gamification-defs";
import type { GrammarSessionItem } from "@/lib/grammar/session-types";

export const dynamic = "force-dynamic";

// Fisher–Yates — Math.random is fine here, the pick is UX not security.
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default async function GrammarTestPage({ params }: { params: { topic: string } }) {
  const user = await getCurrentUser();
  if (!user) return <AuthRequired context="grammar" callbackUrl={`/grammar/${params.topic}/test`} />;

  const topic = await prisma.grammarTopic.findUnique({ where: { slug: params.topic } });
  if (!topic) notFound();

  // Prioritise questions never answered correctly (design §6): fetch the
  // topic's id set, subtract the user's first-correct ledger, fill the round
  // with repeats (0 XP server-side) when fresh ones run short.
  const [ids, answeredCorrect] = await Promise.all([
    prisma.grammarTestQuestion.findMany({ where: { topicId: topic.id }, select: { id: true } }),
    prisma.grammarAnswerState.findMany({
      where: { userId: user.id, source: "topic_test", firstCorrectAt: { not: null } },
      select: { questionId: true },
    }),
  ]);
  if (ids.length === 0) {
    return (
      <main className="shell py-14 max-w-xl text-center">
        <p className="text-soft mb-6">Chủ đề này chưa có câu hỏi kiểm tra.</p>
        <Link href={`/grammar/${topic.slug}`} className="inline-flex rounded-full border border-line px-5 py-2.5 text-sm font-medium">
          ← {topic.nameVi ?? topic.nameEn}
        </Link>
      </main>
    );
  }

  const correctSet = new Set(answeredCorrect.map((a) => a.questionId));
  const fresh = shuffle(ids.filter((q) => !correctSet.has(q.id))).slice(0, GRAMMAR_SESSION_SIZE);
  const repeats = shuffle(ids.filter((q) => correctSet.has(q.id))).slice(
    0,
    Math.max(0, GRAMMAR_SESSION_SIZE - fresh.length)
  );
  const picked = [
    ...fresh.map((q) => ({ id: q.id, repeat: false })),
    ...repeats.map((q) => ({ id: q.id, repeat: true })),
  ];
  const rows = await prisma.grammarTestQuestion.findMany({
    where: { id: { in: picked.map((p) => p.id) } },
    select: { id: true, questionEn: true, questionVi: true, choicesEn: true },
  });
  const repeatById = new Map(picked.map((p) => [p.id, p.repeat]));
  const order = new Map(picked.map((p, i) => [p.id, i]));
  const items: GrammarSessionItem[] = rows
    .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
    .map((r) => ({
      id: r.id,
      questionEn: r.questionEn,
      questionVi: r.questionVi,
      choices: Array.isArray(r.choicesEn) ? (r.choicesEn as string[]) : [],
      repeat: repeatById.get(r.id) ?? false,
    }));

  return (
    <GrammarSession
      source="topic_test"
      topicSlug={topic.slug}
      topicNameEn={topic.nameEn}
      topicNameVi={topic.nameVi}
      items={items}
    />
  );
}
```

Lưu ý cho implementer: trang test này KHÔNG bị ẩn nav như `/study/*` (nav.tsx chỉ ẩn theo prefix `/study/`) — chấp nhận ở v1, phiên vẫn dùng được; KHÔNG sửa nav.tsx thêm prefix nếu không có ruling.

- [ ] **Step 3: Smoke dev — vòng lặp học trọn vẹn**

- `/grammar/simple-past/test`: 10 câu, chọn đáp án → highlight xanh/đỏ + đáp án đúng hiện, sound/haptic; phím 1–4 hoạt động; tap nền advance sớm.
- Kết phiên: %, XP (20 XP max câu mới + 5 bonus), danh sách câu sai với đáp án đúng, "Làm lại câu sai" chạy vòng mới chỉ gồm câu sai.
- Làm lại phiên mới `/grammar/simple-past/test`: các câu đã đúng xuất hiện với pill "Ôn lại — không XP" chỉ khi topic cạn câu mới (topic 420 câu — muốn thấy pill, test bằng topic nhỏ: `other-grammar` 30 câu, làm 3 vòng).
- Hub `/grammar`: mastery của topic vừa test hiện % (≥5 câu); topic card cập nhật.
- DB: `GrammarTopicProgress.recent` đúng chuỗi kết quả; streak: `computeStreakFromDb` — kiểm nhanh `DailyStat` hôm nay có `grammarCount > 0` và trang chủ hiện streak ≥ 1 với user chỉ học grammar (nếu user bypass đã có review vocab hôm nay thì tạo user thử khác hoặc ghi nhận hạn chế).
Ghi kết quả vào report.

- [ ] **Step 4: Build + full test + commit**

Run: `npx tsc --noEmit && npm test` → sạch.

```bash
git add src/components/grammar src/app/grammar/\[topic\]/test
git commit -m "feat(grammar): phiên test 10 câu server-graded + màn tổng kết + làm lại câu sai"
```

---

## Self-review đã chạy (kết quả)

- **Spec coverage (Plan 2 = §5 routes hub/topic/lesson/test + §6 UX lesson/test + §7 mastery/XP/streak + §8 idempotency):** hub/topic/lesson/test → Task 6/7/9; mastery → Task 2 + hiển thị Task 6; XP 3 đường + streak → Task 1/3/7/8; idempotency answer/session-end → Task 8; ẩn test 4 topic 0 câu → Task 6 Step 5 + Task 7 (`testQuestionCount > 0`); VI fallback + nhãn → Task 7; lightbox → Task 7; phím 1–4 → Task 9. Ngoài phạm vi Plan 2 (để Plan 3): satellites hub (luyện nhanh/confused/mistakes), sổ câu sai UI, badges, cột `GrammarCategoryStat`.
- **Placeholder:** không còn TBD; hai điểm executor tự quyết có ghi rõ tiêu chí (nav 6 tab mobile — Step 2 Task 5; StudySession lẫn stats — Step 4 Task 8 yêu cầu grep + báo cáo từng call site).
- **Type consistency:** `GrammarSessionItem`/`GrammarSource` (Task 8) khớp cách dùng Task 9; `awardGrammarXp(userId, amount, tx)` (Task 3) khớp call Task 7/8; `masteryPct`/`pushRecent` (Task 2) khớp Task 4/8; `MasteryBadge` export từ `hub-view.tsx` được `topic-view.tsx` import tương đối `../hub-view`; key i18n dùng ở Task 6/7/9 đều nằm trong danh sách Task 5.
- **Bẫy đã né có chủ đích:** client không bao giờ nhận `answerIndex` trước khi trả lời (chống cheat + server là thẩm quyền XP); `.grammar-prose h1` ẩn vì trùng tiêu đề trang; ảnh lesson nền trắng được padding trắng ở dark mode; `--gr-*` theo đúng quy ước channel-triplet + `.dark` override (bẫy DEFAULT-key Tailwind không dính vì dùng CSS thuần trong globals.css).
