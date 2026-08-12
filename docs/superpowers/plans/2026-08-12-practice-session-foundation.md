# Practice Session Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thay 2 component phiên học trùng lặp bằng một `PracticeShell` dùng chung, thêm giới hạn phiên (mặc định 15 thẻ thay vì 220), và sửa 4 khuyết điểm đã xác nhận — trong khi giữ nguyên hành vi chấm điểm hiện tại.

**Architecture:** Tách phần không phụ thuộc mode (queue, progress, gọi API review, ghi `StudySession`, tổng kết) vào `PracticeShell`. Mỗi mode co lại thành một hàm render **một item** rồi báo kết quả qua `onAnswer`. Bốn module trong `src/lib/practice/` là hàm thuần (không Prisma, không DOM) nên test được bằng vitest. `buildSessionPlan` là lớp *kích thước phiên* nằm trên ngân sách ngày của FSRS — không thay ngân sách đó.

**Tech Stack:** Next.js 14 App Router · TypeScript 5.7 · Prisma 5 + PostgreSQL (Neon) · `ts-fsrs` 4.5 · Motion (Framer) 11 · Tailwind 3.4 · **vitest (thêm mới ở Task 1)**

## Global Constraints

- Spec nguồn: `docs/superpowers/specs/2026-08-12-practice-modes-upgrade-design.md`. Mọi mâu thuẫn giữa plan này và spec → spec thắng, trừ những chỗ plan ghi rõ là tinh chỉnh.
- **Mỗi task phải để repo chạy được và `npx tsc --noEmit` sạch.** Chạy nó trước khi commit.
- **Không đổi `newCardsPerDay` / `reviewsPerDay`** — đó là ngân sách ngày của FSRS. Kích thước phiên là một lớp riêng nằm trên.
- **Không đổi hành vi chấm điểm trong plan này.** `gradeAnswer` giữ đúng ánh xạ hiện tại (`correct → Good(3)`, `wrong → Again(1)`). Chấm 4 mức là Phase 3, plan sau.
- **`src/lib/practice/{types,grading,session-state}.ts` không được import Prisma, `next/*`, hay chạm DOM.** Đó là điều kiện để test chúng bằng vitest environment `node`.
- Rating là số nguyên `1|2|3|4` và **phải trùng số của `Rating` trong `ts-fsrs`** (`Again 1 · Hard 2 · Good 3 · Easy 4`). Task 2 có test khoá bất biến này.
- i18n: mọi chuỗi UI mới phải thêm vào **cả `vi` và `en`** trong `src/lib/i18n/dictionaries.ts`. Dictionary là object lồng, truy cập bằng dot-path (`t("practice.check")`); key thiếu sẽ render ra chính key đó.
- Giữ nguyên các class Tailwind/globals đang dùng (`shell`, `card-atelier`, `pill`, `display`, `text-soft`, `border-line`, `bg-paper`, `text-ember`, `bg-moss-500`, `text-cefr-*`). Không tạo token màu mới trong plan này.
- Commit bằng Conventional Commits, tiếng Anh, một dòng subject.

---

## Phạm vi plan này, và vì sao

Spec có 10 phase và bao 3 hệ thống. Người dùng cố ý gộp thành **một spec**, nhưng một *plan* 10 phase sẽ là ~50 task — không ai thực thi nổi và không phase nào giao được software chạy được độc lập.

**Plan này = Phase 0–2 của spec §14.** Nó là đơn vị nhỏ nhất giao được software chạy được:

> 4 mode dựa-trên-thẻ (Trắc nghiệm · Gõ · Nghe-viết · Flashcard) chạy trên một shell chung, phiên có giới hạn và điểm dừng, mọi mode ghi `StudySession`, không thẻ nào bị khoá chờ animation.

Sửa trong plan này: **D1** (thiếu `StudySession` row), **D4** (khoá 1.100ms), **D5** (queue 220 thẻ), **D6** (`quiz-options` treo skeleton).

Các plan tiếp theo, mỗi cái một file riêng:

| Plan | Spec phase | Giao được gì |
|---|---|---|
| 2 | 3–4 | Chấm 4 mức + chip sửa · tổng kết giàu + danh sách từ sai + drill non-SRS + resume |
| 3 | 5–6 | Distractor thông minh · mode Cloze · mode Ảnh→từ |
| 4 | 7–8 | Hub chia nhóm + `Settings.sessionSize` (sửa D3) · animation/haptic/reduced-motion |
| 5 | 9 | *(tuỳ chọn)* Phát âm vào shell |

**Không** làm trong plan này: chấm 4 mức, chip sửa, combo UI, danh sách từ sai, resume localStorage, hub, animation mới, mode mới. Đừng kéo chúng vào.

---

## File Structure

**Tạo mới**

| File | Trách nhiệm |
|---|---|
| `src/lib/practice/types.ts` | `PracticeItem` · `GradeSignals` · `ItemResult` · `PracticeMode` · `RATING` · `ModeViewProps`. Không logic. |
| `src/lib/practice/session-state.ts` | Reducer thuần: answer → pending → commit; combo; summary |
| `src/lib/practice/session-state.test.ts` | Test reducer |
| `src/lib/practice/grading.ts` | `gradeAnswer(mode, signals) → Rating`. Plan này: thân nhị phân |
| `src/lib/practice/grading.test.ts` | Test grading + khoá bất biến số Rating với ts-fsrs |
| `src/lib/practice/session-limits.ts` | `deriveSessionLimits` — số học thuần, chia `size` thành review/new |
| `src/lib/practice/session-limits.test.ts` | Test số học giới hạn |
| `src/lib/practice/session-plan.ts` | `buildSessionPlan` (server): đếm → suy giới hạn → lấy thẻ → serialize |
| `src/components/practice/practice-shell.tsx` | Vỏ phiên: queue · progress · POST review · `StudySession` · tổng kết · skip |
| `src/components/practice/session-summary.tsx` | Màn tổng kết dùng chung (tổng quát hoá từ `CompleteScreen` của flashcard) |
| `src/components/practice/modes/index.ts` | Registry `MODE_VIEWS` |
| `src/components/practice/modes/quiz.tsx` | Trắc nghiệm — một item |
| `src/components/practice/modes/typing.tsx` | Gõ đáp án — một item |
| `src/components/practice/modes/dictation.tsx` | Nghe & viết — một item |
| `src/components/practice/modes/flashcard.tsx` | Flashcard — adapter `PracticeItem` → `Card` + tự đánh giá |
| `vitest.config.ts` | Cấu hình vitest, alias `@` |

**Sửa**

| File | Sửa gì |
|---|---|
| `src/lib/study-engine.ts` | Tách `studyWordFilter` · `countNewStudiedToday` · `fetchDueCards` · `fetchNewCards`; `buildStudyQueue` thành hàm hợp thành; guard `take <= 0` |
| `src/app/study/{quiz,typing,dictation,flashcard}/page.tsx` | Dùng `buildSessionPlan` + `PracticeShell` |
| `src/lib/i18n/dictionaries.ts` | Thêm key mới vào cả `vi` và `en` |
| `package.json` | `devDependencies.vitest` + script `test` |
| `.github/workflows/ci.yml` | Thêm step `npm test` |

**Xoá (Task 8)**

`src/components/study/practice-session.tsx` · `src/components/study/study-session.tsx` · `src/app/study/_lib/serialize.ts` · `getQuizDistractors` trong `study-engine.ts`

**Không chạm**

`src/components/study/flashcard.tsx` (type `Card` của nó đang được `cram-session.tsx` và `topic-viewer.tsx` dùng — mode flashcard mới sẽ *adapt* sang, không sửa) · `matching-game.tsx` · `pronunciation-session.tsx` · `cram-session.tsx` · `src/lib/fsrs.ts` · `src/lib/cloze.ts`

---

## Task 1: Types + vitest harness + session reducer

**Files:**
- Create: `vitest.config.ts`
- Create: `src/lib/practice/types.ts`
- Create: `src/lib/practice/session-state.ts`
- Test: `src/lib/practice/session-state.test.ts`
- Modify: `package.json` (devDeps + script), `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: nothing (task đầu tiên)
- Produces: `PracticeMode`, `PracticeItem`, `GradeSignals`, `ItemResult`, `RATING`, `Rating`, `ModeViewProps` từ `@/lib/practice/types`; `initialSessionState`, `reduceSession(state, action)`, `sessionSummary(state)`, type `SessionState`, `SessionAction` từ `@/lib/practice/session-state`

- [ ] **Step 1: Cài vitest và thêm script**

```bash
npm install -D vitest@^2
```

Thêm vào `package.json` trong `"scripts"`, ngay sau `"lint"`:

```json
    "test": "vitest run",
```

- [ ] **Step 2: Cấu hình vitest**

Tạo `vitest.config.ts` ở gốc repo. `package.json` **không** có `"type": "module"` nên file config chạy dưới CJS và `__dirname` dùng được.

```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
});
```

Test luôn `import { describe, it, expect } from "vitest"` tường minh — **không** bật `globals`, nhờ vậy không phải sửa `tsconfig.json`.

- [ ] **Step 3: Viết types**

Tạo `src/lib/practice/types.ts`:

```ts
import type { ReactElement } from "react";

export type PracticeMode = "quiz" | "typing" | "dictation" | "flashcard" | "cloze" | "image-word";

// Numeric FSRS grades. MUST stay identical to ts-fsrs's Rating enum — locked by a
// test in grading.test.ts. Declared locally (not imported from @/lib/fsrs) so this
// module stays free of ts-fsrs, which keeps lib/practice pure and cheap to test.
export const RATING = { Again: 1, Hard: 2, Good: 3, Easy: 4 } as const;
export type Rating = 1 | 2 | 3 | 4;

// One card as every mode sees it. Superset of what the old PracticeCard and the
// Flashcard `Card` type carried, so a single type serves all six modes.
export type PracticeItem = {
  cardId: string;
  wordId: string;
  word: string;
  cefr: string;
  typeEn: string | null;
  typeVi: string | null;
  ipaUk: string | null;
  ipaUs: string | null;
  definitionEn: string | null;
  definitionVi: string | null;
  extraDefs: string[];
  example: string | null;
  exampleVi: string | null;
  synonyms: string[];
  antonyms: string[];
  imageUrl: string | null;
  audioUk: string | null;
  audioUs: string | null;
  starred: boolean;
  isNew: boolean;
  // FSRS snapshot — flashcard needs it for interval previews, grading needs
  // `state` for the Relearning cap (spec §6).
  state: number;
  reps: number;
  lapses: number;
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  due: string; // ISO
  lastReview: string | null; // ISO
};

// What a mode observes about how the answer was produced. Consumed only by
// gradeAnswer. Fields beyond `correct`/`elapsedMs`/`wordLength`/`cardState`/
// `wasHidden` are per-mode and optional.
export type GradeSignals = {
  correct: boolean;
  elapsedMs: number;
  wordLength: number;
  cardState: number;
  wasHidden: boolean;
  hintUsed?: boolean;
  typoAccepted?: boolean;
  replays?: number;
  slowedDown?: boolean;
  changedAnswer?: boolean;
  selfRated?: Rating;
};

export type ItemResult = {
  cardId: string;
  wordId: string;
  word: string;
  correct: boolean;
  rating: Rating;
};

export type SessionPlan = {
  items: PracticeItem[];
  remaining: { due: number; new: number };
  sizeUsed: number;
};

// The shell↔mode contract (spec §4). A mode renders ONE item and reports back.
// It never touches FSRS, never calls the review API, never keeps score.
// `onSkip` is a plan-level refinement of the spec contract: it is how a mode
// reports an item it cannot render (spec §11, defect D6).
export type ModeViewProps = {
  item: PracticeItem;
  reveal: "hidden" | "correct" | "wrong";
  onAnswer: (r: { correct: boolean; signals: GradeSignals }) => void;
  onSkip: (reason: string) => void;
  // Card face for the modes that have one (flashcard). Ignored by the others.
  // It lives here rather than as an extra prop on one mode because MODE_VIEWS is
  // typed as ModeView — a prop the type doesn't know about is a compile error at
  // the shell's render site.
  direction?: "forward" | "reverse" | "cloze";
};

