# Practice Session Tuning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give backlog days a new-card floor (⌊size/3⌋) so every session still teaches some new words, and cut flashcard's post-rating pause from 1200ms to 180ms so it no longer reads as a lock.

**Architecture:** Two independent changes on the `practice-session-foundation` branch. Task 1 rewrites the body of the pure function `deriveSessionLimits` to reserve a new-card floor and reorders `buildSessionPlan` to fetch new cards first (so a floor never shrinks a session when no new words exist). Task 2 turns the single `REVEAL_MS` constant into a per-mode map. Both are TDD where tests exist; the shell change is verified by running the app.

**Tech Stack:** Next.js 14.2 (App Router), React 18, TypeScript 5.7, vitest 2.1, Prisma 5, ts-fsrs 4. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-08-13-practice-session-tuning-design.md`

## Global Constraints

- **Branch:** `practice-session-foundation`, applied on top of `6c96f69`. Do NOT branch off — continue on this branch.
- **TDD discipline:** For Task 1, write/modify the failing test first, run it, confirm it fails for the right reason, then implement. Run the full suite before every commit.
- **No schema changes.** No `db:push`, no new `Settings` field, no migration. The floor is a module constant, not a parameter.
- **`PracticeMode` keys are exhaustive:** `"quiz" | "typing" | "dictation" | "flashcard" | "cloze" | "image-word"` (defined `src/lib/practice/types.ts:3`). A `Record<PracticeMode, number>` MUST list all six or TypeScript errors — `cloze` and `image-word` are filled in even though no mode component exists for them yet.
- **Invariant D5 (do not create orphan `Card` rows):** `fetchNewCards` creates `Card` stubs. The reordered `buildSessionPlan` must never pass it a `newLimit` larger than the number of cards that will actually be shown. Task 1's test #5 exists to lock this.
- **Don't touch `RatingButtons`.** `disabled:opacity-50` stays. At 180ms the grey is ~3 frames and invisible; the `disabled` attribute still blocks a second tap. Changing it to `aria-disabled` would ripple into `cram-session.tsx`, `topic-viewer.tsx`, and `study/flashcard.tsx` for no user-visible gain.
- **Run all commands from the worktree root** (`/Users/abc/Desktop/vocab-master/.claude/worktrees/practice-session-foundation`). This is a git worktree — do not `cd` to the main checkout.
- **Commit message style:** lowercase conventional prefixes (`feat(practice):`, `fix(practice):`, `test(practice):`), matching the existing history on this branch.
- **Language:** comments and copy in English; this branch's existing comments are English. The spec is Vietnamese but the code is not.

---

## Phạm vi plan này, và vì sao

Hai việc, hai task, theo thứ tự:

- **Task 1 — new-card floor (việc 1).** Đổi `deriveSessionLimits` + `buildSessionPlan`. Đây là phần có test tự động và là phần có một cạm bẫy thật (hạn mức ≠ số từ mới thật có). Làm trước để TDD cycle khớp với Plan 1.
- **Task 2 — per-mode `REVEAL_MS` (việc 2).** Đổi một hằng số thành map trong `practice-shell.tsx`. Không có test tự động (spec §12 loại), nghiệm bằng chạy thật. Làm sau vì nó nhỏ và độc lập hoàn toàn.

Cố ý **không** gộp hai việc vào một commit: chúng giải hai vấn đề khác nhau, và nếu Task 2 cần quay lại thì Task 1 đã an toàn trong lịch sử riêng của nó.

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `src/lib/practice/session-limits.ts` | Modify | Pure arithmetic: split a session size into review/new limits with a new-card floor. No I/O. |
| `src/lib/practice/session-limits.test.ts` | Modify | Lock the arithmetic of `deriveSessionLimits` across backlog, floor, and edge cases. |
| `src/lib/practice/session-plan.ts` | Modify | Orchestrate: count → derive budget → fetch new first → re-derive with real count → fetch due → join. The only place that calls `fetchNewCards`/`fetchDueCards`. |
| `src/components/practice/practice-shell.tsx` | Modify | Turn `REVEAL_MS` from a number into a `Record<PracticeMode, number>`. |

No new files. `session-limits.ts` stays a pure leaf with no imports beyond vitest types in its test; `session-plan.ts` is the only consumer of the DB primitives.

---

## Task 1: New-card floor in `deriveSessionLimits` + reorder `buildSessionPlan`

**Files:**
- Modify: `src/lib/practice/session-limits.ts` (whole body, 29 lines)
- Modify: `src/lib/practice/session-limits.test.ts` (1 expectation change + 3 new cases)
- Modify: `src/lib/practice/session-plan.ts:88-125` (the body of `buildSessionPlan`)

**Interfaces:**
- Consumes: `deriveSessionLimits` is called by `buildSessionPlan` only. Its signature is UNCHANGED:
  ```ts
  function deriveSessionLimits(input: {
    size: number | "all";
    dueAvailable: number;
    newAllowanceToday: number;
    dailyReviewLimit: number;
  }): { reviewLimit: number; newLimit: number }
  ```
- Produces: same return type, same function name. `buildSessionPlan`'s exported signature and return type (`SessionPlan`) are unchanged — callers (the four mode pages) need no edits.
- `fetchNewCards` and `fetchDueCards` signatures are unchanged (read from `src/lib/study-engine.ts:104,157`).

### The new arithmetic

Current body (`session-limits.ts:20-28`):
```ts
if (input.size === "all") {
  return { reviewLimit: dailyReview, newLimit: newAllowance };
}
const size = Math.max(0, Math.floor(input.size));
const due = Math.max(0, Math.floor(input.dueAvailable));
const reviewLimit = Math.min(size, due, dailyReview);
const newLimit = Math.max(0, Math.min(size - reviewLimit, newAllowance));
return { reviewLimit, newLimit };
```

New body — reserve a floor of ⌊size/3⌋ for new cards BEFORE computing reviewLimit:
```ts
if (input.size === "all") {
  return { reviewLimit: dailyReview, newLimit: newAllowance };
}
const size = Math.max(0, Math.floor(input.size));
const due = Math.max(0, Math.floor(input.dueAvailable));
// Reserve up to a third of the session for new cards, but never more than the
// day's remaining new allowance. This is a FLOOR on new, not a cap on review:
// if new cards run short, reviewLimit grows to fill the session (see the
// second deriveSessionLimits call in buildSessionPlan, which re-derives with
// the REAL count of new cards that exist).
const newFloor = Math.min(Math.floor(size / 3), newAllowance);
const reviewLimit = Math.min(size - newFloor, due, dailyReview);
const newLimit = Math.max(0, Math.min(size - reviewLimit, newAllowance));
return { reviewLimit, newLimit };
```

Why this is correct on the three boundary shapes:
- **Backlog day (due ≥ size):** `newFloor = ⌊size/3⌋`, `reviewLimit = size − newFloor` (the `due` and `dailyReview` terms don't bind), `newLimit = newFloor`. → 15/45/20/200 gives review 10, new 5.
- **Few due (due < size − newFloor):** `reviewLimit = due`, then `newLimit = min(size − due, newAllowance)`. The floor didn't constrain — new tops up as before. → 15/3/20/200 gives review 3, new 12 (unchanged).
- **No new allowance:** `newFloor = 0`, collapses to the old formula. → review fills the session.

### The `buildSessionPlan` reorder

Current (`session-plan.ts:89-106`): counts due, derives limits, fetches due, fetches new.

New: counts due, derives a BUDGET, **fetches new first**, re-derives with the real new count, fetches due, joins due-first. The re-derive is what prevents a session shrinking when no new words exist.

- [ ] **Step 1: Update the failing test in `session-limits.test.ts`**

Replace the FIRST test case (currently asserts the old due-first behaviour). Open `src/lib/practice/session-limits.test.ts`. The first `it(...)` block is:

```ts
  it("fills the whole session from due cards when there are enough", () => {
    expect(
      deriveSessionLimits({ size: 15, dueAvailable: 45, newAllowanceToday: 20, dailyReviewLimit: 200 })
    ).toEqual({ reviewLimit: 15, newLimit: 0 });
  });
```

Replace it with:

```ts
  it("reserves a new-card floor even when due cards could fill the session", () => {
    // Backlog day: 45 due, but a 15-card session still teaches 5 new words.
    // ⌊15/3⌋ = 5 floor, capped by the 20-card daily allowance.
    expect(
      deriveSessionLimits({ size: 15, dueAvailable: 45, newAllowanceToday: 20, dailyReviewLimit: 200 })
    ).toEqual({ reviewLimit: 10, newLimit: 5 });
  });
```

Then APPEND these three new cases at the end of the `describe` block, before the closing `});`:

```ts
  it("clamps the new floor to the remaining daily new allowance", () => {
    // Only 2 new cards left for the day: floor is 2, not 5. Due takes 13.
    expect(
      deriveSessionLimits({ size: 15, dueAvailable: 45, newAllowanceToday: 2, dailyReviewLimit: 200 })
    ).toEqual({ reviewLimit: 13, newLimit: 2 });
  });

  it("collapses to review-only when no new cards are available", () => {
    // The second deriveSessionLimits call in buildSessionPlan hits this shape:
    // newAllowance is the REAL count of new cards fetched (0), so the floor
    // vanishes and due fills the whole session — the session must NOT shrink.
    expect(
      deriveSessionLimits({ size: 15, dueAvailable: 45, newAllowanceToday: 0, dailyReviewLimit: 200 })
    ).toEqual({ reviewLimit: 15, newLimit: 0 });
  });

  it("yields no new cards for sessions smaller than 3", () => {
    // ⌊2/3⌋ = 0: a 1–2 card session is too short to reserve new-card space.
    expect(
      deriveSessionLimits({ size: 2, dueAvailable: 45, newAllowanceToday: 20, dailyReviewLimit: 200 })
    ).toEqual({ reviewLimit: 2, newLimit: 0 });
  });