export type ModeView = (p: ModeViewProps) => ReactElement;
```

- [ ] **Step 4: Viết test reducer (thất bại trước)**

Tạo `src/lib/practice/session-state.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { initialSessionState, reduceSession, sessionSummary } from "./session-state";
import { RATING } from "./types";
import type { ItemResult } from "./types";

const res = (over: Partial<ItemResult> = {}): ItemResult => ({
  cardId: "c1",
  wordId: "w1",
  word: "abandon",
  correct: true,
  rating: RATING.Good,
  ...over,
});

describe("reduceSession", () => {
  it("stores an answer as pending, not as a result", () => {
    const s = reduceSession(initialSessionState, { type: "answer", result: res() });
    expect(s.pending).toEqual(res());
    expect(s.results).toEqual([]);
    expect(s.index).toBe(0);
  });

  it("ignores a second answer while one is pending (double-submit guard)", () => {
    const s1 = reduceSession(initialSessionState, { type: "answer", result: res() });
    const s2 = reduceSession(s1, { type: "answer", result: res({ cardId: "c2", correct: false }) });
    expect(s2).toBe(s1);
  });

  it("commit moves pending into results and advances the index", () => {
    const s1 = reduceSession(initialSessionState, { type: "answer", result: res() });
    const s2 = reduceSession(s1, { type: "commit" });
    expect(s2.results).toEqual([res()]);
    expect(s2.pending).toBeNull();
    expect(s2.index).toBe(1);
  });

  it("commit with nothing pending still advances", () => {
    const s = reduceSession(initialSessionState, { type: "commit" });
    expect(s.index).toBe(1);
    expect(s.results).toEqual([]);
  });

  it("adjust rewrites the pending rating and nothing else", () => {
    const s1 = reduceSession(initialSessionState, { type: "answer", result: res() });
    const s2 = reduceSession(s1, { type: "adjust", rating: RATING.Easy });
    expect(s2.pending?.rating).toBe(RATING.Easy);
    expect(s2.pending?.cardId).toBe("c1");
  });

  it("adjust with nothing pending is a no-op", () => {
    const s = reduceSession(initialSessionState, { type: "adjust", rating: RATING.Easy });
    expect(s).toBe(initialSessionState);
  });

  it("builds a combo on correct answers and keeps the best", () => {
    let s = initialSessionState;
    for (let i = 0; i < 3; i++) {
      s = reduceSession(s, { type: "answer", result: res({ cardId: `c${i}` }) });
      s = reduceSession(s, { type: "commit" });
    }
    expect(s.combo).toBe(3);
    expect(s.bestCombo).toBe(3);
  });

  it("resets combo to 0 on a wrong answer but keeps bestCombo", () => {
    let s = initialSessionState;
    s = reduceSession(s, { type: "answer", result: res({ cardId: "a" }) });
    s = reduceSession(s, { type: "commit" });
    s = reduceSession(s, { type: "answer", result: res({ cardId: "b" }) });
    s = reduceSession(s, { type: "commit" });
    s = reduceSession(s, { type: "answer", result: res({ cardId: "c", correct: false, rating: RATING.Again }) });
    expect(s.combo).toBe(0);
    expect(s.bestCombo).toBe(2);
  });

  it("skip advances, records the card, and drops any pending answer", () => {
    const s1 = reduceSession(initialSessionState, { type: "answer", result: res() });
    const s2 = reduceSession(s1, { type: "skip", cardId: "c1" });
    expect(s2.skipped).toEqual(["c1"]);
    expect(s2.index).toBe(1);
    expect(s2.pending).toBeNull();
  });
});

describe("sessionSummary", () => {
  it("computes totals and rounds the percentage", () => {
    let s = initialSessionState;
    const answers: ItemResult[] = [
      res({ cardId: "a" }),
      res({ cardId: "b", correct: false, rating: RATING.Again }),
      res({ cardId: "c" }),
    ];
    for (const a of answers) {
      s = reduceSession(s, { type: "answer", result: a });
      s = reduceSession(s, { type: "commit" });
    }
    const sum = sessionSummary(s);
    expect(sum.total).toBe(3);
    expect(sum.correct).toBe(2);
    expect(sum.pct).toBe(67);
    expect(sum.counts[RATING.Good]).toBe(2);
    expect(sum.counts[RATING.Again]).toBe(1);
  });

  it("lists missed words once each, in order first missed", () => {
    let s = initialSessionState;
    const answers: ItemResult[] = [
      res({ cardId: "b", word: "brief", correct: false, rating: RATING.Again }),
      res({ cardId: "a", word: "abandon" }),
      res({ cardId: "b", word: "brief", correct: false, rating: RATING.Again }),
      res({ cardId: "c", word: "cope", correct: false, rating: RATING.Again }),
    ];
    for (const a of answers) {
      s = reduceSession(s, { type: "answer", result: a });
      s = reduceSession(s, { type: "commit" });
    }
    expect(sessionSummary(s).missed.map((m) => m.word)).toEqual(["brief", "cope"]);
  });

  it("reports 0% for an empty session without dividing by zero", () => {
    const sum = sessionSummary(initialSessionState);
    expect(sum.total).toBe(0);
    expect(sum.pct).toBe(0);
  });
});
```

- [ ] **Step 5: Chạy test, xác nhận THẤT BẠI**

Run: `npm test`
Expected: FAIL — `Failed to resolve import "./session-state"` (file chưa tồn tại)

- [ ] **Step 6: Viết reducer**

Tạo `src/lib/practice/session-state.ts`:

```ts
import { RATING } from "./types";
import type { ItemResult, Rating } from "./types";

// Answering and committing are SEPARATE on purpose. An answer becomes `pending`
// first; the shell commits it when the item is left. That is what lets Plan 2 add
// the "quá dễ / may mắn thôi" chip (a plain `adjust` on the pending rating) with a
// single review POST and no re-grade endpoint (spec §6).
export type SessionState = {
  index: number;
  pending: ItemResult | null;
  results: ItemResult[];
  combo: number;
  bestCombo: number;
  skipped: string[];
};

export type SessionAction =
  | { type: "answer"; result: ItemResult }
  | { type: "adjust"; rating: Rating }
  | { type: "commit" }
  | { type: "skip"; cardId: string };

export const initialSessionState: SessionState = {
  index: 0,
  pending: null,
  results: [],
  combo: 0,
  bestCombo: 0,
  skipped: [],
};

export function reduceSession(s: SessionState, a: SessionAction): SessionState {
  switch (a.type) {
    case "answer": {
      if (s.pending) return s; // already answered this item — ignore double submit
      const combo = a.result.correct ? s.combo + 1 : 0;
      return { ...s, pending: a.result, combo, bestCombo: Math.max(s.bestCombo, combo) };
    }
    case "adjust": {
      if (!s.pending) return s;
      return { ...s, pending: { ...s.pending, rating: a.rating } };
    }
    case "commit": {
      if (!s.pending) return { ...s, index: s.index + 1 };
      return { ...s, results: [...s.results, s.pending], pending: null, index: s.index + 1 };
    }
    case "skip":
      return { ...s, skipped: [...s.skipped, a.cardId], pending: null, index: s.index + 1 };
  }
}

export type SessionSummaryData = {
  total: number;
  correct: number;
  pct: number;
  bestCombo: number;
  missed: ItemResult[];
  counts: Record<Rating, number>;
};

export function sessionSummary(s: SessionState): SessionSummaryData {
  const total = s.results.length;
  const correct = s.results.filter((r) => r.correct).length;

  // A card can be answered twice in one run (flashcard requeues on Again), so the
  // missed list is deduped by cardId, keeping the first miss.
  const missed: ItemResult[] = [];
  const seen = new Set<string>();
  for (const r of s.results) {
    if (r.correct || seen.has(r.cardId)) continue;
    seen.add(r.cardId);
    missed.push(r);
  }

  const counts: Record<Rating, number> = {
    [RATING.Again]: 0,
    [RATING.Hard]: 0,
    [RATING.Good]: 0,
    [RATING.Easy]: 0,
  };
  for (const r of s.results) counts[r.rating]++;

  return {
    total,
    correct,
    pct: total ? Math.round((correct / total) * 100) : 0,
    bestCombo: s.bestCombo,
    missed,
    counts,
  };
}
```

- [ ] **Step 7: Chạy test, xác nhận PASS**

Run: `npm test`
Expected: PASS — 12 test

- [ ] **Step 8: Thêm test vào CI**

Trong `.github/workflows/ci.yml`, chèn ngay **sau** step `Type-check`:

```yaml
      - name: Test
        run: npm test
```

- [ ] **Step 9: Type-check và commit**

```bash
npx tsc --noEmit
git add package.json package-lock.json vitest.config.ts .github/workflows/ci.yml src/lib/practice/
git commit -m "test(practice): add vitest harness, practice types, session reducer"
```

---

## Task 2: Grading module (thân nhị phân, giao diện đúng)

Mục đích task này là **khoá giao diện chấm điểm** để 4 mode migrate sang nó ngay, rồi Plan 2 chỉ cần thay *thân hàm* mà không sửa mode nào. Thân hàm hiện tại giữ đúng hành vi đang chạy — plan này không được đổi lịch FSRS của ai.

**Files:**
- Create: `src/lib/practice/grading.ts`
- Test: `src/lib/practice/grading.test.ts`

**Interfaces:**
- Consumes: `GradeSignals`, `PracticeMode`, `Rating`, `RATING` từ `@/lib/practice/types`
- Produces: `gradeAnswer(mode: PracticeMode, s: GradeSignals): Rating` từ `@/lib/practice/grading`

- [ ] **Step 1: Viết test (thất bại trước)**

Tạo `src/lib/practice/grading.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { Rating as FsrsRating } from "ts-fsrs";
import { gradeAnswer } from "./grading";
import { RATING } from "./types";
import type { GradeSignals } from "./types";

const sig = (over: Partial<GradeSignals> = {}): GradeSignals => ({
  correct: true,
  elapsedMs: 4000,
  wordLength: 7,
  cardState: 2,
  wasHidden: false,
  ...over,
});

describe("RATING", () => {
  // lib/practice declares the grades locally to stay free of ts-fsrs. If ts-fsrs
  // ever renumbers its enum, every review we write would land on the wrong FSRS
  // step — so the two must be pinned together here.
  it("matches the numeric values of ts-fsrs Rating", () => {
    expect(RATING.Again).toBe(FsrsRating.Again);
    expect(RATING.Hard).toBe(FsrsRating.Hard);
    expect(RATING.Good).toBe(FsrsRating.Good);
    expect(RATING.Easy).toBe(FsrsRating.Easy);
  });
});