```

Leave the other six existing cases untouched — they must still pass unchanged:
- "tops up with new cards when due cards run short" (15/3/20 → 3/12) ✓ still correct
- "never exceeds the remaining daily new allowance" (15/3/5 → 3/5) ✓ still correct
- "respects the daily review limit and still tops up with new" (15/45/20/10 → 10/5) ✓ still correct
- `size "all"` ✓ unchanged branch
- "returns zeros when nothing is available" (15/0/0 → 0/0) ✓ still correct
- "clamps negative and fractional inputs" (10.7/−5/−3 → 0/0) ✓ still correct

- [ ] **Step 2: Run the test suite, confirm the first case FAILS**

Run: `npx vitest run src/lib/practice/session-limits.test.ts`
Expected: FAIL. The first case now expects `{ reviewLimit: 10, newLimit: 5 }` but the current code returns `{ reviewLimit: 15, newLimit: 0 }`. The three new cases also fail (the code doesn't reserve a floor yet). The six untouched cases still PASS.

- [ ] **Step 3: Rewrite the body of `deriveSessionLimits`**

Open `src/lib/practice/session-limits.ts`. Replace lines 20–29 (the non-`"all"` branch) with the "new arithmetic" block shown in the Task intro above. Keep the leading `newAllowance`/`dailyReview` clamps (lines 17–18) and the `"all"` branch (lines 20–22) exactly as they are. Update the JSDoc above the function (lines 1–10) — change "Due cards come first" to describe the floor:

```ts
/**
 * Split a requested session size into a due-card limit and a new-card limit.
 *
 * Due cards are prioritized for recall, but a FLOOR of ⌊size/3⌋ slots is
 * reserved for new cards (capped by the day's remaining new allowance) so a
 * backlog day still teaches some new words. If fewer new cards exist than the
 * floor, review fills the gap — see the second call in buildSessionPlan, which
 * re-derives with the real count of new cards fetched.
 *
 * `newAllowanceToday` must already be NET of cards studied today. Callers must
 * not pass the raw `newCardsPerDay` setting.
 */
```

- [ ] **Step 4: Run the test suite, confirm ALL pass**

Run: `npx vitest run src/lib/practice/session-limits.test.ts`
Expected: PASS — all 10 cases (1 changed + 3 new + 6 untouched).

- [ ] **Step 5: Reorder `buildSessionPlan` to fetch new first**

Open `src/lib/practice/session-plan.ts`. The current body of `buildSessionPlan` (lines 89–106) is:

```ts
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
```

Replace lines 97–106 (from `const limits =` through `const queue =`) with:

```ts
  // Two-pass derive: the floor can promise new slots that no new cards exist
  // to fill (user has learned every word in the filter scope). Fetch new
  // FIRST with the budget, then re-derive with the REAL count so review fills
  // any slots the new cards couldn't — a floor must never shrink a session.
  const budget = deriveSessionLimits({
    size: opts.size,
    dueAvailable,
    newAllowanceToday,
    dailyReviewLimit: settings.reviewsPerDay,
  });
  const newCards = await fetchNewCards(userId, where, wordFilter, starredIds, budget.newLimit);
  const actual = deriveSessionLimits({
    size: opts.size,
    dueAvailable,
    newAllowanceToday: newCards.length,
    dailyReviewLimit: settings.reviewsPerDay,
  });
  const dueCards = await fetchDueCards(where, actual.reviewLimit);
  // Display order is due-first: the join order decides what the user sees,
  // not the fetch order. (`size: "all"` is safe here — its branch ignores
  // newAllowanceToday when computing reviewLimit, so the second call returns
  // the same limits as the first; no special-case needed.)
  const queue = [...dueCards, ...newCards];
```

Leave the `remaining` computation (lines 119–122) exactly as-is — it already uses `dueCards.length` and `newCards.length`, which are now the real counts:
```ts
  return {
    items: queue.map((c) => toPracticeItem(c, starred.has(c.id))),
    remaining: {
      due: Math.max(0, dueAvailable - dueCards.length),
      new: Math.max(0, newAllowanceToday - newCards.length),
    },
    sizeUsed: queue.length,
  };
```

- [ ] **Step 6: Run the full test suite + type-check**

Run: `npx vitest run && npx tsc --noEmit`
Expected: ALL tests pass (session-limits, grading, session-state). `tsc` reports no errors. No new imports were added; `fetchNewCards`/`fetchDueCards`/`deriveSessionLimits` are already imported at the top of `session-plan.ts`.

- [ ] **Step 7: Verify invariant D5 holds by reasoning, then commit**

Re-confirm the D5 argument from the spec (§2.3): `fetchNewCards` is called with `budget.newLimit ≤ ⌊size/3⌋`, so `newCards.length ≤ ⌊size/3⌋`. In the second `deriveSessionLimits` call, `newFloor = min(⌊size/3⌋, newCards.length) = newCards.length`, hence `reviewLimit ≤ size − newCards.length`, hence `newLimit = newCards.length`. Every fetched new card is shown — no orphans. (No automated test for this; it's a property of the arithmetic, locked by the test in Step 1's "collapses to review-only" case.)

Commit:
```bash
git add src/lib/practice/session-limits.ts src/lib/practice/session-limits.test.ts src/lib/practice/session-plan.ts
git commit -m "$(cat <<'EOF'
feat(practice): reserve a new-card floor for backlog days