describe("gradeAnswer", () => {
  it("returns Again for a wrong answer", () => {
    expect(gradeAnswer("quiz", sig({ correct: false }))).toBe(RATING.Again);
  });

  it("returns Again for a wrong answer even when every easy signal is present", () => {
    expect(
      gradeAnswer("typing", sig({ correct: false, elapsedMs: 1, cardState: 2, wasHidden: false }))
    ).toBe(RATING.Again);
  });

  it("returns Good for a correct answer", () => {
    expect(gradeAnswer("quiz", sig())).toBe(RATING.Good);
  });

  it("passes a self-rating straight through (flashcard)", () => {
    expect(gradeAnswer("flashcard", sig({ selfRated: RATING.Hard }))).toBe(RATING.Hard);
    expect(gradeAnswer("flashcard", sig({ selfRated: RATING.Easy }))).toBe(RATING.Easy);
  });

  it("lets a self-rated Again through even though correct is true", () => {
    expect(gradeAnswer("flashcard", sig({ correct: true, selfRated: RATING.Again }))).toBe(
      RATING.Again
    );
  });

  it("never returns a grade outside 1..4", () => {
    const cases: GradeSignals[] = [
      sig(),
      sig({ correct: false }),
      sig({ hintUsed: true }),
      sig({ elapsedMs: 0 }),
      sig({ cardState: 3 }),
      sig({ wasHidden: true }),
    ];
    for (const c of cases) {
      const r = gradeAnswer("dictation", c);
      expect(r).toBeGreaterThanOrEqual(1);
      expect(r).toBeLessThanOrEqual(4);
      expect(Number.isInteger(r)).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận THẤT BẠI**

Run: `npm test -- grading`
Expected: FAIL — `Failed to resolve import "./grading"`

- [ ] **Step 3: Viết grading**

Tạo `src/lib/practice/grading.ts`:

```ts
import { RATING } from "./types";
import type { GradeSignals, PracticeMode, Rating } from "./types";

/**
 * Map how an answer was produced onto an FSRS grade.
 *
 * PLAN 1 SCOPE: this body deliberately reproduces the CURRENT behaviour of the
 * app — correct → Good, wrong → Again — so migrating the four modes onto the
 * shell changes nobody's review schedule. The signals beyond `correct` and
 * `selfRated` are already collected by the modes and simply unused here.
 *
 * PLAN 2 (spec §6) replaces this body with the two-tier rule (base rating from
 * signals, then a cap of Good for Relearning cards and for items where the tab
 * was hidden) and adds the tests for it. Nothing outside this function changes.
 */
export function gradeAnswer(_mode: PracticeMode, s: GradeSignals): Rating {
  if (s.selfRated) return s.selfRated;
  if (!s.correct) return RATING.Again;
  return RATING.Good;
}
```

- [ ] **Step 4: Chạy test, xác nhận PASS**

Run: `npm test`
Expected: PASS — toàn bộ test của Task 1 và Task 2

- [ ] **Step 5: Type-check và commit**

```bash
npx tsc --noEmit
git add src/lib/practice/grading.ts src/lib/practice/grading.test.ts
git commit -m "feat(practice): grading module with FSRS rating parity test"
```

---

## Task 3: Session plan — giới hạn phiên trên ngân sách ngày

Task này sửa **D5**. Nó cũng tách `buildStudyQueue` thành các primitive dùng lại được — bắt buộc, vì `buildStudyQueue` tự trừ `newStudiedToday` khỏi `newLimit`; nếu `buildSessionPlan` truyền một `newLimit` đã trừ rồi thì phép trừ diễn ra **hai lần** và người học mất hết thẻ mới vào cuối ngày.

**Files:**
- Modify: `src/lib/study-engine.ts` (tách primitive, `buildStudyQueue` thành hàm hợp thành)
- Create: `src/lib/practice/session-limits.ts`
- Test: `src/lib/practice/session-limits.test.ts`
- Create: `src/lib/practice/session-plan.ts`

**Interfaces:**
- Consumes: `PracticeItem`, `PracticeMode`, `SessionPlan` từ `@/lib/practice/types`
- Produces:
  - `deriveSessionLimits(input): { reviewLimit: number; newLimit: number }` từ `@/lib/practice/session-limits`
  - `buildSessionPlan(userId, opts): Promise<SessionPlan>`, `parseSize(raw?: string): number | "all"`, `DEFAULT_SESSION_SIZE = 15` từ `@/lib/practice/session-plan`
  - `studyWordFilter(opts)`, `countNewStudiedToday(userId)`, `fetchDueCards(where, limit)`, `fetchNewCards(userId, where, wordFilter, starredIds, limit)` từ `@/lib/study-engine`

- [ ] **Step 1: Viết test số học giới hạn (thất bại trước)**

Tạo `src/lib/practice/session-limits.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { deriveSessionLimits } from "./session-limits";

describe("deriveSessionLimits", () => {
  it("fills the whole session from due cards when there are enough", () => {
    expect(
      deriveSessionLimits({ size: 15, dueAvailable: 45, newAllowanceToday: 20, dailyReviewLimit: 200 })
    ).toEqual({ reviewLimit: 15, newLimit: 0 });
  });

  it("tops up with new cards when due cards run short", () => {
    expect(
      deriveSessionLimits({ size: 15, dueAvailable: 3, newAllowanceToday: 20, dailyReviewLimit: 200 })
    ).toEqual({ reviewLimit: 3, newLimit: 12 });
  });

  it("never exceeds the remaining daily new allowance", () => {
    expect(
      deriveSessionLimits({ size: 15, dueAvailable: 3, newAllowanceToday: 5, dailyReviewLimit: 200 })
    ).toEqual({ reviewLimit: 3, newLimit: 5 });
  });

  it("respects the daily review limit and still tops up with new", () => {
    expect(
      deriveSessionLimits({ size: 15, dueAvailable: 45, newAllowanceToday: 20, dailyReviewLimit: 10 })
    ).toEqual({ reviewLimit: 10, newLimit: 5 });
  });

  it('size "all" falls back to the daily budget', () => {
    expect(
      deriveSessionLimits({ size: "all", dueAvailable: 999, newAllowanceToday: 20, dailyReviewLimit: 200 })
    ).toEqual({ reviewLimit: 200, newLimit: 20 });
  });

  it("returns zeros when nothing is available", () => {
    expect(
      deriveSessionLimits({ size: 15, dueAvailable: 0, newAllowanceToday: 0, dailyReviewLimit: 200 })
    ).toEqual({ reviewLimit: 0, newLimit: 0 });
  });

  it("clamps negative and fractional inputs instead of propagating them", () => {
    expect(
      deriveSessionLimits({ size: 10.7, dueAvailable: -5, newAllowanceToday: -3, dailyReviewLimit: 200 })
    ).toEqual({ reviewLimit: 0, newLimit: 0 });
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận THẤT BẠI**

Run: `npm test -- session-limits`
Expected: FAIL — `Failed to resolve import "./session-limits"`

- [ ] **Step 3: Viết số học giới hạn**

Tạo `src/lib/practice/session-limits.ts`:

```ts
/**
 * Split a requested session size into a due-card limit and a new-card limit.
 *
 * Due cards come first — that is FSRS-correct: a card past its due date is the
 * one whose recall is actually at risk. New cards only fill what is left over,
 * and never more than the day's remaining new allowance.
 *
 * `newAllowanceToday` must already be NET of cards studied today. Callers must
 * not pass the raw `newCardsPerDay` setting.
 */
export function deriveSessionLimits(input: {
  size: number | "all";
  dueAvailable: number;
  newAllowanceToday: number;
  dailyReviewLimit: number;
}): { reviewLimit: number; newLimit: number } {
  const newAllowance = Math.max(0, Math.floor(input.newAllowanceToday));
  const dailyReview = Math.max(0, Math.floor(input.dailyReviewLimit));

  if (input.size === "all") {
    return { reviewLimit: dailyReview, newLimit: newAllowance };
  }

  const size = Math.max(0, Math.floor(input.size));
  const due = Math.max(0, Math.floor(input.dueAvailable));
  const reviewLimit = Math.min(size, due, dailyReview);
  const newLimit = Math.max(0, Math.min(size - reviewLimit, newAllowance));
  return { reviewLimit, newLimit };
}
```

- [ ] **Step 4: Chạy test, xác nhận PASS**

Run: `npm test -- session-limits`
Expected: PASS — 7 test

- [ ] **Step 5: Tách primitive trong study-engine**

Trong `src/lib/study-engine.ts`, thay **toàn bộ** hàm `buildStudyQueue` (từ dòng comment `// Build the study queue: due reviews first, ...` đến hết dấu `}` đóng hàm) bằng khối dưới đây. Hành vi công khai của `buildStudyQueue` **không đổi** — nó chỉ trở thành hàm hợp thành của các primitive mới.

```ts
// The cefr/topic word sub-filter, shared by buildStudyQueue and buildSessionPlan
// so the "how many are due" count and the actual fetch can never disagree.
export function studyWordFilter(opts: { cefr?: string; topic?: string }): Record<string, unknown> {
  const f: Record<string, unknown> = {};
  const cefr = opts.cefr && opts.cefr !== "ALL" ? opts.cefr : undefined;
  const topic = opts.topic && opts.topic !== "ALL" ? opts.topic : undefined;
  if (cefr) f.cefr = cefr;
  if (topic) f.topics = { contains: `"${topic}"` };
  return f;
}

// How many NEW cards the user has already studied today. Counted from ReviewLog
// (state 0), not from Card rows — a card stub can exist without having been seen.
export async function countNewStudiedToday(userId: string): Promise<number> {
  const today = todayStr();
  return prisma.reviewLog.count({
    where: {
      userId,
      state: 0,
      reviewedAt: { gte: new Date(today + "T00:00:00"), lte: new Date(today + "T23:59:59") },
    },
  });
}

// Due review cards (state >= 1, due <= now), soonest first.
export async function fetchDueCards(where: any, limit: number): Promise<StudyCard[]> {
  if (limit <= 0) return [];
  const rows = await prisma.card.findMany({
    where: { ...where, due: { lte: new Date() }, state: { gte: 1 } },
    include: { word: true },
    take: limit,
    orderBy: { due: "asc" },
  });
  return rows.map((c) => toStudyCard(c, false));
}

// New cards, up to `limit`: first any card already sitting in New state and due,
// then freshly created stubs for words never seen.
//
// `limit` is ABSOLUTE — this function does no daily-allowance accounting. The
// caller subtracts countNewStudiedToday. That split is what lets buildSessionPlan
// pass an already-net limit without it being subtracted a second time.
export async function fetchNewCards(
  userId: string,
  where: any,
  wordFilter: Record<string, unknown>,
  starredIds: string[] | null,
  limit: number
): Promise<StudyCard[]> {
  if (limit <= 0) return [];
  const now = new Date();
  const out: StudyCard[] = [];

  const existingNew = await prisma.card.findMany({
    where: { ...where, state: 0, due: { lte: now } },
    include: { word: true },
    take: limit,
  });
  for (const c of existingNew) out.push(toStudyCard(c, true));

  const stillNeeded = limit - existingNew.length;
  if (stillNeeded > 0) {
    const seenWordIds = (
      await prisma.card.findMany({ where: { userId }, select: { wordId: true } })
    ).map((c) => c.wordId);

    // Intersect the starred scope with "not yet seen" so scope=starred is never
    // padded with arbitrary unseen words (spreading wordFilter would otherwise let
    // `id: { notIn }` clobber `id: { in: starredIds }`).
    const freshWordFilter: any = { ...wordFilter };
    if (starredIds) {
      const seen = new Set(seenWordIds);
      freshWordFilter.id = { in: starredIds.filter((id) => !seen.has(id)) };
    } else {
      freshWordFilter.id = { notIn: seenWordIds };
    }

    const freshWords = await prisma.word.findMany({
      where: freshWordFilter,
      take: stillNeeded,
      orderBy: [{ cefr: "asc" }, { word: "asc" }],
    });
    for (const w of freshWords) {
      const card = await prisma.card.create({
        data: { userId, wordId: w.id, due: now, state: 0 },
        include: { word: true },
      });
      out.push(toStudyCard(card, true));
    }
  }
  return out;
}

// Build the study queue: due reviews first, then new cards up to the daily limit.
// Now a thin composition of the primitives above — public behaviour unchanged.
export async function buildStudyQueue(
  userId: string,
  opts?: {
    cefr?: string;
    topic?: string;
    newLimit?: number;
    reviewLimit?: number;
    scope?: "starred" | "leeches";
  }
): Promise<{ queue: StudyCard[]; counts: { new: number; due: number; total: number } }> {
  const settings = await getSettings(userId);
  const newLimit = opts?.newLimit ?? settings.newCardsPerDay;
  const reviewLimit = opts?.reviewLimit ?? settings.reviewsPerDay;

  const wordFilter = studyWordFilter(opts ?? {});
  // "leeches" scope has no SRS path by design — leeches are usually not due, and
  // off-schedule Good ratings would corrupt FSRS stability. Leech review is
  // cram-only (see buildCramQueue); no-op fallthrough here on purpose.
  let starredIds: string[] | null = null;
  if (opts?.scope === "starred") {
    starredIds = await getStarredWordIds(userId);
    wordFilter.id = { in: starredIds };
  }
  const where = Object.keys(wordFilter).length ? { userId, word: wordFilter } : { userId };

  const newRemaining = Math.max(0, newLimit - (await countNewStudiedToday(userId)));
  const dueStudy = await fetchDueCards(where, reviewLimit);
  const newCards = await fetchNewCards(userId, where, wordFilter, starredIds, newRemaining);

  const queue = [...dueStudy, ...newCards].slice(0, reviewLimit + newLimit);
  return {
    queue,
    counts: { new: newCards.length, due: dueStudy.length, total: queue.length },
  };
}
```

Sau khi thay, `toStudyCard` phải nằm **trên** `fetchDueCards` trong file (nó đang được khai báo bằng `function`, nên hoisting lo phần này — không cần di chuyển).

- [ ] **Step 6: Viết session-plan**

Tạo `src/lib/practice/session-plan.ts`:

```ts
import "server-only";
import { prisma } from "@/lib/db";
import {
  countNewStudiedToday,
  fetchDueCards,
  fetchNewCards,
  getSettings,
  getStarredWordIds,
  studyWordFilter,
  type StudyCard,
} from "@/lib/study-engine";
import { deriveSessionLimits } from "./session-limits";
import type { PracticeItem, PracticeMode, SessionPlan } from "./types";

export const DEFAULT_SESSION_SIZE = 15;
const MAX_SESSION_SIZE = 200;

// Parse ?size= from a URL. Anything unparseable falls back to the default rather
// than to "all" — a typo must never hand the user a 220-card session (defect D5).
export function parseSize(raw: string | undefined): number | "all" {
  if (raw === "all") return "all";
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_SESSION_SIZE;
  return Math.min(MAX_SESSION_SIZE, Math.floor(n));
}

function toPracticeItem(c: StudyCard, starred: boolean): PracticeItem {
  return {
    cardId: c.cardId,
    wordId: c.id,
    word: c.word,
    cefr: c.cefr,
    typeEn: c.typeEn,
    typeVi: c.typeVi,
    ipaUk: c.ipaUk,
    ipaUs: c.ipaUs,
    definitionEn: c.definitionEn,
    definitionVi: c.definitionVi,
    extraDefs: c.extraDefs,
    example: c.example,
    exampleVi: c.exampleVi,
    synonyms: c.synonyms,
    antonyms: c.antonyms,
    imageUrl: c.imageUrl,
    audioUk: c.audioUk,
    audioUs: c.audioUs,
    starred,
    isNew: c.isNew,
    state: c.state,
    reps: c.reps,
    lapses: c.lapses,
    stability: c.stability,
    difficulty: c.difficulty,
    elapsedDays: c.elapsedDays,
    scheduledDays: c.scheduledDays,
    due: c.due.toISOString(),
    lastReview: c.lastReview ? c.lastReview.toISOString() : null,
  };
}

/**
 * Build a BOUNDED practice session: at most `size` cards, due-first.
 *
 * This is a layer ON TOP of the FSRS daily budget, not a replacement for it —
 * newCardsPerDay / reviewsPerDay still cap the day. It counts what is available
 * first and only then fetches, so the card-stub creation inside fetchNewCards
 * never runs for cards this session will not show (defect D5).
 */
export async function buildSessionPlan(
  userId: string,
  opts: {
    mode: PracticeMode;
    cefr?: string;
    topic?: string;
    size: number | "all";
    scope?: "starred";
  }
): Promise<SessionPlan> {
  const settings = await getSettings(userId);

  const wordFilter = studyWordFilter(opts);
  let starredIds: string[] | null = null;
  if (opts.scope === "starred") {
    starredIds = await getStarredWordIds(userId);
    wordFilter.id = { in: starredIds };
  }
  const where = Object.keys(wordFilter).length ? { userId, word: wordFilter } : { userId };

  const dueAvailable = await prisma.card.count({
    where: { ...where, due: { lte: new Date() }, state: { gte: 1 } },
  });
  const newAllowanceToday = Math.max(
    0,
    settings.newCardsPerDay - (await countNewStudiedToday(userId))
  );

  const limits = deriveSessionLimits({
    size: opts.size,
    dueAvailable,
    newAllowanceToday,
    dailyReviewLimit: settings.reviewsPerDay,
  });

  const dueCards = await fetchDueCards(where, limits.reviewLimit);
  const newCards = await fetchNewCards(userId, where, wordFilter, starredIds, limits.newLimit);
  const queue = [...dueCards, ...newCards];

  const starred = new Set(
    (
      await prisma.wordMark.findMany({
        where: { userId, starred: true, wordId: { in: queue.map((c) => c.id) } },
        select: { wordId: true },
      })
    ).map((m) => m.wordId)
  );

  return {
    items: queue.map((c) => toPracticeItem(c, starred.has(c.id))),
    remaining: {
      due: Math.max(0, dueAvailable - dueCards.length),
      new: Math.max(0, newAllowanceToday - newCards.length),
    },
    sizeUsed: queue.length,
  };
}
```

- [ ] **Step 7: Chạy toàn bộ test + type-check**

Run: `npm test && npx tsc --noEmit`
Expected: PASS, và `tsc` không báo lỗi.

- [ ] **Step 8: Xác nhận queue cũ vẫn chạy y như trước**

Run: `npm run dev`, mở `http://localhost:3000/study/flashcard`
Expected: flashcard vẫn load queue như trước Task 3 (nó vẫn dùng `buildStudyQueue`, chưa migrate). Đây là bài kiểm tra rằng việc tách primitive không làm hỏng gì.

- [ ] **Step 9: Commit**

```bash
git add src/lib/study-engine.ts src/lib/practice/session-limits.ts src/lib/practice/session-limits.test.ts src/lib/practice/session-plan.ts
git commit -m "feat(practice): bounded session plan on top of the FSRS daily budget"
```

---

## Task 4: PracticeShell + tổng kết + migrate Trắc nghiệm

Task lớn nhất và là điểm chứng minh kiến trúc. Sửa **D1**, **D4**, **D6**.

**Files:**
- Create: `src/components/practice/practice-shell.tsx`
- Create: `src/components/practice/session-summary.tsx`
- Create: `src/components/practice/modes/index.ts`
- Create: `src/components/practice/modes/quiz.tsx`
- Modify: `src/app/study/quiz/page.tsx`
- Modify: `src/lib/i18n/dictionaries.ts`

**Interfaces:**
- Consumes: `buildSessionPlan`, `parseSize` (`@/lib/practice/session-plan`); `reduceSession`, `initialSessionState`, `sessionSummary`, `SessionSummaryData` (`@/lib/practice/session-state`); `gradeAnswer` (`@/lib/practice/grading`); `RATING`, `PracticeItem`, `PracticeMode`, `ModeViewProps`, `GradeSignals` (`@/lib/practice/types`)
- Produces:
  - `PracticeShell({ items, mode, remaining, direction? })` từ `@/components/practice/practice-shell`
  - `SessionSummary({ data, remaining, durationSec, xpGained, unsaved })` từ `@/components/practice/session-summary`
  - `MODE_VIEWS: Partial<Record<PracticeMode, ModeView>>` từ `@/components/practice/modes`
  - `QuizMode` từ `@/components/practice/modes/quiz`

- [ ] **Step 1: Thêm i18n key**

Trong `src/lib/i18n/dictionaries.ts`, thêm vào object `practice` của **`vi`** (ngay trước dòng `accepted:`):

```ts
      itemSkipped: "Đã bỏ qua một thẻ (không tải được đáp án).",
      unsavedN: "{n} thẻ chưa lưu được — kiểm tra kết nối.",
      onlyN: "Phiên này chỉ có {n} thẻ.",
      continueN: "Học tiếp {n} thẻ",
      comboBest: "Combo dài nhất",
```

Và vào object `practice` của **`en`** (cùng vị trí):

```ts
      itemSkipped: "Skipped a card (couldn't load its answers).",
      unsavedN: "{n} cards couldn't be saved — check your connection.",
      onlyN: "Only {n} cards in this session.",
      continueN: "Study {n} more",
      comboBest: "Best combo",
```

- [ ] **Step 2: Viết màn tổng kết dùng chung**

Tạo `src/components/practice/session-summary.tsx`. Đây là bản tổng quát hoá của `CompleteScreen` trong `study-session.tsx` (giữ nguyên layout và class để không lệch thiết kế), cộng nút "Học tiếp N thẻ".

```tsx
"use client";

import { motion } from "motion/react";
import { CheckCircle2, RotateCcw } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { RATING } from "@/lib/practice/types";
import type { SessionSummaryData } from "@/lib/practice/session-state";

export function SessionSummary({
  data,
  remaining,
  durationSec,
  xpGained,
  unsaved,
}: {
  data: SessionSummaryData;
  remaining: { due: number; new: number };
  durationSec: number;
  xpGained: number;
  unsaved: number;
}) {
  const { t } = useI18n();
  const mm = String(Math.floor(durationSec / 60)).padStart(2, "0");
  const ss = String(durationSec % 60).padStart(2, "0");
  const left = remaining.due + remaining.new;

  const rows = [
    { label: t("study.again"), n: data.counts[RATING.Again], color: "text-red-400", dot: "bg-red-400" },
    { label: t("study.hard"), n: data.counts[RATING.Hard], color: "text-ember", dot: "bg-ember-400" },
    { label: t("study.good"), n: data.counts[RATING.Good], color: "text-moss-500", dot: "bg-moss-500" },
    { label: t("study.easy"), n: data.counts[RATING.Easy], color: "text-cefr-a2", dot: "bg-cefr-a2" },
  ];

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-6 py-10">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md"
      >
        <motion.div
          initial={{ scale: 0, rotate: -30 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ delay: 0.1, type: "spring", stiffness: 200 }}
          className="mx-auto mb-5 grid h-20 w-20 place-items-center rounded-full bg-moss-500/15 text-moss-500"
        >
          <CheckCircle2 size={40} strokeWidth={1.5} />
        </motion.div>

        <h2 className="display text-display-md mb-1 text-center">{t("study.sessionComplete")}</h2>
        <p className="text-soft text-center mb-2">{t("study.youReviewed", { n: data.total })}</p>
        {xpGained > 0 && (
          <p className="text-center mb-2 text-sm font-semibold text-ember">
            {t("gamify.xpEarned", { n: xpGained })}
          </p>
        )}
        {unsaved > 0 && (
          <p className="text-center mb-2 text-sm text-red-500">{t("practice.unsavedN", { n: unsaved })}</p>
        )}
        <div className="mb-4" />

        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="card-atelier p-4 text-center">
            <p className="display text-2xl text-moss-500 tabular-nums">{data.pct}%</p>
            <p className="text-[10px] uppercase tracking-wide text-soft">{t("study.accLabel")}</p>
          </div>
          <div className="card-atelier p-4 text-center">
            <p className="display text-2xl tabular-nums">
              {mm}:{ss}
            </p>
            <p className="text-[10px] uppercase tracking-wide text-soft">{t("study.timeLabel")}</p>
          </div>
          <div className="card-atelier p-4 text-center">
            <p className="display text-2xl tabular-nums">{data.bestCombo}</p>
            <p className="text-[10px] uppercase tracking-wide text-soft">{t("practice.comboBest")}</p>
          </div>
        </div>

        <div className="card-atelier p-5 mb-6">
          <p className="text-[11px] uppercase tracking-wider text-soft font-semibold mb-3">
            {t("study.breakdown")}
          </p>
          <div className="space-y-2.5">
            {rows.map((r) => {
              const pct = data.total > 0 ? (r.n / data.total) * 100 : 0;
              return (
                <div key={r.label} className="flex items-center gap-3">
                  <span className="flex items-center gap-2 w-16 shrink-0">
                    <span className={`h-2 w-2 rounded-full ${r.dot}`} />
                    <span className="text-sm">{r.label}</span>
                  </span>
                  <div className="flex-1 h-2 rounded-full bg-ink/8 overflow-hidden">
                    <motion.div
                      className={`h-full ${r.dot}`}
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ delay: 0.2, duration: 0.5 }}
                    />
                  </div>
                  <span className={`text-sm font-semibold tabular-nums w-6 text-right ${r.color}`}>
                    {r.n}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {left > 0 && (
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-ink text-paper px-6 py-3 font-medium hover:opacity-90"
            >
              <RotateCcw size={16} /> {t("practice.continueN", { n: left })}
            </button>
          )}
          <a
            href="/study"
            className="inline-flex items-center justify-center gap-2 rounded-full border border-line px-6 py-3 font-medium hover:bg-paper-200/50"
          >
            {t("study.changeMode")}
          </a>
        </div>
      </motion.div>
    </div>
  );
}
```

Nút "Học tiếp" dùng `window.location.reload()` vì plan được dựng lại phía server ở mỗi lần load — reload trả về N thẻ tiếp theo. Dừng vẫn là mặc định: không có auto-continue.

- [ ] **Step 3: Viết PracticeShell**

Tạo `src/components/practice/practice-shell.tsx`:

```tsx
"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useI18n } from "@/components/i18n-provider";
import { useAchievementToasts } from "@/components/gamification/achievement-toast";
import { initialSessionState, reduceSession, sessionSummary } from "@/lib/practice/session-state";
import { gradeAnswer } from "@/lib/practice/grading";
import { RATING } from "@/lib/practice/types";
import type { GradeSignals, PracticeItem, PracticeMode } from "@/lib/practice/types";
import { SessionSummary } from "./session-summary";
import { MODE_VIEWS } from "./modes";

// How long the answer stays revealed before auto-advancing. This is a LAZY PATH,
// not a lock: any pointer or key input advances immediately (defect D4).
const REVEAL_MS = 1200;

// Only flashcard requeues an Again card inside the same run — that is its
// learning-step behaviour. The auto-graded modes move on, as they do today.
const REQUEUE_ON_AGAIN: Record<PracticeMode, boolean> = {
  flashcard: true,
  quiz: false,
  typing: false,
  dictation: false,
  cloze: false,
  "image-word": false,
};

type PendingPost = { cardId: string; rating: number; correct: boolean };

export function PracticeShell({
  items,
  mode,
  remaining,
  direction,
}: {
  items: PracticeItem[];
  mode: PracticeMode;
  remaining: { due: number; new: number };
  // Forwarded to the mode view. Only flashcard reads it (Task 7); quiz, typing
  // and dictation ignore it. Declared here from the start so Task 7 does not have
  // to reopen the shell.
  direction?: "forward" | "reverse" | "cloze";
}) {
  const { t } = useI18n();
  const { push: pushToast, toaster } = useAchievementToasts();
  const [state, dispatch] = useReducer(reduceSession, initialSessionState);

  const [queue, setQueue] = useState<PracticeItem[]>(items);
  const [extra, setExtra] = useState<PracticeItem[]>([]);
  const [reveal, setReveal] = useState<"hidden" | "correct" | "wrong">("hidden");
  const [xpGained, setXpGained] = useState(0);
  const [unsaved, setUnsaved] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const sessionIdRef = useRef<string | null>(null);
  const startedAtRef = useRef(Date.now());
  const endedRef = useRef(false);
  const pendingRef = useRef<PendingPost | null>(null);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipCountRef = useRef<Map<string, number>>(new Map());
  // Was the tab hidden at any point during the CURRENT item? A phone call or an
  // app switch makes elapsedMs meaningless, so grading must not read it as fast.
  const hiddenRef = useRef(false);

  const current: PracticeItem | undefined = queue[state.index];
  const View = MODE_VIEWS[mode];

  // ---- session row (defect D1: quiz/typing/dictation never created one) ----
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/study/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode }),
        });
        const d = await res.json();
        if (!cancelled && d?.sessionId) {
          sessionIdRef.current = d.sessionId;
          startedAtRef.current = Date.now();
        }
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, [mode]);

  // ---- reset the per-item hidden flag whenever the item changes ----
  useEffect(() => {
    hiddenRef.current = false;
  }, [current?.cardId]);

  useEffect(() => {
    const h = () => {
      if (document.visibilityState === "hidden") hiddenRef.current = true;
    };
    document.addEventListener("visibilitychange", h);
    return () => document.removeEventListener("visibilitychange", h);
  }, []);

  // ---- review POST, one retry, then surfaced rather than swallowed ----
  const postReview = useCallback(
    async (p: PendingPost, keepalive = false) => {
      const send = () =>
        fetch("/api/study/review", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(p),
          keepalive,
        });
      try {
        const res = await send();
        if (!res.ok) throw new Error(String(res.status));
        const d = await res.json().catch(() => null);
        if (d) {
          if (typeof d.xpGained === "number") setXpGained((x) => x + d.xpGained);
          if (Array.isArray(d.unlocked) && d.unlocked.length) pushToast(d.unlocked);
        }
      } catch {
        try {
          const retry = await send();
          if (!retry.ok) throw new Error(String(retry.status));
        } catch {
          setUnsaved((n) => n + 1);
        }
      }
    },
    [pushToast]
  );

  // ---- advance: commit the pending review and move on ----
  const advance = useCallback(() => {
    if (advanceTimer.current) {
      clearTimeout(advanceTimer.current);
      advanceTimer.current = null;
    }
    const p = pendingRef.current;
    pendingRef.current = null;
    if (p) void postReview(p);
    setReveal("hidden");
    setNotice(null);
    dispatch({ type: "commit" });
  }, [postReview]);

  const onAnswer = useCallback(
    (r: { correct: boolean; signals: GradeSignals }) => {
      if (!current || pendingRef.current) return;
      const rating = gradeAnswer(mode, {
        ...r.signals,
        wasHidden: r.signals.wasHidden || hiddenRef.current,
      });
      pendingRef.current = { cardId: current.cardId, rating, correct: r.correct };
      dispatch({
        type: "answer",
        result: {
          cardId: current.cardId,
          wordId: current.wordId,
          word: current.word,
          correct: r.correct,
          rating,
        },
      });
      setReveal(r.correct ? "correct" : "wrong");
      if (rating === RATING.Again && REQUEUE_ON_AGAIN[mode]) {
        setExtra((e) => [...e, current]);
      }
      advanceTimer.current = setTimeout(advance, REVEAL_MS);
    },
    [current, mode, advance]
  );

  // ---- skip (defect D6): first failure retries at the end, second drops it ----
  const onSkip = useCallback(
    (reason: string) => {
      if (!current) return;
      if (process.env.NODE_ENV !== "production") console.warn("[practice] skip:", reason);
      const seen = (skipCountRef.current.get(current.cardId) ?? 0) + 1;
      skipCountRef.current.set(current.cardId, seen);
      if (seen === 1) setExtra((e) => [...e, current]);
      pendingRef.current = null;
      setNotice(t("practice.itemSkipped"));
      setReveal("hidden");
      dispatch({ type: "skip", cardId: current.cardId });
    },
    [current, t]
  );

  // ---- tap or key advances immediately while an answer is revealed (D4) ----
  useEffect(() => {
    if (reveal === "hidden") return;
    const h = () => advance();
    window.addEventListener("pointerdown", h);
    window.addEventListener("keydown", h);
    return () => {
      window.removeEventListener("pointerdown", h);
      window.removeEventListener("keydown", h);
    };
  }, [reveal, advance]);

  // ---- flush a pending review if the tab goes away mid-reveal ----
  useEffect(() => {
    const h = () => {
      const p = pendingRef.current;
      if (!p) return;
      pendingRef.current = null;
      void postReview(p, true);
    };
    window.addEventListener("pagehide", h);
    return () => window.removeEventListener("pagehide", h);
  }, [postReview]);

  // ---- completion: drain requeued/retried items, then end the session ----
  useEffect(() => {
    if (done || state.index < queue.length) return;
    if (extra.length > 0) {
      setQueue((q) => [...q, ...extra]);
      setExtra([]);
      return;
    }
    if (endedRef.current) return;
    endedRef.current = true;
    setDone(true);

    const sid = sessionIdRef.current;
    if (!sid) return;
    const sum = sessionSummary(state);
    fetch("/api/study/session", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: sid,
        cardsReviewed: sum.total,
        correctCount: sum.correct,
        durationSec: Math.round((Date.now() - startedAtRef.current) / 1000),
      }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d && Array.isArray(d.unlocked) && d.unlocked.length) pushToast(d.unlocked);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.index, queue.length, extra, done]);

  if (done) {
    return (
      <>
        {toaster}
        <SessionSummary
          data={sessionSummary(state)}
          remaining={remaining}
          durationSec={Math.round((Date.now() - startedAtRef.current) / 1000)}
          xpGained={xpGained}
          unsaved={unsaved}
        />
      </>
    );
  }

  if (!current || !View) return <>{toaster}</>;

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col">
      {toaster}

      <div className="sticky top-16 z-30 bg-paper/80 backdrop-blur-md border-b border-line">
        <div className="shell py-2.5 flex items-center gap-3">
          <span className="text-xs text-soft tabular-nums whitespace-nowrap">
            {state.index + 1} <span className="opacity-50">/ {queue.length}</span>
          </span>
          <div className="flex-1 h-1.5 rounded-full bg-ink/10 overflow-hidden">
            <motion.div
              className="h-full bg-cefr-b2 rounded-full"
              animate={{ width: `${(state.index / Math.max(queue.length, 1)) * 100}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
          <span className="text-xs font-mono text-soft">
            {sessionSummary(state).correct}/{state.results.length}
          </span>
        </div>
      </div>

      <div className="shell flex-1 flex flex-col justify-center py-6 sm:py-10 pb-28 md:pb-10">
        {notice && <p className="text-center text-xs text-soft mb-4">{notice}</p>}
        <AnimatePresence mode="wait">
          <motion.div
            key={`${current.cardId}-${state.index}`}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.2 }}
          >
            <View
              item={current}
              reveal={reveal}
              onAnswer={onAnswer}
              onSkip={onSkip}
              direction={direction}
            />
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Viết mode Trắc nghiệm**

Tạo `src/components/practice/modes/quiz.tsx`. Đồng hồ bắt đầu khi 4 đáp án **đã tải xong** — không phải lúc mount (spec §6).

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { AudioButton } from "@/components/audio-button";
import { CefrBadge } from "@/components/cefr-badge";
import { useI18n } from "@/components/i18n-provider";
import type { ModeViewProps } from "@/lib/practice/types";

const LETTERS = ["A", "B", "C", "D"];

export function QuizMode({ item, reveal, onAnswer, onSkip }: ModeViewProps) {
  const { t } = useI18n();
  const [opts, setOpts] = useState<{ options: string[]; correctIndex: number } | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const readyAtRef = useRef<number | null>(null);

  useEffect(() => {
    setOpts(null);
    setSelected(null);
    readyAtRef.current = null;
    let cancelled = false;

    fetch(`/api/study/quiz-options?wordId=${encodeURIComponent(item.wordId)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d) => {
        if (cancelled) return;
        if (d && Array.isArray(d.options) && d.options.length === 4) {
          setOpts({ options: d.options, correctIndex: d.correctIndex });
          readyAtRef.current = Date.now();
        } else {
          onSkip(`quiz-options returned ${d?.options?.length ?? 0} options`);
        }
      })
      .catch((e) => {
        if (!cancelled) onSkip(`quiz-options failed: ${String(e)}`);
      });

    return () => {
      cancelled = true;
    };
  }, [item.wordId, onSkip]);

  const pick = (i: number) => {
    if (selected !== null || !opts) return;
    setSelected(i);
    const correct = i === opts.correctIndex;
    onAnswer({
      correct,
      signals: {
        correct,
        elapsedMs: readyAtRef.current ? Date.now() - readyAtRef.current : 0,
        wordLength: item.word.length,
        cardState: item.state,
        wasHidden: false,
        changedAnswer: false,
      },
    });
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <div className="flex items-center justify-center gap-2 mb-4">
          <CefrBadge level={item.cefr} />
          <AudioButton word={item.word} accent="us" size="sm" />
          <AudioButton word={item.word} accent="uk" size="sm" />
        </div>
        <h2 className="display text-display-md break-words">{item.word}</h2>
        {item.ipaUk && <p className="font-mono text-sm text-soft mt-2">{item.ipaUk}</p>}
        <p className="text-xs text-soft mt-3">{t("practice.whichMeaning")}</p>
      </div>

      {!opts ? (
        <div className="grid grid-cols-2 gap-2 animate-pulse">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-2xl bg-ink/5" />
          ))}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-2.5">
          {opts.options.map((opt, i) => {
            const isCorrect = i === opts.correctIndex;
            const isPicked = selected === i;
            const shown = selected !== null;
            return (
              <button
                key={i}
                disabled={shown}
                onClick={() => pick(i)}
                className={`text-left rounded-2xl border p-4 transition-all flex items-start gap-3 ${
                  shown && isCorrect
                    ? "border-moss-500 bg-moss-500/10"
                    : shown && isPicked
                      ? "border-red-400 bg-red-400/10"
                      : "border-line hover:border-ink/30 hover:bg-paper-200/40"
                }`}
              >
                <span className="text-xs font-mono text-soft mt-0.5">{LETTERS[i]}</span>
                <span className="text-sm leading-snug">{opt}</span>
                {shown && isCorrect && <CheckCircle2 size={16} className="ml-auto text-moss-500" />}
                {shown && isPicked && !isCorrect && (
                  <XCircle size={16} className="ml-auto text-red-400" />
                )}
              </button>
            );
          })}
        </div>
      )}

      {reveal !== "hidden" && (
        <div
          className={`mt-5 rounded-2xl p-4 border ${
            reveal === "correct"
              ? "bg-moss-500/8 border-moss-500/30"
              : "bg-red-400/8 border-red-400/30"
          }`}
        >
          <p
            className={`text-sm font-semibold ${
              reveal === "correct" ? "text-moss-600 dark:text-moss-400" : "text-red-500"
            }`}
          >
            {reveal === "correct" ? t("practice.correct") : t("practice.wrong")}
          </p>
          {item.example && <p className="text-xs text-soft mt-1.5 italic">“{item.example}”</p>}
          {item.exampleVi && <p className="text-xs text-soft/70 mt-0.5">{item.exampleVi}</p>}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Viết registry**

Tạo `src/components/practice/modes/index.ts`:

```ts
import type { ModeView, PracticeMode } from "@/lib/practice/types";
import { QuizMode } from "./quiz";

// Partial while the migration is in flight — Task 7 fills in the remaining modes
// and this becomes a complete Record.
export const MODE_VIEWS: Partial<Record<PracticeMode, ModeView>> = {
  quiz: QuizMode,
};
```

- [ ] **Step 6: Nối trang Trắc nghiệm vào shell**

Thay **toàn bộ** `src/app/study/quiz/page.tsx` bằng:

```tsx
import { redirect } from "next/navigation";
import { buildSessionPlan, parseSize } from "@/lib/practice/session-plan";
import { PracticeShell } from "@/components/practice/practice-shell";
import { EmptyStudy } from "@/components/study/empty-study";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function QuizPage({
  searchParams,
}: {
  searchParams: { cefr?: string; topic?: string; size?: string };
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const plan = await buildSessionPlan(user.id, {
    mode: "quiz",
    cefr: searchParams.cefr,
    topic: searchParams.topic,
    size: parseSize(searchParams.size),
  });
  if (plan.items.length === 0) return <EmptyStudy />;

  return <PracticeShell items={plan.items} mode="quiz" remaining={plan.remaining} />;
}
```

- [ ] **Step 7: Type-check và chạy thử thật**

Run: `npx tsc --noEmit && npm test`
Expected: cả hai sạch.

Run: `npm run dev`, mở `http://localhost:3000/study/quiz`

Kiểm bằng mắt, từng cái:
1. Header hiện `1 / 15` — **không** phải `1 / 220` (D5 đã sửa)
2. Trả lời một câu → dải feedback hiện ra → **chạm bất kỳ đâu là sang thẻ sau ngay**, không phải chờ (D4 đã sửa)
3. Không chạm gì thì tự sang sau ~1,2s
4. Học hết 15 thẻ → tổng kết hiện %, thời gian, combo, phân bổ, và nút **"Học tiếp N thẻ"** nếu còn thẻ đến hạn
5. Mở `http://localhost:3000/study/quiz?size=5` → header hiện `1 / 5`
6. Mở `?size=all` → về hạn mức ngày

Kiểm D1 bằng DB:

```bash
npx prisma studio
```
Mở bảng `StudySession`, xác nhận có row mới `mode = "quiz"` với `cardsReviewed`/`correctCount`/`durationSec` khác 0 sau khi hoàn thành phiên. **Trước task này bảng không bao giờ có row `quiz` nào.**

- [ ] **Step 8: Commit**

```bash
git add src/components/practice src/app/study/quiz/page.tsx src/lib/i18n/dictionaries.ts
git commit -m "feat(practice): session shell + shared summary, migrate quiz mode"
```

---

## Task 5: Migrate mode Gõ đáp án

**Files:**
- Create: `src/components/practice/modes/typing.tsx`
- Modify: `src/components/practice/modes/index.ts`
- Modify: `src/app/study/typing/page.tsx`

**Interfaces:**
- Consumes: `ModeViewProps` (`@/lib/practice/types`); `gradeTyping` (`@/lib/utils`); `PracticeShell`, `buildSessionPlan`, `parseSize`
- Produces: `TypingMode` từ `@/components/practice/modes/typing`; entry `typing` trong `MODE_VIEWS`

- [ ] **Step 1: Viết mode Gõ**

Tạo `src/components/practice/modes/typing.tsx`. `gradeTyping` phân biệt hai loại "đúng": sai 1 ký tự được tha (`acceptedAs === "typo"`) và khớp đồng nghĩa (`acceptedAs` là chính từ đồng nghĩa). Chỉ loại đầu là tín hiệu nhớ mờ.

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { AudioButton } from "@/components/audio-button";
import { CefrBadge } from "@/components/cefr-badge";
import { useI18n } from "@/components/i18n-provider";
import { gradeTyping } from "@/lib/utils";
import type { ModeViewProps } from "@/lib/practice/types";

export function TypingMode({ item, reveal, onAnswer }: ModeViewProps) {
  const { t } = useI18n();
  const [typed, setTyped] = useState("");
  const startedAtRef = useRef(Date.now());
  const shown = reveal !== "hidden";

  useEffect(() => {
    setTyped("");
    startedAtRef.current = Date.now();
  }, [item.cardId]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (shown || !typed.trim()) return;
    const res = gradeTyping(typed, item.word, item.synonyms);
    onAnswer({
      correct: res.correct,
      signals: {
        correct: res.correct,
        elapsedMs: Date.now() - startedAtRef.current,
        wordLength: item.word.length,
        cardState: item.state,
        wasHidden: false,
        // A 1-char typo means the spelling was fuzzy; a synonym match is a fully
        // legitimate answer and must NOT be downgraded.
        typoAccepted: res.acceptedAs === "typo",
      },
    });
  };

  return (
    <div className="max-w-xl mx-auto">
      <div className="text-center mb-8">
        <CefrBadge level={item.cefr} className="mb-4" />
        <p className="text-xs text-soft font-mono mb-2">{t("practice.typeFor")}</p>
        <p className="display text-xl sm:text-2xl leading-snug">{item.definitionEn}</p>
        {item.typeVi && <p className="text-xs text-soft mt-2">{item.typeVi}</p>}
      </div>

      <form onSubmit={submit}>
        <input
          autoFocus
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          disabled={shown}
          placeholder={t("practice.typeWord")}
          className={`w-full text-center text-2xl font-mono rounded-2xl border bg-surface px-4 py-4 outline-none transition-colors ${
            shown
              ? reveal === "correct"
                ? "border-moss-500"
                : "border-red-400"
              : "border-line focus:border-ember"
          }`}
        />
        {!shown && (
          <button
            type="submit"
            className="mt-3 w-full rounded-2xl bg-ink text-paper py-3 font-medium hover:opacity-90"
          >
            {t("practice.check")} <span className="opacity-50 ml-1">↵</span>
          </button>
        )}
      </form>

      {shown && (
        <div className="mt-4 text-center">
          <p className="text-sm text-soft">
            {t("practice.answer")} <span className="display text-xl text-ink">{item.word}</span>
            <span className="font-mono text-xs ml-2">{item.ipaUk}</span>
          </p>
          <div className="flex justify-center gap-1.5 mt-2">
            <AudioButton word={item.word} accent="us" size="sm" />
            <AudioButton word={item.word} accent="uk" size="sm" />
          </div>
          {item.definitionVi && <p className="text-xs text-soft/70 mt-2">{item.definitionVi}</p>}
          <div
            className={`mt-5 rounded-2xl p-4 border text-left ${
              reveal === "correct"
                ? "bg-moss-500/8 border-moss-500/30"
                : "bg-red-400/8 border-red-400/30"
            }`}
          >
            <p
              className={`text-sm font-semibold ${
                reveal === "correct" ? "text-moss-600 dark:text-moss-400" : "text-red-500"
              }`}
            >
              {reveal === "correct" ? t("practice.correct") : t("practice.wrong")}
            </p>
            {item.example && <p className="text-xs text-soft mt-1.5 italic">“{item.example}”</p>}
            {item.exampleVi && <p className="text-xs text-soft/70 mt-0.5">{item.exampleVi}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Đăng ký mode**

Thay `src/components/practice/modes/index.ts` bằng:

```ts
import type { ModeView, PracticeMode } from "@/lib/practice/types";
import { QuizMode } from "./quiz";
import { TypingMode } from "./typing";

// Partial while the migration is in flight — Task 7 fills in the remaining modes
// and this becomes a complete Record.
export const MODE_VIEWS: Partial<Record<PracticeMode, ModeView>> = {
  quiz: QuizMode,
  typing: TypingMode,
};
```

- [ ] **Step 3: Nối trang Gõ vào shell**

Thay **toàn bộ** `src/app/study/typing/page.tsx` bằng:

```tsx
import { redirect } from "next/navigation";
import { buildSessionPlan, parseSize } from "@/lib/practice/session-plan";
import { PracticeShell } from "@/components/practice/practice-shell";
import { EmptyStudy } from "@/components/study/empty-study";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function TypingPage({
  searchParams,
}: {
  searchParams: { cefr?: string; topic?: string; size?: string };
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const plan = await buildSessionPlan(user.id, {
    mode: "typing",
    cefr: searchParams.cefr,
    topic: searchParams.topic,
    size: parseSize(searchParams.size),
  });
  if (plan.items.length === 0) return <EmptyStudy />;

  return <PracticeShell items={plan.items} mode="typing" remaining={plan.remaining} />;
}
```

- [ ] **Step 4: Type-check và chạy thử**

Run: `npx tsc --noEmit && npm test`
Expected: sạch.

Run: `npm run dev`, mở `http://localhost:3000/study/typing`

Kiểm:
1. Header `1 / 15`
2. Gõ đúng → hiện `✓ Chính xác` + đáp án + audio; chạm là sang thẻ sau ngay
3. Gõ sai 1 ký tự (ví dụ từ `abandon` gõ `abandan`) → vẫn được tính đúng (hành vi `gradeTyping` sẵn có)
4. `StudySession` có row `mode = "typing"`

- [ ] **Step 5: Commit**

```bash
git add src/components/practice/modes src/app/study/typing/page.tsx
git commit -m "feat(practice): migrate typing mode onto the session shell"
```

---

## Task 6: Migrate mode Nghe & viết

**Files:**
- Create: `src/components/practice/modes/dictation.tsx`
- Modify: `src/components/practice/modes/index.ts`
- Modify: `src/app/study/dictation/page.tsx`

**Interfaces:**
- Consumes: `ModeViewProps`; `gradeTyping` (`@/lib/utils`); `playWord` (`@/lib/tts`)
- Produces: `DictationMode` từ `@/components/practice/modes/dictation`; entry `dictation` trong `MODE_VIEWS`

- [ ] **Step 1: Viết mode Nghe & viết**

Tạo `src/components/practice/modes/dictation.tsx`. Mode này đếm số lần nghe lại và việc giảm tốc — hai tín hiệu mà Plan 2 dùng để chấm `Hard`.

```tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Volume2 } from "lucide-react";
import { CefrBadge } from "@/components/cefr-badge";
import { useI18n } from "@/components/i18n-provider";
import { gradeTyping } from "@/lib/utils";
import { playWord } from "@/lib/tts";
import type { ModeViewProps } from "@/lib/practice/types";

const SPEEDS = [1, 0.75, 0.5];

export function DictationMode({ item, reveal, onAnswer }: ModeViewProps) {
  const { t } = useI18n();
  const [typed, setTyped] = useState("");
  const [speed, setSpeed] = useState(1);
  const startedAtRef = useRef(Date.now());
  const playsRef = useRef(0);
  const slowedRef = useRef(false);
  const shown = reveal !== "hidden";

  const play = useCallback(() => {
    playsRef.current += 1;
    playWord(item.word, { accent: "us", rate: speed }).catch(() => {});
  }, [item.word, speed]);

  useEffect(() => {
    setTyped("");
    setSpeed(1);
    startedAtRef.current = Date.now();
    playsRef.current = 0;
    slowedRef.current = false;
    const timer = setTimeout(() => {
      playsRef.current += 1;
      playWord(item.word, { accent: "us", rate: 1 }).catch(() => {});
    }, 350);
    return () => clearTimeout(timer);
  }, [item.cardId, item.word]);

  const setSpeedTracked = (s: number) => {
    if (s < 1) slowedRef.current = true;
    setSpeed(s);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (shown || !typed.trim()) return;
    const res = gradeTyping(typed, item.word, item.synonyms);
    onAnswer({
      correct: res.correct,
      signals: {
        correct: res.correct,
        elapsedMs: Date.now() - startedAtRef.current,
        wordLength: item.word.length,
        cardState: item.state,
        wasHidden: false,
        typoAccepted: res.acceptedAs === "typo",
        // The auto-play on mount counts as play 1, so "replayed" means > 1.
        replays: playsRef.current,
        slowedDown: slowedRef.current,
      },
    });
  };

  return (
    <div className="max-w-xl mx-auto">
      <div className="text-center mb-8">
        <div className="flex items-center justify-center gap-2 mb-4">
          <CefrBadge level={item.cefr} />
        </div>
        <p className="text-xs text-soft font-mono mb-3">{t("practice.listenType")}</p>
        <button
          onClick={play}
          className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-ink text-paper hover:opacity-90 transition-opacity"
        >
          <Volume2 size={28} />
        </button>
        <div className="flex justify-center gap-2 mt-4">
          {SPEEDS.map((s) => (
            <button
              key={s}
              onClick={() => setSpeedTracked(s)}
              className={`text-xs rounded-full px-2.5 py-1 border transition-colors ${
                speed === s ? "border-ember text-ember" : "border-line text-soft"
              }`}
            >
              {s === 1 ? "1×" : `${s}×`}
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={submit}>
        <input
          autoFocus
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          disabled={shown}
          placeholder={t("practice.spellHeard")}
          className={`w-full text-center text-2xl font-mono rounded-2xl border bg-surface px-4 py-4 outline-none transition-colors ${
            shown
              ? reveal === "correct"
                ? "border-moss-500"
                : "border-red-400"
              : "border-line focus:border-ember"
          }`}
        />
        {!shown && (
          <button
            type="submit"
            className="mt-3 w-full rounded-2xl bg-ink text-paper py-3 font-medium hover:opacity-90"
          >
            {t("practice.check")} <span className="opacity-50 ml-1">↵</span>
          </button>
        )}
      </form>

      {shown && (
        <div className="mt-4 text-center">
          <p className="text-sm text-soft">
            <span className="display text-xl text-ink">{item.word}</span>
            <span className="font-mono text-xs ml-2">{item.ipaUs || item.ipaUk}</span>
          </p>
          {item.definitionEn && <p className="text-xs text-soft mt-1">{item.definitionEn}</p>}
          {item.definitionVi && <p className="text-xs text-soft/70 mt-0.5">{item.definitionVi}</p>}
          <div
            className={`mt-5 rounded-2xl p-4 border text-left ${
              reveal === "correct"
                ? "bg-moss-500/8 border-moss-500/30"
                : "bg-red-400/8 border-red-400/30"
            }`}
          >
            <p
              className={`text-sm font-semibold ${
                reveal === "correct" ? "text-moss-600 dark:text-moss-400" : "text-red-500"
              }`}
            >
              {reveal === "correct" ? t("practice.correct") : t("practice.wrong")}
            </p>
            {item.example && <p className="text-xs text-soft mt-1.5 italic">“{item.example}”</p>}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Đăng ký mode**

Thay `src/components/practice/modes/index.ts` bằng:

```ts
import type { ModeView, PracticeMode } from "@/lib/practice/types";
import { QuizMode } from "./quiz";
import { TypingMode } from "./typing";
import { DictationMode } from "./dictation";

// Partial while the migration is in flight — Task 7 fills in the remaining modes
// and this becomes a complete Record.
export const MODE_VIEWS: Partial<Record<PracticeMode, ModeView>> = {
  quiz: QuizMode,
  typing: TypingMode,
  dictation: DictationMode,
};
```

- [ ] **Step 3: Nối trang Nghe & viết vào shell**

Thay **toàn bộ** `src/app/study/dictation/page.tsx` bằng:

```tsx
import { redirect } from "next/navigation";
import { buildSessionPlan, parseSize } from "@/lib/practice/session-plan";
import { PracticeShell } from "@/components/practice/practice-shell";
import { EmptyStudy } from "@/components/study/empty-study";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function DictationPage({
  searchParams,
}: {
  searchParams: { cefr?: string; topic?: string; size?: string };
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const plan = await buildSessionPlan(user.id, {
    mode: "dictation",
    cefr: searchParams.cefr,
    topic: searchParams.topic,
    size: parseSize(searchParams.size),
  });
  if (plan.items.length === 0) return <EmptyStudy />;

  return <PracticeShell items={plan.items} mode="dictation" remaining={plan.remaining} />;
}
```

- [ ] **Step 4: Type-check và chạy thử**

Run: `npx tsc --noEmit && npm test`
Expected: sạch.

Run: `npm run dev`, mở `http://localhost:3000/study/dictation`

Kiểm:
1. Audio tự phát sau ~350ms khi vào thẻ mới
2. Bấm nút loa nghe lại được; đổi tốc độ 0.75× / 0.5× có tác dụng
3. Gõ đúng/sai → feedback → chạm là sang thẻ sau
4. `StudySession` có row `mode = "dictation"`

- [ ] **Step 5: Commit**

```bash
git add src/components/practice/modes src/app/study/dictation/page.tsx
git commit -m "feat(practice): migrate dictation mode onto the session shell"
```

---

## Task 7: Migrate mode Flashcard (tự đánh giá)

Mode này khác ba mode trên: người học tự bấm 1 trong 4 nút FSRS, nên nó gửi `selfRated` và `gradeAnswer` trả thẳng giá trị đó. Nó cũng là mode duy nhất requeue thẻ `Again` trong cùng lượt.

`Flashcard` (`src/components/study/flashcard.tsx`) **không được sửa** — type `Card` của nó đang được `cram-session.tsx` và `topic-viewer.tsx` dùng. Mode mới *adapt* `PracticeItem` sang `Card`.

**Files:**
- Create: `src/components/practice/modes/flashcard.tsx`
- Modify: `src/components/practice/modes/index.ts`
- Modify: `src/app/study/flashcard/page.tsx`

**Interfaces:**
- Consumes: types `ModeViewProps`, `PracticeItem`, `Rating` (`@/lib/practice/types`); `Flashcard` + type `Card` (`@/components/study/flashcard`); `getRatingPreviewsClient` (`@/components/study/preview-client`); type `RatingPreview` (`@/components/study/rating-buttons`); prop `direction` mà `PracticeShell` đã chuyển tiếp từ Task 4
- Produces: `FlashcardMode` từ `@/components/practice/modes/flashcard`; entry `flashcard` trong `MODE_VIEWS`

- [ ] **Step 1: Viết mode Flashcard**

Tạo `src/components/practice/modes/flashcard.tsx`:

```tsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Flashcard, type Card } from "@/components/study/flashcard";
import { getRatingPreviewsClient } from "@/components/study/preview-client";
import type { RatingPreview } from "@/components/study/rating-buttons";
import type { ModeViewProps, PracticeItem, Rating } from "@/lib/practice/types";

// The Flashcard component predates PracticeItem and is shared with cram-session
// and topic-viewer, so its `Card` shape is left alone and adapted here. The only
// real difference: Card names the word id `id`, PracticeItem names it `wordId`.
function toCard(item: PracticeItem): Card {
  return {
    cardId: item.cardId,
    id: item.wordId,
    word: item.word,
    cefr: item.cefr,
    typeEn: item.typeEn,
    typeVi: item.typeVi,
    ipaUk: item.ipaUk,
    ipaUs: item.ipaUs,
    definitionEn: item.definitionEn,
    definitionVi: item.definitionVi,
    extraDefs: item.extraDefs,
    example: item.example,
    exampleVi: item.exampleVi,
    synonyms: item.synonyms,
    antonyms: item.antonyms,
    imageUrl: item.imageUrl,
    audioUk: item.audioUk,
    audioUs: item.audioUs,
    starred: item.starred,
  };
}

export function FlashcardMode({ item, reveal, onAnswer, direction = "forward" }: ModeViewProps) {
  const [flipped, setFlipped] = useState(false);
  const [previews, setPreviews] = useState<RatingPreview[]>([]);
  const startedAtRef = useRef(Date.now());
  const card = useMemo(() => toCard(item), [item]);

  useEffect(() => {
    setFlipped(false);
    startedAtRef.current = Date.now();
    setPreviews(getRatingPreviewsClient(item));
  }, [item]);

  // Declared with useCallback BEFORE the keydown effect that calls it — a plain
  // `const rate` declared after the effect works at runtime but reads as a
  // use-before-define and trips lint rules.
  const rate = useCallback(
    (rating: Rating) => {
      if (reveal !== "hidden") return;
      onAnswer({
        correct: rating >= 3,
        signals: {
          correct: rating >= 3,
          elapsedMs: Date.now() - startedAtRef.current,
          wordLength: item.word.length,
          cardState: item.state,
          wasHidden: false,
          selfRated: rating,
        },
      });
    },
    [reveal, onAnswer, item.word.length, item.state]
  );

  // Space/Enter flips; 1–4 rate. The shell's global advance listener only runs
  // while an answer is revealed, so it cannot swallow these.
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (reveal !== "hidden") return;
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        setFlipped((f) => !f);
        return;
      }
      if (!flipped) return;
      if (["1", "2", "3", "4"].includes(e.key)) rate(Number(e.key) as Rating);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [flipped, reveal, rate]);

  return (
    <div className="w-full max-w-4xl mx-auto">
      <Flashcard
        card={card}
        direction={direction}
        flipped={flipped}
        onFlip={() => setFlipped((f) => !f)}
        previews={previews}
        onRate={(r) => rate(r as Rating)}
        ratingDisabled={reveal !== "hidden"}
      />
    </div>
  );
}
```

- [ ] **Step 2: Đăng ký mode**

`PracticeShell` đã nhận và chuyển tiếp `direction` từ Task 4 — **không cần sửa shell ở task này.**

Thay `src/components/practice/modes/index.ts` bằng:

```ts
import type { ModeView, PracticeMode } from "@/lib/practice/types";
import { QuizMode } from "./quiz";
import { TypingMode } from "./typing";
import { DictationMode } from "./dictation";
import { FlashcardMode } from "./flashcard";

// Cloze and image-word arrive in Plan 3; until then this stays Partial.
export const MODE_VIEWS: Partial<Record<PracticeMode, ModeView>> = {
  quiz: QuizMode,
  typing: TypingMode,
  dictation: DictationMode,
  flashcard: FlashcardMode,
};
```

- [ ] **Step 3: Nối trang Flashcard vào shell**

Thay **toàn bộ** `src/app/study/flashcard/page.tsx` bằng:

```tsx
import { redirect } from "next/navigation";
import { buildSessionPlan, parseSize } from "@/lib/practice/session-plan";
import { PracticeShell } from "@/components/practice/practice-shell";
import { EmptyStudy } from "@/components/study/empty-study";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function FlashcardPage({
  searchParams,
}: {
  searchParams: { cefr?: string; topic?: string; dir?: string; size?: string; scope?: string };
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const plan = await buildSessionPlan(user.id, {
    mode: "flashcard",
    cefr: searchParams.cefr,
    topic: searchParams.topic,
    size: parseSize(searchParams.size),
    scope: searchParams.scope === "starred" ? "starred" : undefined,
  });
  if (plan.items.length === 0) return <EmptyStudy />;

  const dir = (searchParams.dir as "forward" | "reverse" | "cloze") || "forward";
  return (
    <PracticeShell
      items={plan.items}
      mode="flashcard"
      remaining={plan.remaining}
      direction={dir}
    />
  );
}
```

`starred` đi kèm mỗi `PracticeItem` nên nút star trên thẻ vẫn đúng trạng thái — `buildSessionPlan` đã batch-fetch `WordMark`, thay cho query mà trang này tự làm trước đây.

- [ ] **Step 4: Type-check và chạy thử**

Run: `npx tsc --noEmit && npm test`
Expected: sạch.

Run: `npm run dev`, mở `http://localhost:3000/study/flashcard`

Kiểm:
1. Header `1 / 15`
2. Chạm thẻ (hoặc Space) lật; 4 nút Lại/Khó/Tốt/Dễ hiện khoảng ôn dự kiến
3. Bấm `1` (Lại) → thẻ được **đưa lại cuối lượt**, và tổng số thẻ trong header tăng
4. Nút star trên thẻ hiện đúng trạng thái đã lưu
5. `?dir=reverse` → mặt trước hiện nghĩa; `?dir=cloze` → hiện câu điền khuyết
6. `?scope=starred` → chỉ thẻ đã star
7. Tổng kết hiện phân bổ 4 mức đúng số lần bạn bấm
8. `StudySession` có row `mode = "flashcard"`

- [ ] **Step 5: Commit**

```bash
git add src/components/practice src/app/study/flashcard/page.tsx
git commit -m "feat(practice): migrate flashcard mode onto the session shell"
```

---

## Task 8: Xoá code chết

Bốn mode đã chạy trên shell, hai component cũ và cầu serialize không còn ai dùng. Xoá ngay để không tồn tại hai hệ thống phiên song song — chính điều đã sinh ra D1.

**Files:**
- Delete: `src/components/study/practice-session.tsx`
- Delete: `src/components/study/study-session.tsx`
- Delete: `src/app/study/_lib/serialize.ts`
- Modify: `src/lib/study-engine.ts` (xoá `getQuizDistractors`)

**Interfaces:**
- Consumes: không gì mới
- Produces: không gì mới (chỉ xoá)

- [ ] **Step 1: Xác nhận không còn ai import**

```bash
grep -rn "practice-session\|study-session\|serializePractice\|PracticeCard\|getQuizDistractors" src/
```

Expected: chỉ còn các dòng **bên trong** ba file sắp xoá, cộng đúng một dòng định nghĩa `getQuizDistractors` trong `study-engine.ts`. Nếu có kết quả nào khác — dừng lại, migrate chỗ đó trước.

- [ ] **Step 2: Xoá ba file**

```bash
git rm src/components/study/practice-session.tsx src/components/study/study-session.tsx src/app/study/_lib/serialize.ts
```

- [ ] **Step 3: Xoá `getQuizDistractors`**

Trong `src/lib/study-engine.ts`, xoá khối này (comment header `// ---------- Quiz distractor generation ----------` cùng cả hàm). Đây là defect **D2**: `api/study/quiz-options/route.ts` tự viết lại logic distractor và chưa bao giờ gọi hàm này.

```ts
// ---------- Quiz distractor generation ----------
export async function getQuizDistractors(correct: StudyWord, n = 3): Promise<string[]> {
  const pool = await prisma.word.findMany({
    where: { cefr: correct.cefr, word: { not: correct.word } },
    select: { definitionEn: true, word: true },
    take: 60,
  });
  const valid = pool.filter((p) => p.definitionEn && p.definitionEn.length > 8);
  return pick(valid, n).map((p) => truncateDef(p.definitionEn!));
}
```

**Giữ** `truncateDef` ngay dưới nó — `quiz-options/route.ts` và `buildMatchingPool` đều dùng.

- [ ] **Step 4: Kiểm import mồ côi**

```bash
npx tsc --noEmit
```

Expected: sạch. Nếu báo `pick` khai báo mà không dùng trong `study-engine.ts`, kiểm xem còn chỗ nào dùng `pick` không (`buildMatchingPool` không dùng); nếu không còn thì bỏ `pick` khỏi dòng import `from "./utils"`.

- [ ] **Step 5: Chạy full test + build**

```bash
npm test && npx tsc --noEmit && npm run build
```
Expected: cả ba sạch. `npm run build` cần `DATABASE_URL` trong `.env` (build không gọi DB nhưng Prisma đòi có chuỗi kết nối).

- [ ] **Step 6: Chạy thử lần cuối cả 4 mode**

Run: `npm run dev`, mở lần lượt và hoàn thành trọn một phiên mỗi mode:
- `http://localhost:3000/study/quiz`
- `http://localhost:3000/study/typing`
- `http://localhost:3000/study/dictation`
- `http://localhost:3000/study/flashcard`

Rồi mở `npx prisma studio` → `StudySession`, xác nhận có **4 row mới**, mỗi mode một row, `cardsReviewed` khớp số thẻ bạn đã làm. Đây là bằng chứng cuối cùng cho việc D1 đã được sửa cho cả bốn mode.

Cũng mở `/stats` và xác nhận phiên vừa rồi xuất hiện trong số liệu.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor(practice): remove the superseded session components and dead distractor helper"
```

---

## Bàn giao cho plan sau

Ba điểm cần quyết ở Plan 2, ghi ra để không rơi:

1. **Luật "trả lời chậm → Hard" đang thiếu trong spec §6.** Lúc bàn thiết kế có nói "trắc nghiệm > 8s → Hard", nhưng danh sách luật cơ sở cuối cùng trong spec chỉ có `hintUsed | typoAccepted | replays >= 3 | slowedDown | changedAnswer`. Vì thế `QuizMode` hiện gửi `changedAnswer: false` cố định và không có tín hiệu nào khiến trắc nghiệm ra `Hard`. Plan 2 phải chọn: thêm luật chậm→Hard, hoặc bỏ `changedAnswer` khỏi `GradeSignals`.
2. **Chip "quá dễ / may bấm đúng" phải gọi `stopPropagation`.** Shell nghe `pointerdown` ở cấp `window` để chạm-là-đi-tiếp (D4); nếu chip không chặn nổi bọt sự kiện thì chạm vào chip sẽ vừa sửa rating vừa đi tiếp ngay.
3. **`MODE_VIEWS` vẫn là `Partial<Record<...>>`.** Khi Plan 3 thêm `cloze` và `image-word`, đổi thành `Record` đầy đủ và bỏ nhánh guard `!View` trong shell.

Ngoài ra: `PracticeItem` đã mang `extraDefs`, `imageUrl`, `antonyms` dù bốn mode hiện tại chưa dùng — Plan 3 (distractor thông minh, Ảnh→từ) cần chúng, nên đừng dọn đi.

---

## Self-review

**Spec coverage (Phase 0–2 của §14):**

| Yêu cầu spec | Task |
|---|---|
| §14 Phase 0 — vitest + `npm test` trong CI | Task 1 |
| §4 — `types.ts`, hợp đồng shell↔mode | Task 1 |
| §4 — `session-state.ts` thuần, test được | Task 1 |
| §6 — giao diện `gradeAnswer`, bất biến số Rating | Task 2 |
| §5 — `buildSessionPlan`, cạm bẫy tạo `Card` rác, `remaining` | Task 3 |
| §5 — nguồn `size` từ query param, mặc định 15 | Task 3 (`parseSize`) |
| §14 Phase 1 — shell + migrate Trắc nghiệm | Task 4 |
| §9 — sửa D1 (`StudySession` cho mọi mode) | Task 4, verify lại ở Task 8 |
| §10 — xoá khoá 1.100ms (D4) | Task 4 (`REVEAL_MS` + listener advance) |
| §11 — `quiz-options` lỗi → bỏ qua, thử lại cuối, rồi loại (D6) | Task 4 (`onSkip` + `skipCountRef`) |
| §11 — POST review lỗi → thử lại 1 lần → báo "N thẻ chưa lưu" | Task 4 (`postReview`, `unsaved`) |
| §11 — plan nhỏ hơn size → chạy với số thực có | Task 4 (header hiện `queue.length` thật) |
| §11 — tab bị ẩn → `wasHidden` | Task 4 (`hiddenRef`) |
| §6 — đồng hồ bắt đầu khi item thao tác được | Task 4 (`readyAtRef` trong quiz) |
| §9 — nút "Học tiếp N thẻ", dừng là mặc định | Task 4 (`SessionSummary`) |
| §14 Phase 2 — migrate Gõ / Nghe-viết / Flashcard | Task 5, 6, 7 |
| §2 D2 — xoá `getQuizDistractors` chết | Task 8 |

**Cố ý hoãn sang plan sau** (không phải thiếu sót): chấm 4 mức (§6 hai tầng) → Plan 2 · chip sửa (§6) → Plan 2 · danh sách từ sai + drill non-SRS (§9) → Plan 2 · resume localStorage (§9) → Plan 2 · combo UI + animation + haptic (§10) → Plan 4 · distractor thông minh (§8.1) → Plan 3 · Cloze + Ảnh→từ (§8.2, §8.3) → Plan 3 · hub + `Settings.sessionSize` + D3 (§7) → Plan 4 · Phát âm vào shell → Plan 5.

**Type consistency:** `PracticeItem.wordId` (không phải `id`) dùng thống nhất ở mọi mode; adapter duy nhất là `toCard` trong Task 7, chỗ `Card.id` của component cũ được nạp từ `item.wordId`. `RATING` (từ `types.ts`) dùng ở mọi nơi; `Rating` của `ts-fsrs` chỉ xuất hiện trong `grading.test.ts` để khoá bất biến. `ModeViewProps` khớp đúng giữa `types.ts`, cả bốn mode, và chỗ shell render `View`. `sessionSummary` trả `SessionSummaryData` — chính là type mà `SessionSummary` nhận qua prop `data`.

**Ghi chú kiểm tra:** plan này không có test tự động cho component (spec §12 cố ý loại), nên mỗi task migrate đều có bước chạy thật với danh sách kiểm cụ thể, và Task 8 kiểm chứng D1 bằng cách đọc thẳng bảng `StudySession`.