deriveSessionLimits now reserves ⌊size/3⌋ slots for new cards (capped by
the day's remaining allowance) before filling from due, so a 45-card
backlog over a 15-card session still teaches 5 new words instead of zero.

buildSessionPlan fetches new cards first, then re-derives limits with the
real count of new cards that exist. This prevents a regression where the
floor promises new slots no cards can fill (user has learned every word in
the filter scope): review grows back to fill the session. Invariant D5
holds — fetchNewCards is never asked for more than ⌊size/3⌋ cards, and
every fetched card is shown.

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Per-mode `REVEAL_MS` in `PracticeShell`

**Files:**
- Modify: `src/components/practice/practice-shell.tsx:14-16` (the `REVEAL_MS` constant) and `practice-shell.tsx:214` (the `setTimeout` call)

**Interfaces:**
- Consumes: `PracticeMode` type from `src/lib/practice/types.ts:3`. `mode` is already a prop of `PracticeShell` and already in `onAnswer`'s dependency array (`practice-shell.tsx:216`).
- Produces: no exported change. The shell's behaviour changes only in timing.

- [ ] **Step 1: Replace the `REVEAL_MS` constant with a per-mode map**

Open `src/components/practice/practice-shell.tsx`. Lines 14–16 are:

```ts
// How long the answer stays revealed before auto-advancing. This is a LAZY PATH,
// not a lock: any pointer or key input advances immediately (defect D4).
const REVEAL_MS = 1200;
```

Replace with:

```ts
// How long the answer stays revealed before auto-advancing, per mode. This is a
// LAZY PATH, not a lock: any pointer or key input advances immediately (D4).
// Flashcard is short (180ms): the card is already flipped and there is nothing
// new to read, so a long pause just reads as a frozen UI. The auto-graded modes
// keep 1200ms so the correct answer + FeedbackStrip stay readable.
const REVEAL_MS: Record<PracticeMode, number> = {
  flashcard: 180,
  quiz: 1200,
  typing: 1200,
  dictation: 1200,
  // Not yet implemented (Plan 3); filled so the Record is exhaustive.
  cloze: 1200,
  "image-word": 1200,
};
```

- [ ] **Step 2: Use the map at the `setTimeout` call site**

In the same file, line 214 (inside `onAnswer`) is:

```ts
      advanceTimer.current = setTimeout(advance, REVEAL_MS);
```

Replace with:

```ts
      advanceTimer.current = setTimeout(advance, REVEAL_MS[mode]);
```

`mode` is already in the `onAnswer` dependency array (`[current, mode, advance]` at line 216), so no dependency change is needed. `PracticeMode` is already imported at line 10 (`import type { GradeSignals, PracticeItem, PracticeMode } from "@/lib/practice/types";`).

- [ ] **Step 3: Update the stale "~1.2s" comment in the unmount effect**

In the same file, around line 305–306, inside the unmount cleanup effect, the comment says:

```ts
      // left running it fires ~1.2s after unmount for no reason.
```

Replace with:

```ts
      // left running it fires up to ~1.2s after unmount for no reason.
```

(Flashcard is 180ms, the auto-graded modes 1200ms; "~1.2s" was only ever the upper bound.)

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors. `Record<PracticeMode, number>` is exhaustive over all six mode keys; `REVEAL_MS[mode]` is `number`, matching `setTimeout`'s second argument.

- [ ] **Step 5: Verify by running the app**

Run: `npm run dev`

Open `http://localhost:3000/study/flashcard`. For each of these, watch the timing after you act:

1. **Flashcard (the fix):** flip the card (Space), press 1–4 (Again/Hard/Good/Easy). The next card should appear within ~0.2s. The four rating buttons should NOT visibly grey out — at 180ms the `disabled:opacity-50` transition is ~3 frames.
2. **Quiz (unchanged):** `/study/quiz` — answer a question. The correct answer + feedback strip should remain visible for ~1.2s before advancing. Tapping anywhere advances immediately.
3. **Typing (unchanged):** `/study/typing` — submit an answer. Same ~1.2s readable reveal.
4. **Dictation (unchanged):** `/study/dictation` — same ~1.2s.

If flashcard still feels laggy, confirm `REVEAL_MS[mode]` is actually `180` by adding a temporary `console.log(REVEAL_MS[mode])` in `onAnswer` — remove it before committing.

- [ ] **Step 6: Commit**

```bash
git add src/components/practice/practice-shell.tsx
git commit -m "$(cat <<'EOF'
fix(practice): cut flashcard's post-rating pause to 180ms

REVEAL_MS was a single 1200ms constant shared by all modes. On flashcard
that window is empty — the card is already flipped, there is no answer to
read — so a full second of frozen, greyed-out buttons read as the exact
1100ms lock this branch set out to remove.

Turn REVEAL_MS into a per-mode map: flashcard drops to 180ms (matching the
old study-session.tsx timing before the shell migration), the auto-graded
modes keep 1200ms so the correct answer stays readable.

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

## Sau khi hai task xong

1. Đẩy nhánh: `git push origin practice-session-foundation`.
2. Mở PR vào `main`, body ghi tóm tắt hai việc + link spec `docs/superpowers/specs/2026-08-13-practice-session-tuning-design.md`.
3. CI phải pass (build + type-check + vitest). Vercel preview sinh ra — dùng để nghiệm Task 2 trên device thật nếu có.
4. KHÔNG tự merge — chờ user review PR.

Khi PR gói A merge, bắt đầu brainstorm gói B (âm thanh + UI/UX mobile + PWA install prompt) trên một nhánh mới tách từ `main`.
