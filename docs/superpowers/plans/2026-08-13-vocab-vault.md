# Kho từ đã học (gói B) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Người học lọc được kho từ của mình ngay trong `/browse` theo sáu phạm vi, thấy tiến độ tổng hợp, thao tác hàng loạt, và đi thẳng từ bộ lọc sang một phiên học hoặc một file export.

**Architecture:** Không thêm trang, không thêm tab nav. `/browse` nhận thêm `scope` + `topic`; toàn bộ ngữ nghĩa phạm vi sống trong một module **thuần** `src/lib/vault/scope.ts` mà `/browse`, study và export cùng dùng — thay cho ba từ vựng phạm vi rời rạc đang có. Mọi thứ cần test đều là hàm thuần; module chạm Prisma chỉ còn là lớp mỏng.

**Tech Stack:** Next.js 14 App Router (server components), Prisma 5 + Postgres (Neon), vitest 2 (`environment: node`, include `src/**/*.test.{ts,tsx}`), Tailwind, `lucide-react`, i18n tự viết (`src/lib/i18n/dictionaries.ts`).

**Spec:** `docs/superpowers/specs/2026-08-13-vocab-vault-and-reminders-design.md` (§2 là gói B; §7 là các giả định của tác giả spec)

## Global Constraints

- **Test không được chạm Prisma.** 19/19 file test hiện tại đều thuần. `import "server-only"` **không resolve được dưới vitest** — file test import (dù gián tiếp) một module `server-only` sẽ đổ. `server-only` hiện có ở: `export.ts`, `gamification.ts`, `leaderboard/pace-server.ts`, `notebook.ts`, `practice/session-plan.ts`, `session.ts`, `stats.ts`, `study-engine.ts`, `topics-data.ts`.
- **`tsc --noEmit` + `next build` KHÔNG đủ để tuyên bố xong.** Gói A có ba lỗi thật lọt qua cả hai. Task nào có UI/route thì phải drive app thật.
- **Khóa i18n mới phải vào CẢ HAI nhánh `vi` và `en`** của `src/lib/i18n/dictionaries.ts`. Thiếu nhánh nào là UI hiện raw key.
- **`text-soft` là class `@layer components`, KHÔNG phải colour key** → `text-soft/70` compile ra **rỗng**. Dùng `text-soft opacity-70`. Repo đã trả giá hai lần cho bẫy này.
- **`divide-*` set `border-color` shorthand ở specificity (0,3,0)** nên thắng `border-<màu>` (0,1,0) — cần viền màu trong list có divide thì phải `!border-…`.
- **Không xoá `ReviewLog`, không xoá `Card`.** `UserProgress.xp`/`DailyStat.xp` là ReviewLog-derived và `db:backfill-xp --force` dựng lại từ log.
- **`learning` gồm `state = 0`.** Khi đối chiếu `/stats`: `learning` của kho từ = `learningCards + newCardsSeen`, **không** phải `learningCards`.
- **Bulk tối đa 40 `wordId`** (bằng `perPage` của `/browse`).
- **Nút "ôn"/"xuất" mang bộ lọc, không mang danh sách id.**
- Commit message theo repo: tiếng Anh, dạng `<type>(<vùng>): …` trong đó `<vùng>` là tên vùng code chứ không phải chữ "scope" — repo đang dùng `feat(vault)`, `feat(placement)`, `fix(quote)`, `refactor(home)`, `data(images)`. Kèm `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`.
- **Ngôn ngữ comment — quy ước của repo là CHIA HAI, và các snippet dưới đây không phản ánh nó:** comment trong **module production** viết **tiếng Anh** (đã kiểm: `src/lib/selection/score.ts`, `src/lib/placement/ladder.ts` của gói A, và toàn bộ code cũ), còn **file test** viết **tiếng Việt** (đã kiểm: `src/lib/leaderboard/{pace,board,rivals,activity}.test.ts` trên `main` — cả tên test lẫn comment giải thích). Snippet trong plan này viết comment tiếng Việt cho **cả hai** loại file; khi cài đặt, **dịch sang tiếng Anh mọi comment thuộc module production**, giữ tiếng Việt trong file `*.test.ts`. Giữ nguyên *nội dung* lập luận của comment — nhất là các câu giải thích *vì sao* (vì sao module không có `server-only`, vì sao không xoá `ReviewLog`), vì đó mới là phần đáng giá.
- Chạy toàn bộ test bằng `npm test` (vitest run). Chạy một file: `npx vitest run src/lib/vault/scope.test.ts`.
- **Repo KHÔNG có ESLint** dù `package.json` khai báo script `"lint": "next lint"` (không có dependency `eslint`, không có config). Đừng chạy `npm run lint`; để bắt import thừa thì dùng `npx tsc --noUnusedLocals --noUnusedParameters` rồi so trước/sau.

---

### Task 0: Merge gói A vào `main`

Gói B đọc `WordMark.known`, cột đó chỉ được khai báo trong schema trên branch `docs/level-aware-word-selection`. DB live **đã có** cột (đã `prisma db push` hôm A1) nên không cần migration, nhưng Prisma client sinh từ schema `main` không thấy field.

**Files:** không sửa file nào — đây là task git/verify.

**Interfaces:**
- Consumes: —
- Produces: `main` chứa `WordMark.known`, `Word.freqPct`, `Word.freqSource`, `LearnerProfile`, `src/lib/selection/*`, `src/lib/placement/*`, `/onboarding`.

- [ ] **Step 1: Xác nhận branch A là hậu duệ của `main` (merge sẽ là fast-forward)**

```bash
git log --oneline docs/level-aware-word-selection..main
```

Expected: **không in ra gì**. Nếu có commit, `main` đã đi trước → dừng lại, báo người chủ repo; đừng tự `git merge` tạo merge commit.

- [ ] **Step 2: Chạy đủ ba cửa trên branch A**

```bash
git checkout docs/level-aware-word-selection
npm test
npx tsc --noEmit
npm run build
```

Expected: test xanh (gói A ghi nhận 256 test), `tsc` không output, build thành công.

- [ ] **Step 3: Fast-forward `main`**

```bash
git checkout main
git merge --ff-only docs/level-aware-word-selection
git log --oneline -1
```

Expected: `Fast-forward`, và `git log` chỉ đúng commit tip của branch A.

- [ ] **Step 4: Chạy lại test trên `main`**

```bash
npm test
```

Expected: xanh, cùng số test như Step 2.

- [ ] **Step 5: Tạo branch làm việc cho gói B**

```bash
git checkout -b feat/vocab-vault
```

Không commit gì ở task này (merge đã là commit).

> **Push `main` và deploy prod là việc của người chủ repo, KHÔNG tự chạy.** Repo không có git integration nên deploy là `vercel --prod` từ một `git worktree` sạch của commit đích (CLI upload file local, nên tuyệt đối không deploy từ checkout đang có WIP). Nêu ra và chờ họ đồng ý.

---

### Task 1: Gom ba định nghĩa đang bị chép nhiều lần về module thuần

Ba primitive mà các task sau cần, cả ba hiện đang bị chép: "đã học" viết tay ở `stats.ts:44` và viết kiểu khác ở `export.ts:88`; predicate leech nằm trong `leechWhere(userId)` của `study-engine.ts` (**`server-only`** → không test được, không dùng lại được từ module thuần); map band→CEFR chép inline ở bốn chỗ.

**Files:**
- Modify: `src/lib/fsrs.ts` (thêm `LEARNED_STATES` ngay dưới `STATES`)
- Create: `src/lib/leech.ts` (thuần)
- Create: `src/lib/leech.test.ts`
- Modify: `src/lib/study-engine.ts:91-102` (`leechWhere` gọi `leechCardWhere`, re-export `LEECH_THRESHOLD`)
- Modify: `src/lib/stats.ts:44` (dùng `LEARNED_STATES`)
- Modify: `src/lib/export.ts:88` (dùng `LEARNED_STATES`)
- Modify: `src/lib/placement/estimate.ts` (thêm `bandToCefr`)
- Create: `src/lib/placement/band.test.ts`
- Modify: `src/app/onboarding/onboarding-flow.tsx:93,272`, `src/app/page.tsx:84`, `src/app/settings/profile-section.tsx:56` (gọi `bandToCefr`)

**Interfaces:**
- Consumes: `STATES` (`src/lib/fsrs.ts`), `CEFR_LEVELS` (`src/lib/export-format.ts`)
- Produces:
  - `LEARNED_STATES: readonly [number, number]` từ `@/lib/fsrs`
  - `LEECH_THRESHOLD: number`, `leechCardWhere(): { lapses: { gte: number }; state: { gte: number } }` từ `@/lib/leech`
  - `bandToCefr(band: number): string` từ `@/lib/placement/estimate`

- [ ] **Step 1: Viết test cho `leech.ts` và `bandToCefr`**

```ts
// src/lib/leech.test.ts
import { describe, it, expect } from "vitest";
import { LEECH_THRESHOLD, leechCardWhere } from "./leech";

describe("leechCardWhere", () => {
  it("là predicate KHÔNG chứa userId, để module thuần dùng lại được", () => {
    // scope.ts (thuần) cần predicate này bên trong một relation filter trên Word;
    // nếu nó dính userId thì không nhúng được và repo sẽ có định nghĩa leech thứ hai.
    expect(leechCardWhere()).toEqual({
      lapses: { gte: LEECH_THRESHOLD },
      state: { gte: 1 },
    });
    expect("userId" in leechCardWhere()).toBe(false);
  });

  it("ngưỡng vẫn là 4 — đổi số này là đổi ý nghĩa 'từ khó' của cả app", () => {
    expect(LEECH_THRESHOLD).toBe(4);
  });
});
```

```ts
// src/lib/placement/band.test.ts
import { describe, it, expect } from "vitest";
import { bandToCefr } from "./estimate";

describe("bandToCefr", () => {
  it("band nguyên → đúng bậc: 0=A1 … 4=C1", () => {
    expect(bandToCefr(0)).toBe("A1");
    expect(bandToCefr(2)).toBe("B1");
    expect(bandToCefr(4)).toBe("C1");
  });

  it("band lẻ được làm tròn (band là float để trôi nửa bậc)", () => {
    expect(bandToCefr(2.4)).toBe("B1");
    expect(bandToCefr(2.6)).toBe("B2");
  });

  it("kẹp hai đầu, không bao giờ trả undefined", () => {
    // Bốn chỗ chép inline đều tự kẹp bằng Math.min/Math.max; gom lại một chỗ
    // để không có chỗ thứ năm quên kẹp rồi render "undefined".
    expect(bandToCefr(-3)).toBe("A1");
    expect(bandToCefr(99)).toBe("C1");
    expect(bandToCefr(Number.NaN)).toBe("A1");
  });
});
```

- [ ] **Step 2: Chạy để thấy fail**

```bash
npx vitest run src/lib/leech.test.ts src/lib/placement/band.test.ts
```

Expected: FAIL — `Failed to resolve import "./leech"` và `bandToCefr is not a function`.

- [ ] **Step 3: Tạo `src/lib/leech.ts` và thêm `bandToCefr`**

```ts
// src/lib/leech.ts
// Predicate "từ khó" (leech), thuần và không dính userId — nhờ vậy cả module
// server (study-engine, notebook) lẫn module thuần (vault/scope) dùng chung một
// định nghĩa. Không có server-only ở đây: thêm vào là vault/scope.ts hết test được.

// Một "leech" là từ người học liên tục quên: đủ số lần lapse trên một card đã ra
// khỏi trạng thái New. Suy ra, không bao giờ lưu.
export const LEECH_THRESHOLD = 4;

export function leechCardWhere() {
  return { lapses: { gte: LEECH_THRESHOLD }, state: { gte: 1 } };
}
```

```ts
// src/lib/fsrs.ts — thêm ngay dưới khối STATES
// "Đã học" = card đã ra khỏi giai đoạn học (Review hoặc Relearning). Một hằng
// duy nhất cho cả stats, export và kho từ — trước đây stats.ts viết tay
// `state === 2 || state === 3` còn export.ts viết [STATES.Review, ...].
export const LEARNED_STATES = [STATES.Review, STATES.Relearning] as const;
```

```ts
// src/lib/placement/estimate.ts — thêm vào cuối file
// Band là float trên thang A1=0 … C1=4. Bốn chỗ trong app từng chép inline
// CEFR_LEVELS[clamp(round(band))]; gom về đây để chỗ thứ năm (kho từ) không
// chép lần nữa.
export function bandToCefr(band: number): string {
  const i = Number.isFinite(band) ? Math.round(band) : 0;
  return CEFR_LEVELS[Math.min(CEFR_LEVELS.length - 1, Math.max(0, i))];
}
```

- [ ] **Step 4: Nối `study-engine.ts` vào `leech.ts`, không đổi hành vi**

```ts
// src/lib/study-engine.ts — thay khối LEECH_THRESHOLD/leechWhere hiện tại
import { LEECH_THRESHOLD, leechCardWhere } from "./leech";

// Re-export để notebook.ts và mọi caller cũ không phải đổi import.
export { LEECH_THRESHOLD };

// Single source of truth cho predicate leech giờ nằm ở ./leech (thuần, có test);
// đây chỉ là bản có userId dùng cho query trên Card.
export const leechWhere = (userId: string) => ({ userId, ...leechCardWhere() });
```

- [ ] **Step 5: Sửa hai chỗ định nghĩa "đã học" và bốn chỗ chép band**

```ts
// src/lib/stats.ts — import LEARNED_STATES từ "./fsrs", rồi ở vòng lặp cefrStats:
const LEARNED = new Set<number>(LEARNED_STATES);
for (const c of cardsWithCefr) {
  const lvl = c.word.cefr;
  if (LEARNED.has(c.state)) learnedByCefr[lvl] = (learnedByCefr[lvl] ?? 0) + 1;
  else learningByCefr[lvl] = (learningByCefr[lvl] ?? 0) + 1;
}
```

```ts
// src/lib/stats.ts — learnedCards ở đầu getDashboardStats
const learnedCards = LEARNED_STATES.reduce((n, s) => n + (stateCount[s] ?? 0), 0);
```

```ts
// src/lib/export.ts — nhánh scope === "learned"
where: { userId, state: { in: [...LEARNED_STATES] } },
```

Ở bốn file UI, thay biểu thức inline bằng `bandToCefr(...)`:

```tsx
// src/app/settings/profile-section.tsx — trước:
//   ? CEFR_LEVELS[Math.min(CEFR_LEVELS.length - 1, Math.max(0, Math.round(profile.band)))]
// sau:
? bandToCefr(profile.band)
```

Ba chỗ còn lại, viết ra đủ để không phải suy diễn:

```tsx
// src/app/onboarding/onboarding-flow.tsx:93 — trước:
//   const label = CEFR_LEVELS[Math.min(CEFR_LEVELS.length - 1, Math.max(0, band))];
// sau:
const label = bandToCefr(band);
```

```tsx
// src/app/onboarding/onboarding-flow.tsx:272 — trước:
//   const bandLabel = CEFR_LEVELS[Math.round(estimate.band)] ?? "A1";
// sau (bản cũ ở đây KHÔNG kẹp trên, band 5 sẽ ra undefined rồi rơi về "A1" —
// bandToCefr kẹp thật nên trả về "C1"):
const bandLabel = bandToCefr(estimate.band);
```

```tsx
// src/app/page.tsx:84 — thay biểu thức CEFR_LEVELS[...] nhiều dòng bằng:
bandToCefr(profile.band)
```

Thêm `import { bandToCefr } from "@/lib/placement/estimate";` vào cả ba file, và bỏ import `CEFR_LEVELS` ở file nào không còn dùng đến nó (`npx tsc --noEmit` sẽ không báo import thừa, nhưng `npm run lint` thì có).

- [ ] **Step 6: Chạy test mới + toàn bộ test + tsc**

```bash
npx vitest run src/lib/leech.test.ts src/lib/placement/band.test.ts
npm test
npx tsc --noEmit
```

Expected: hai file mới PASS; **toàn bộ** test xanh (task này không được đổi hành vi nào); `tsc` im lặng.

- [ ] **Step 7: Commit**

```bash
git add src/lib/leech.ts src/lib/leech.test.ts src/lib/fsrs.ts src/lib/study-engine.ts \
        src/lib/stats.ts src/lib/export.ts src/lib/placement/estimate.ts \
        src/lib/placement/band.test.ts src/app/onboarding/onboarding-flow.tsx \
        src/app/page.tsx src/app/settings/profile-section.tsx
git commit -m "refactor(vocab): one definition each for learned, leech, and band→CEFR

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: `vault/scope.ts` — từ vựng phạm vi dùng chung

**Files:**
- Create: `src/lib/vault/scope.ts` (thuần)
- Create: `src/lib/vault/scope.test.ts`

**Interfaces:**
- Consumes: `STATES`, `LEARNED_STATES` (`@/lib/fsrs`), `leechCardWhere` (`@/lib/leech`)
- Produces:
  - `type Scope`, `SCOPES`, `BROWSE_SCOPES`, `STUDY_SCOPES`, `EXPORT_SCOPES`
  - `parseScope(raw: string | null, allowed: readonly Scope[]): Scope | null`
  - `parseFilter(sp: { scope?: string; cefr?: string; topic?: string; q?: string }, allowed: readonly Scope[]): VaultFilter`
  - `type VaultFilter = { scope: Scope; cefr?: string; topic?: string; q?: string }`
  - `scopeWhere(scope: Scope, userId: string): Record<string, unknown>`
  - `filterWhere(f: VaultFilter, userId: string | null): Record<string, unknown>`

- [ ] **Step 1: Viết test**

```ts
// src/lib/vault/scope.test.ts
import { describe, it, expect } from "vitest";
import { STATES, LEARNED_STATES } from "../fsrs";
import { leechCardWhere } from "../leech";
import {
  BROWSE_SCOPES, STUDY_SCOPES, EXPORT_SCOPES,
  parseScope, parseFilter, scopeWhere, filterWhere,
} from "./scope";

const U = "user_1";

describe("scopeWhere", () => {
  it("all không lọc gì", () => {
    expect(scopeWhere("all", U)).toEqual({});
  });

  it("mine = có card HOẶC có mark starred/known", () => {
    // "Từ của tôi" là quan hệ của người học với từ, không riêng lịch ôn: một từ
    // được đánh dấu "đã biết" mà chưa từng vào phiên vẫn là từ của họ.
    expect(scopeWhere("mine", U)).toEqual({
      OR: [
        { cards: { some: { userId: U } } },
        { marks: { some: { userId: U, OR: [{ starred: true }, { known: true }] } } },
      ],
    });
  });

  it("learned dùng LEARNED_STATES, không phải số cứng", () => {
    expect(scopeWhere("learned", U)).toEqual({
      cards: { some: { userId: U, state: { in: [...LEARNED_STATES] } } },
    });
  });

  it("learning GỒM state 0 — card chỉ tồn tại sau khi từ đã vào một phiên", () => {
    // Bỏ state 0 ra thì nhóm "đã gặp, chưa tốt nghiệp" không thuộc phạm vi nào
    // ngoài mine, và người học không tìm lại được chúng.
    expect(scopeWhere("learning", U)).toEqual({
      cards: { some: { userId: U, state: { in: [STATES.New, STATES.Learning] } } },
    });
  });

  it("known đọc WordMark.known", () => {
    expect(scopeWhere("known", U)).toEqual({ marks: { some: { userId: U, known: true } } });
  });

  it("unseen = KHÔNG có card nào của user này", () => {
    expect(scopeWhere("unseen", U)).toEqual({ cards: { none: { userId: U } } });
  });

  it("leeches nhúng leechCardWhere, không chép lại ngưỡng", () => {
    expect(scopeWhere("leeches", U)).toEqual({
      cards: { some: { userId: U, ...leechCardWhere() } },
    });
  });
});

describe("parseScope", () => {
  it("trả null với rác và với scope không nằm trong tập cho phép", () => {
    expect(parseScope("nonsense", BROWSE_SCOPES)).toBeNull();
    expect(parseScope(null, BROWSE_SCOPES)).toBeNull();
    expect(parseScope("weak", BROWSE_SCOPES)).toBeNull(); // weak là ý định học, không phải cách xem
    expect(parseScope("mine", STUDY_SCOPES)).toBeNull();
  });

  it("nhận scope hợp lệ trong tập cho phép", () => {
    expect(parseScope("learned", BROWSE_SCOPES)).toBe("learned");
    expect(parseScope("weak", STUDY_SCOPES)).toBe("weak");
  });

  it("weak KHÔNG thuộc EXPORT_SCOPES — 'yếu nhất' chỉ có nghĩa cùng một limit", () => {
    expect(parseScope("weak", EXPORT_SCOPES)).toBeNull();
  });
});

describe("parseFilter", () => {
  it("scope thiếu/không hợp lệ → all, và ALL bị coi như không lọc", () => {
    expect(parseFilter({}, BROWSE_SCOPES)).toEqual({ scope: "all" });
    expect(parseFilter({ scope: "rác", cefr: "ALL", topic: "ALL" }, BROWSE_SCOPES)).toEqual({
      scope: "all",
    });
  });

  it("giữ nguyên cefr/topic/q hợp lệ và hạ q về lowercase", () => {
    expect(parseFilter({ scope: "learned", cefr: "B2", topic: "medical", q: "AbAndon" }, BROWSE_SCOPES))
      .toEqual({ scope: "learned", cefr: "B2", topic: "medical", q: "abandon" });
  });

  it("nhận alias cefr:B2 của ExportScope cũ → { scope: all, cefr: B2 }", () => {
    // Mọi URL /api/export?scope=cefr:B2 đang chạy phải tiếp tục chạy.
    expect(parseFilter({ scope: "cefr:B2" }, EXPORT_SCOPES)).toEqual({ scope: "all", cefr: "B2" });
    expect(parseFilter({ scope: "cefr:XX" }, EXPORT_SCOPES)).toEqual({ scope: "all" });
  });
});

describe("filterWhere", () => {
  it("ghép scope + cefr + topic + q vào một where", () => {
    expect(filterWhere({ scope: "learned", cefr: "B2", topic: "medical", q: "ab" }, U)).toEqual({
      cefr: "B2",
      topics: { contains: '"medical"' },
      word: { contains: "ab" },
      cards: { some: { userId: U, state: { in: [...LEARNED_STATES] } } },
    });
  });

  it("userId null → bỏ hẳn phần scope, chỉ còn lọc trên Word", () => {
    // Guest: không có Card nào nên mọi phạm vi ngoài all đều rỗng; UI khoá chip,
    // còn ở đây phải trả về where hợp lệ chứ không phải { cards: { some: { userId: null } } }.
    expect(filterWhere({ scope: "learned", cefr: "A1" }, null)).toEqual({ cefr: "A1" });
  });
});
```

- [ ] **Step 2: Chạy để thấy fail**

```bash
npx vitest run src/lib/vault/scope.test.ts
```

Expected: FAIL — `Failed to resolve import "./scope"`.

- [ ] **Step 3: Viết `src/lib/vault/scope.ts`**

```ts
// Từ vựng "phạm vi" dùng chung cho /browse, study và export.
//
// Vì sao gom: repo từng có ba từ vựng rời rạc — ExportScope ("all"|"starred"|
// "learned"|"cefr:X"), enum scope của study ("starred"|"leeches"), và q/cefr của
// /browse. Thêm bộ lọc thứ tư mà không gom thì mọi nút "ôn"/"xuất" cần một bảng
// dịch giữa bốn từ vựng, và bảng dịch đó là nơi lỗi sẽ sống.
//
// Module này THUẦN: không prisma, không server-only. Nó chỉ dựng mảnh `where`.
import { STATES, LEARNED_STATES } from "../fsrs";
import { leechCardWhere } from "../leech";
import { CEFR_LEVELS } from "../export-format";

export const SCOPES = [
  "all", "mine", "learned", "learning", "known", "unseen", "starred", "leeches", "weak",
] as const;
export type Scope = (typeof SCOPES)[number];

// Mỗi nơi tiêu thụ khai báo tập con nó nhận — không nơi nào "nhận mọi scope".
export const BROWSE_SCOPES = ["all", "mine", "learned", "learning", "known", "unseen"] as const;
export const STUDY_SCOPES = ["starred", "leeches", "weak"] as const;
// weak không có ở đây: "yếu nhất" chỉ có nghĩa cùng với một limit, mà export
// không có khái niệm giới hạn.
export const EXPORT_SCOPES = [
  "all", "mine", "learned", "learning", "known", "unseen", "starred", "leeches",
] as const;

export type VaultFilter = { scope: Scope; cefr?: string; topic?: string; q?: string };

export function parseScope(raw: string | null | undefined, allowed: readonly Scope[]): Scope | null {
  if (!raw) return null;
  return (allowed as readonly string[]).includes(raw) ? (raw as Scope) : null;
}

export function parseFilter(
  sp: { scope?: string; cefr?: string; topic?: string; q?: string },
  allowed: readonly Scope[]
): VaultFilter {
  const out: VaultFilter = { scope: parseScope(sp.scope, allowed) ?? "all" };

  // Alias tương thích ngược: ExportScope cũ mã hoá bậc CEFR vào chính scope
  // ("cefr:B2"). Giữ nhận dạng đó để URL export đang chạy không chết.
  let cefr = sp.cefr;
  if (sp.scope?.startsWith("cefr:")) {
    const level = sp.scope.slice("cefr:".length);
    if ((CEFR_LEVELS as readonly string[]).includes(level)) cefr = level;
  }

  if (cefr && cefr !== "ALL" && (CEFR_LEVELS as readonly string[]).includes(cefr)) out.cefr = cefr;
  if (sp.topic && sp.topic !== "ALL") out.topic = sp.topic;
  const q = sp.q?.trim().toLowerCase();
  if (q) out.q = q;
  return out;
}

export function scopeWhere(scope: Scope, userId: string): Record<string, unknown> {
  switch (scope) {
    case "mine":
      return {
        OR: [
          { cards: { some: { userId } } },
          { marks: { some: { userId, OR: [{ starred: true }, { known: true }] } } },
        ],
      };
    case "learned":
      return { cards: { some: { userId, state: { in: [...LEARNED_STATES] } } } };
    // state 0 nằm trong "đang học" vì Card chỉ được tạo khi từ đã vào một phiên
    // (fetchNewCards): card state 0 là "đã gặp, chưa tốt nghiệp".
    case "learning":
      return { cards: { some: { userId, state: { in: [STATES.New, STATES.Learning] } } } };
    case "known":
      return { marks: { some: { userId, known: true } } };
    case "unseen":
      return { cards: { none: { userId } } };
    case "starred":
      return { marks: { some: { userId, starred: true } } };
    case "leeches":
      return { cards: { some: { userId, ...leechCardWhere() } } };
    // weak lọc giống learning+ nhưng thứ tự mới là điểm chính của nó, và thứ tự
    // phải làm ở tầng card (weak-server.ts) vì Prisma không orderBy qua quan hệ.
    case "weak":
      return { cards: { some: { userId, state: { gte: STATES.Learning } } } };
    case "all":
    default:
      return {};
  }
}

export function filterWhere(f: VaultFilter, userId: string | null): Record<string, unknown> {
  const where: Record<string, unknown> = {};
  if (f.cefr) where.cefr = f.cefr;
  // Word.topics là JSON array lưu dạng string — cùng khuôn với studyWordFilter.
  if (f.topic) where.topics = { contains: `"${f.topic}"` };
  if (f.q) where.word = { contains: f.q };
  if (userId && f.scope !== "all") Object.assign(where, scopeWhere(f.scope, userId));
  return where;
}
```

- [ ] **Step 4: Chạy test**

```bash
npx vitest run src/lib/vault/scope.test.ts
npx tsc --noEmit
```

Expected: PASS toàn bộ; `tsc` im lặng.

- [ ] **Step 5: Commit**

```bash
git add src/lib/vault/scope.ts src/lib/vault/scope.test.ts
git commit -m "feat(vault): one scope vocabulary for browse, study, and export

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Dải tổng hợp — `summary.ts` thuần + `summary-server.ts`

**Files:**
- Create: `src/lib/vault/summary.ts` (thuần)
- Create: `src/lib/vault/summary.test.ts`
- Create: `src/lib/vault/summary-server.ts` (server)

**Interfaces:**
- Consumes: `LEARNED_STATES`, `STATES` (`@/lib/fsrs`), `bandToCefr` (`@/lib/placement/estimate`), `prisma` (`@/lib/db`)
- Produces:
  - `type SummaryInput`, `type VaultSummary = { total: number; seen: number; learned: number; learning: number; known: number; band: { level: string; learned: number; total: number } | null }`
  - `shapeSummary(input: SummaryInput): VaultSummary`
  - `getVaultSummary(userId: string): Promise<VaultSummary>`

- [ ] **Step 1: Viết test cho `shapeSummary`**

```ts
// src/lib/vault/summary.test.ts
import { describe, it, expect } from "vitest";
import { shapeSummary } from "./summary";

describe("shapeSummary", () => {
  it("learning gộp state 0 và 1 — khớp learningCards + newCardsSeen của /stats", () => {
    const s = shapeSummary({
      total: 8011,
      cardStates: [
        { state: 0, count: 12 },
        { state: 1, count: 30 },
        { state: 2, count: 1200 },
        { state: 3, count: 4 },
      ],
      knownCount: 87,
      bandLevel: "B1",
      bandTotal: 1500,
      bandLearned: 400,
    });
    expect(s.learning).toBe(42); // 12 + 30
    expect(s.learned).toBe(1204); // 1200 + 4
    expect(s.seen).toBe(1246); // mọi card, bất kể state
    expect(s.known).toBe(87);
    expect(s.total).toBe(8011);
  });

  it("user chưa có card nào → mọi số là 0, không NaN", () => {
    const s = shapeSummary({ total: 8011, cardStates: [], knownCount: 0, bandLevel: null });
    expect(s).toMatchObject({ seen: 0, learned: 0, learning: 0, known: 0, total: 8011 });
    expect(s.band).toBeNull();
  });

  it("không có LearnerProfile → band null, dải không vẽ thanh tiến độ", () => {
    const s = shapeSummary({
      total: 10, cardStates: [{ state: 2, count: 3 }], knownCount: 0, bandLevel: null,
    });
    expect(s.band).toBeNull();
  });

  it("band có nhưng bậc đó chưa có từ nào trong DB → total 0, KHÔNG chia cho 0", () => {
    const s = shapeSummary({
      total: 10, cardStates: [], knownCount: 0,
      bandLevel: "C1", bandTotal: 0, bandLearned: 0,
    });
    expect(s.band).toEqual({ level: "C1", learned: 0, total: 0 });
  });

  it("state lạ trong DB không làm hỏng phép đếm", () => {
    // Phòng xa: state ngoài 0..3 (dữ liệu cũ/hỏng) chỉ tính vào seen.
    const s = shapeSummary({
      total: 5, cardStates: [{ state: 9, count: 2 }], knownCount: 0, bandLevel: null,
    });
    expect(s.seen).toBe(2);
    expect(s.learned).toBe(0);
    expect(s.learning).toBe(0);
  });
});
```

- [ ] **Step 2: Chạy để thấy fail**

```bash
npx vitest run src/lib/vault/summary.test.ts
```

Expected: FAIL — `Failed to resolve import "./summary"`.

- [ ] **Step 3: Viết `summary.ts`**

```ts
// Dải tổng hợp của kho từ. Phần thuần: biến kết quả groupBy thô thành số để
// render. Không gọi getDashboardStats vì hàm đó còn fetch 100 ReviewLog và cả
// CEFR fanout mà dải này không cần.
import { STATES, LEARNED_STATES } from "../fsrs";

export type SummaryInput = {
  total: number;
  cardStates: { state: number; count: number }[];
  knownCount: number;
  bandLevel: string | null;
  bandTotal?: number;
  bandLearned?: number;
};

export type VaultSummary = {
  total: number;
  seen: number;
  learned: number;
  learning: number;
  known: number;
  band: { level: string; learned: number; total: number } | null;
};

const LEARNED = new Set<number>(LEARNED_STATES);
const LEARNING = new Set<number>([STATES.New, STATES.Learning]);

export function shapeSummary(input: SummaryInput): VaultSummary {
  let seen = 0;
  let learned = 0;
  let learning = 0;
  for (const row of input.cardStates) {
    seen += row.count;
    if (LEARNED.has(row.state)) learned += row.count;
    else if (LEARNING.has(row.state)) learning += row.count;
  }
  return {
    total: input.total,
    seen,
    learned,
    learning,
    known: input.knownCount,
    band: input.bandLevel
      ? { level: input.bandLevel, learned: input.bandLearned ?? 0, total: input.bandTotal ?? 0 }
      : null,
  };
}
```

- [ ] **Step 4: Chạy test**

```bash
npx vitest run src/lib/vault/summary.test.ts
```

Expected: PASS.

- [ ] **Step 5: Viết `summary-server.ts`**

```ts
import "server-only";
import { prisma } from "../db";
import { LEARNED_STATES } from "../fsrs";
import { bandToCefr } from "../placement/estimate";
import { shapeSummary, type VaultSummary } from "./summary";

// Bốn query song song (Postgres serverless tính độ trễ theo mỗi round-trip), rồi
// giao toàn bộ phép đếm cho hàm thuần shapeSummary.
export async function getVaultSummary(userId: string): Promise<VaultSummary> {
  const [total, grouped, knownCount, profile] = await Promise.all([
    prisma.word.count(),
    prisma.card.groupBy({ by: ["state"], _count: true, where: { userId } }),
    prisma.wordMark.count({ where: { userId, known: true } }),
    prisma.learnerProfile.findUnique({ where: { userId }, select: { band: true } }),
  ]);

  const cardStates = grouped.map((g) => ({ state: g.state, count: g._count }));
  if (!profile) {
    return shapeSummary({ total, cardStates, knownCount, bandLevel: null });
  }

  // Chỉ đếm cho ĐÚNG bậc người học đang ở — hai count rẻ, thay vì quét toàn bộ
  // card của user như getDashboardStats phải làm để dựng cả 5 bậc.
  const level = bandToCefr(profile.band);
  const [bandTotal, bandLearned] = await Promise.all([
    prisma.word.count({ where: { cefr: level } }),
    prisma.card.count({
      where: { userId, state: { in: [...LEARNED_STATES] }, word: { cefr: level } },
    }),
  ]);
  return shapeSummary({ total, cardStates, knownCount, bandLevel: level, bandTotal, bandLearned });
}
```

- [ ] **Step 6: `tsc` + toàn bộ test**

```bash
npx tsc --noEmit
npm test
```

Expected: im lặng và xanh.

- [ ] **Step 7: Commit**

```bash
git add src/lib/vault/summary.ts src/lib/vault/summary.test.ts src/lib/vault/summary-server.ts
git commit -m "feat(vault): summary strip counts, band bar from LearnerProfile

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: `/browse` — chip phạm vi, lọc chủ đề, dải tổng hợp

**Files:**
- Modify: `src/app/browse/page.tsx` (toàn bộ phần đọc searchParams + query)
- Modify: `src/app/browse/library-client.tsx` (chip phạm vi, chip chủ đề, dải tổng hợp, sửa bẫy `text-soft/70`)
- Modify: `src/lib/i18n/dictionaries.ts` (khóa mới ở **cả hai** nhánh `vi` và `en`)

**Interfaces:**
- Consumes: `parseFilter`, `filterWhere`, `BROWSE_SCOPES` (`@/lib/vault/scope`); `getVaultSummary` (`@/lib/vault/summary-server`); `TOPICS` (`@/lib/topic-taxonomy`)
- Produces: URL contract `/browse?scope=&cefr=&topic=&q=&page=` — Task 5 và Task 6 dựng link từ đúng contract này.

- [ ] **Step 1: Thêm khóa i18n cho cả hai ngôn ngữ**

Trong `src/lib/i18n/dictionaries.ts`, nhánh `vi`, khối `browse:`:

```ts
    scopeLabel: "Phạm vi",
    scopeAll: "Tất cả",
    scopeMine: "Từ của tôi",
    scopeLearned: "Đã thuộc",
    scopeLearning: "Đang học",
    scopeKnown: "Đã biết",
    scopeUnseen: "Chưa gặp",
    topicLabel: "Chủ đề",
    topicAll: "Mọi chủ đề",
    summaryLearned: "{n} từ thuộc",
    summaryLearning: "{n} đang học",
    summaryKnown: "{n} đã biết",
    summaryBand: "{level} {pct}%",
    studyWeak: "Ôn 20 từ yếu nhất",
    exportFiltered: "Xuất",
    scopeLocked: "Đăng nhập để lọc kho từ của bạn",
```

Nhánh `en`, cùng khối `browse:`:

```ts
    scopeLabel: "Scope",
    scopeAll: "All",
    scopeMine: "My words",
    scopeLearned: "Learned",
    scopeLearning: "Learning",
    scopeKnown: "Known",
    scopeUnseen: "Unseen",
    topicLabel: "Topic",
    topicAll: "All topics",
    summaryLearned: "{n} learned",
    summaryLearning: "{n} learning",
    summaryKnown: "{n} known",
    summaryBand: "{level} {pct}%",
    studyWeak: "Drill 20 weakest",
    exportFiltered: "Export",
    scopeLocked: "Sign in to filter your own words",
```

- [ ] **Step 2: Viết lại phần đọc tham số + query của `page.tsx`**

```tsx
import { prisma } from "@/lib/db";
import { parseJsonArray } from "@/lib/utils";
import { getCurrentUser } from "@/lib/session";
import { AuthRequired } from "@/components/auth-required";
import { parseFilter, filterWhere, BROWSE_SCOPES } from "@/lib/vault/scope";
import { getVaultSummary } from "@/lib/vault/summary-server";
import { LibraryClient } from "./library-client";

export const dynamic = "force-dynamic";

export default async function BrowsePage({
  searchParams,
}: {
  searchParams: { q?: string; cefr?: string; topic?: string; scope?: string; page?: string };
}) {
  const user = await getCurrentUser();
  const userId = user?.id;
  const filter = parseFilter(searchParams, BROWSE_SCOPES);
  const page = Math.max(1, Number(searchParams.page || "1"));
  const perPage = 40;

  // Page 1 là bản xem thử miễn phí; đi sâu hơn thì cần tài khoản.
  if (!userId && page > 1) {
    const sp = new URLSearchParams();
    if (filter.q) sp.set("q", filter.q);
    if (filter.cefr) sp.set("cefr", filter.cefr);
    if (filter.topic) sp.set("topic", filter.topic);
    sp.set("page", String(page));
    return <AuthRequired context="library" callbackUrl={`/browse?${sp.toString()}`} />;
  }

  const where = filterWhere(filter, userId ?? null);

  const [words, total, summary] = await Promise.all([
    prisma.word.findMany({
      where,
      orderBy: { word: "asc" },
      skip: (page - 1) * perPage,
      take: perPage,
      include: {
        cards: userId ? { where: { userId }, select: { state: true, due: true, reps: true } } : false,
      },
    }),
    prisma.word.count({ where }),
    userId ? getVaultSummary(userId) : Promise.resolve(null),
  ]);
```

Phần map `items` và `marks` bên dưới giữ nguyên. Chỗ render đổi thành:

```tsx
  return (
    <LibraryClient
      items={items}
      total={total}
      page={page}
      totalPages={Math.max(1, Math.ceil(total / perPage))}
      q={filter.q ?? ""}
      cefr={filter.cefr ?? "ALL"}
      topic={filter.topic ?? "ALL"}
      scope={filter.scope}
      summary={summary}
      authed={!!userId}
    />
  );
```

- [ ] **Step 3: Thêm chip + dải vào `library-client.tsx`**

Mở rộng props và viết một hàm dựng query string duy nhất — `mkQs` hiện tại chỉ biết `q`/`cefr`/`page`, để nguyên là bấm chip sẽ **âm thầm mất** `topic` và `scope`:

```tsx
import type { VaultSummary } from "@/lib/vault/summary";
import { BROWSE_SCOPES, type Scope } from "@/lib/vault/scope";
import { TOPICS } from "@/lib/topic-taxonomy";

type Query = { q?: string; cefr?: string; topic?: string; scope?: Scope; page?: number };

// ── TRONG thân component LibraryClient, ngay sau các useState ──
// Trạng thái bộ lọc hiện tại, dựng MỘT lần từ props rồi truyền vào mọi mkQs.
// Thiếu biến này là mỗi chip tự đoán lấy phần còn lại và làm rơi tham số của chip
// khác — chính cái bug mkQs sinh ra để chặn.
const cur: Query = { q: search, cefr, topic, scope, page };

// ── NGOÀI component, thay hàm mkQs(q, cefr, page) cũ ở cuối file ──
// Một chỗ duy nhất dựng URL của /browse. Mọi chip đi qua đây để không có chip
// nào làm rơi tham số của chip khác.
function mkQs(cur: Query, patch: Query) {
  const next = { ...cur, ...patch };
  const sp = new URLSearchParams();
  if (next.q) sp.set("q", next.q);
  if (next.cefr && next.cefr !== "ALL") sp.set("cefr", next.cefr);
  if (next.topic && next.topic !== "ALL") sp.set("topic", next.topic);
  if (next.scope && next.scope !== "all") sp.set("scope", next.scope);
  if (next.page && next.page > 1) sp.set("page", String(next.page));
  return sp.toString();
}
```

Hai chỗ đang gọi `mkQs` theo chữ ký cũ phải sửa theo, không thì `tsc` đổ:

```tsx
// goToPage (dòng ~69) — trước: `/browse?${mkQs(q, cefr, next)}`
const goToPage = (next: number) => {
  const href = `/browse?${mkQs(cur, { page: next })}`;
  if (!authed) {
    openGate({ callbackUrl: href, reason: "library" });
    return;
  }
  router.push(href);
};
```

```tsx
// update() (dòng ~77) tự dựng URLSearchParams riêng — xoá hẳn nó và cho form
// search cùng chip CEFR đi qua mkQs, nếu không search sẽ làm rơi scope/topic:
const onSubmit = (e: React.FormEvent) => {
  e.preventDefault();
  startTransition(() => router.push(`/browse?${mkQs(cur, { q: search, page: 1 })}`));
};
```

Chip CEFR (dòng ~118) đổi `onClick` thành `startTransition(() => router.push(\`/browse?${mkQs(cur, { cefr: l, page: 1 })}\`))`.

Hàng chip phạm vi, đặt ngay dưới hàng CEFR. Guest bấm vào thì mở gate chứ không điều hướng tới danh sách rỗng:

```tsx
      <div className="flex items-center gap-2 mb-4 overflow-x-auto scrollbar-hide">
        <span className="text-xs text-soft font-mono shrink-0">{t("browse.scopeLabel")}</span>
        {BROWSE_SCOPES.map((s) => (
          <button
            key={s}
            onClick={() => {
              if (!authed && s !== "all") {
                openGate({ callbackUrl: `/browse?${mkQs(cur, { scope: s, page: 1 })}`, reason: "library" });
                return;
              }
              startTransition(() => router.push(`/browse?${mkQs(cur, { scope: s, page: 1 })}`));
            }}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-medium border whitespace-nowrap transition-colors",
              scope === s ? "bg-ember text-paper border-ember" : "border-line text-soft hover:text-ink"
            )}
          >
            {t(`browse.scope${s[0].toUpperCase()}${s.slice(1)}`)}
            {!authed && s !== "all" && <Lock size={10} className="inline ml-1 text-ember" aria-hidden />}
          </button>
        ))}
      </div>
```

Dải tổng hợp, chỉ hiện khi có `summary` (tức đã đăng nhập) và người học đã gặp ít nhất một từ:

```tsx
      {summary && summary.seen > 0 && (
        <div className="card-atelier p-4 mb-5 flex flex-wrap items-center gap-x-5 gap-y-2">
          <span className="display text-lg">{t("browse.summaryLearned", { n: summary.learned.toLocaleString() })}</span>
          <span className="text-sm text-soft">{t("browse.summaryLearning", { n: summary.learning.toLocaleString() })}</span>
          <span className="text-sm text-soft">{t("browse.summaryKnown", { n: summary.known.toLocaleString() })}</span>
          {summary.band && summary.band.total > 0 && (
            <span className="text-sm text-soft tabular-nums">
              {t("browse.summaryBand", {
                level: summary.band.level,
                pct: Math.round((summary.band.learned / summary.band.total) * 100),
              })}
            </span>
          )}
          <div className="flex gap-2 ml-auto">
            <Link
              href={`/study/cram?${mkQs({ cefr, topic }, { scope: "weak" as Scope })}`}
              className="rounded-full border border-line px-3.5 py-1.5 text-xs font-medium hover:border-ember"
            >
              {t("browse.studyWeak")}
            </Link>
            <a
              href={`/api/export?format=csv&${mkQs(cur, {})}`}
              download
              className="rounded-full border border-line px-3.5 py-1.5 text-xs font-medium hover:border-ember"
            >
              {t("browse.exportFiltered")}
            </a>
          </div>
        </div>
      )}
```

Chip chủ đề: `<select>` dựng từ `TOPICS` (không phải hàng chip — hiện có hơn 20 chủ đề, hàng chip sẽ đè hết màn hình mobile):

```tsx
        <select
          value={topic}
          onChange={(e) => startTransition(() => router.push(`/browse?${mkQs(cur, { topic: e.target.value, page: 1 })}`))}
          className="rounded-full border border-line bg-surface px-3.5 py-2 text-sm"
        >
          <option value="ALL">{t("browse.topicAll")}</option>
          {TOPICS.map((tp) => (
            <option key={tp.slug} value={tp.slug}>{t(`topics.names.${tp.slug}`)}</option>
          ))}
        </select>
```

- [ ] **Step 4: Sửa bẫy Tailwind đang sống trong file này**

`library-client.tsx:160` dùng `text-soft/70` và `:162` dùng `text-soft/80`. `text-soft` là class `@layer components`, **không** phải colour key, nên hai class đó compile ra **rỗng** — nghĩa là hai dòng đó đang render ở độ mực đầy chứ không mờ như ý.

```tsx
{w.definitionVi && <p className="text-xs text-soft opacity-70 mt-0.5 line-clamp-1">{w.definitionVi}</p>}
```

```tsx
  <p className="text-xs text-soft opacity-80 mt-1">
```

- [ ] **Step 5: Kiểm tra biên dịch, rồi drive app thật**

```bash
npx tsc --noEmit
npm test
npm run dev
```

Nghiệm bằng tay (mỗi dòng phải tự tay xác nhận, `build` xanh không nói gì về những việc này):

1. `/browse?scope=learned` → chỉ từ đã thuộc; số ở dải khớp `/stats` (`learnedCards`).
2. `/browse?scope=learning` → so với `/stats`: phải bằng `learningCards + newCardsSeen`, **không** phải `learningCards`.
3. `/browse?scope=unseen` → không từ nào có pill trạng thái.
4. Bấm chip CEFR khi đang ở `scope=known&topic=medical` → **cả hai** tham số còn nguyên trên URL.
5. Sang trang 2 rồi bấm chip khác → `page` reset về 1, không rơi vào trang trống.
6. Đổi ngôn ngữ sang English → không chỗ nào hiện raw key kiểu `BROWSE.SCOPEMINE`.
7. Đăng xuất (hoặc cửa sổ ẩn danh) → chip phạm vi có ổ khoá, bấm vào mở gate; trang 1 vẫn xem được.
8. Định nghĩa tiếng Việt trong danh sách giờ **mờ hơn** dòng tiếng Anh (chứng minh Step 4 có tác dụng thật).

- [ ] **Step 6: Commit**

```bash
git add src/app/browse/page.tsx src/app/browse/library-client.tsx src/lib/i18n/dictionaries.ts
git commit -m "feat(vault): scope chips, topic filter, and a progress strip in the library

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Hành động hàng loạt

**Files:**
- Create: `src/lib/vault/bulk.ts` (thuần — validate)
- Create: `src/lib/vault/bulk.test.ts`
- Create: `src/lib/vault/bulk-server.ts` (server — thực thi)
- Create: `src/app/api/vault/bulk/route.ts`
- Modify: `src/app/browse/library-client.tsx` (checkbox + thanh hành động)
- Modify: `src/lib/i18n/dictionaries.ts` (cả hai nhánh)

**Interfaces:**
- Consumes: `requireUserId` (`@/lib/session`), `prisma`, `STATES`
- Produces:
  - `BULK_MAX = 40`, `BULK_ACTIONS`, `type BulkAction`
  - `parseBulkRequest(body: unknown): { ok: true; wordIds: string[]; action: BulkAction } | { ok: false; error: string }`
  - `applyBulk(userId, wordIds, action): Promise<{ changed: number }>`

- [ ] **Step 1: Viết test cho `parseBulkRequest`**

```ts
// src/lib/vault/bulk.test.ts
import { describe, it, expect } from "vitest";
import { parseBulkRequest, BULK_MAX } from "./bulk";

describe("parseBulkRequest", () => {
  it("nhận yêu cầu hợp lệ", () => {
    expect(parseBulkRequest({ wordIds: ["a", "b"], action: "mark-known" })).toEqual({
      ok: true, wordIds: ["a", "b"], action: "mark-known",
    });
  });

  it("từ chối action lạ", () => {
    expect(parseBulkRequest({ wordIds: ["a"], action: "delete-card" })).toMatchObject({ ok: false });
    expect(parseBulkRequest({ wordIds: ["a"], action: "drop" })).toMatchObject({ ok: false });
  });

  it("từ chối danh sách rỗng và danh sách không phải chuỗi", () => {
    expect(parseBulkRequest({ wordIds: [], action: "star" })).toMatchObject({ ok: false });
    expect(parseBulkRequest({ wordIds: [1, 2], action: "star" })).toMatchObject({ ok: false });
    expect(parseBulkRequest({ action: "star" })).toMatchObject({ ok: false });
    expect(parseBulkRequest(null)).toMatchObject({ ok: false });
  });

  it(`chặn ở ${BULK_MAX} id — bằng perPage của /browse`, () => {
    // Không có "chọn tất cả 8.011 từ": một cú reset như thế không có đường lùi.
    const ids = Array.from({ length: BULK_MAX + 1 }, (_, i) => `w${i}`);
    expect(parseBulkRequest({ wordIds: ids, action: "reset" })).toMatchObject({ ok: false });
    expect(parseBulkRequest({ wordIds: ids.slice(0, BULK_MAX), action: "reset" })).toMatchObject({ ok: true });
  });

  it("loại id trùng nhau trước khi trả về", () => {
    const r = parseBulkRequest({ wordIds: ["a", "a", "b"], action: "star" });
    expect(r).toMatchObject({ ok: true });
    if (r.ok) expect(r.wordIds).toEqual(["a", "b"]);
  });
});
```

- [ ] **Step 2: Chạy để thấy fail**

```bash
npx vitest run src/lib/vault/bulk.test.ts
```

Expected: FAIL — `Failed to resolve import "./bulk"`.

- [ ] **Step 3: Viết `bulk.ts`**

```ts
// Validate yêu cầu bulk. Thuần, để test được mà không cần DB.
export const BULK_MAX = 40; // = perPage của /browse: chỉ thao tác trên trang đang xem

// Chú ý những gì KHÔNG có ở đây: không xoá Card, không xoá ReviewLog. "Đừng hỏi
// tôi từ này nữa" đi bằng mark-known vì đó là tín hiệu đảo lại được.
export const BULK_ACTIONS = ["mark-known", "unmark-known", "star", "unstar", "reset"] as const;
export type BulkAction = (typeof BULK_ACTIONS)[number];

type Parsed =
  | { ok: true; wordIds: string[]; action: BulkAction }
  | { ok: false; error: string };

export function parseBulkRequest(body: unknown): Parsed {
  if (!body || typeof body !== "object") return { ok: false, error: "body required" };
  const { wordIds, action } = body as { wordIds?: unknown; action?: unknown };

  if (typeof action !== "string" || !(BULK_ACTIONS as readonly string[]).includes(action)) {
    return { ok: false, error: "invalid action" };
  }
  if (!Array.isArray(wordIds) || wordIds.length === 0) {
    return { ok: false, error: "wordIds required" };
  }
  if (!wordIds.every((id) => typeof id === "string" && id.length > 0)) {
    return { ok: false, error: "wordIds must be strings" };
  }
  const unique = [...new Set(wordIds as string[])];
  if (unique.length > BULK_MAX) return { ok: false, error: `at most ${BULK_MAX} words` };

  return { ok: true, wordIds: unique, action: action as BulkAction };
}
```

- [ ] **Step 4: Chạy test**

```bash
npx vitest run src/lib/vault/bulk.test.ts
```

Expected: PASS.

- [ ] **Step 5: Viết `bulk-server.ts`**

```ts
import "server-only";
import { prisma } from "../db";
import { STATES } from "../fsrs";
import type { BulkAction } from "./bulk";

export async function applyBulk(
  userId: string,
  wordIds: string[],
  action: BulkAction
): Promise<{ changed: number }> {
  if (action === "reset") {
    // Đưa lịch ôn về đầu, KHÔNG chạm ReviewLog và KHÔNG xoá Card.
    // xp (UserProgress/DailyStat) là ReviewLog-derived và db:backfill-xp --force
    // dựng lại từ log — xoá log là XP tụt âm thầm ở lần backfill sau. reps/lapses
    // cũng giữ: chúng là lịch sử đã xảy ra, không phải trạng thái lịch.
    const r = await prisma.card.updateMany({
      where: { userId, wordId: { in: wordIds } },
      data: {
        state: STATES.New,
        due: new Date(),
        stability: 0,
        difficulty: 0,
        elapsedDays: 0,
        scheduledDays: 0,
        lastReview: null,
      },
    });
    return { changed: r.count };
  }

  const patch =
    action === "mark-known" ? { known: true }
    : action === "unmark-known" ? { known: false }
    : action === "star" ? { starred: true }
    : { starred: false };

  // WordMark có unique [userId, wordId] nhưng createMany không upsert được, nên
  // tạo phần còn thiếu (skipDuplicates chịu được race) rồi update cả lô.
  await prisma.wordMark.createMany({
    data: wordIds.map((wordId) => ({ userId, wordId })),
    skipDuplicates: true,
  });
  const r = await prisma.wordMark.updateMany({
    where: { userId, wordId: { in: wordIds } },
    data: patch,
  });

  // Dọn hàng không còn tín hiệu — cùng bất biến mà setWordMark đang giữ
  // (notebook.ts): không starred, không note, không known thì không lưu.
  await prisma.wordMark.deleteMany({
    where: { userId, wordId: { in: wordIds }, starred: false, known: false, note: "" },
  });
  return { changed: r.count };
}
```

- [ ] **Step 6: Viết route**

```ts
// src/app/api/vault/bulk/route.ts
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireUserId } from "@/lib/session";
import { parseBulkRequest } from "@/lib/vault/bulk";
import { applyBulk } from "@/lib/vault/bulk-server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = parseBulkRequest(await req.json().catch(() => null));
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  try {
    const result = await applyBulk(userId, parsed.wordIds, parsed.action);
    return NextResponse.json(result);
  } catch (e) {
    // wordId lạ → vi phạm khoá ngoại WordMark.wordId (cùng cách xử lý như
    // /api/notebook đang làm).
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2003") {
      return NextResponse.json({ error: "word not found" }, { status: 404 });
    }
    throw e;
  }
}
```

- [ ] **Step 7: Checkbox + thanh hành động trong `library-client.tsx`**

Khóa i18n mới (**cả hai** nhánh) — `vi`: `bulkSelected: "Đã chọn {n}"`, `bulkMarkKnown: "Đánh dấu đã biết"`, `bulkStar: "Đánh dấu ★"`, `bulkReset: "Học lại từ đầu"`, `bulkClear: "Bỏ chọn"`, `bulkDone: "Đã cập nhật {n} từ"`; `en`: `bulkSelected: "{n} selected"`, `bulkMarkKnown: "Mark as known"`, `bulkStar: "Star"`, `bulkReset: "Reset progress"`, `bulkClear: "Clear"`, `bulkDone: "Updated {n} words"`.

```tsx
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const runBulk = async (action: string) => {
    const res = await fetch("/api/vault/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wordIds: [...selected], action }),
    });
    if (!res.ok) return;
    setSelected(new Set());
    // Server component đọc lại DB: refresh chứ không tự sửa state trong tay,
    // để pill trạng thái và dải tổng hợp không lệch với DB.
    router.refresh();
  };
```

Checkbox chỉ hiện khi `authed`, đặt đầu mỗi dòng trong `items.map`:

```tsx
              {authed && (
                <input
                  type="checkbox"
                  checked={selected.has(w.id)}
                  onChange={() => toggle(w.id)}
                  aria-label={w.word}
                  className="mt-1 shrink-0 accent-ember"
                />
              )}
```

Thanh hành động nổi, chỉ khi có lựa chọn:

```tsx
      {selected.size > 0 && (
        <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-40 card-atelier px-4 py-3 flex items-center gap-2 shadow-lg">
          <span className="text-sm text-soft">{t("browse.bulkSelected", { n: selected.size })}</span>
          <button onClick={() => runBulk("mark-known")} className="rounded-full border border-line px-3 py-1.5 text-xs hover:border-ember">
            {t("browse.bulkMarkKnown")}
          </button>
          <button onClick={() => runBulk("star")} className="rounded-full border border-line px-3 py-1.5 text-xs hover:border-ember">
            {t("browse.bulkStar")}
          </button>
          <button onClick={() => runBulk("reset")} className="rounded-full border border-line px-3 py-1.5 text-xs hover:border-ember">
            {t("browse.bulkReset")}
          </button>
          <button onClick={() => setSelected(new Set())} className="text-xs text-soft hover:text-ink">
            {t("browse.bulkClear")}
          </button>
        </div>
      )}
```

- [ ] **Step 8: `tsc`, test, rồi nghiệm trên app thật + DB thật**

```bash
npx tsc --noEmit
npm test
npm run dev
```

1. Chọn 2 từ → `mark-known` → mở `/notebook?tab=known` thấy đúng hai từ đó.
2. `unmark-known` một từ đã có note → hàng `WordMark` **vẫn còn** (vì còn note). Kiểm bằng `npm run db:studio`.
3. `unmark-known` một từ không note, không star → hàng bị dọn.
4. **Tiêu chí 3 của spec — đo trên DB thật:** ghi lại `UserProgress.xp`, chọn một từ đã học rồi `reset`, chạy `npm run db:backfill-xp -- --force`, đọc lại `xp` → **không đổi**. Đồng thời `Card` của từ đó có `state = 0`, `due` ≈ hiện tại, và `reps` **giữ nguyên**.
5. `curl` route với 41 id → 400; với `action: "delete-card"` → 400; không đăng nhập → 401.

```bash
curl -s -X POST localhost:3000/api/vault/bulk -H 'Content-Type: application/json' \
  -d '{"action":"delete-card","wordIds":["x"]}'
```

- [ ] **Step 9: Commit**

```bash
git add src/lib/vault/bulk.ts src/lib/vault/bulk.test.ts src/lib/vault/bulk-server.ts \
        src/app/api/vault/bulk/route.ts src/app/browse/library-client.tsx src/lib/i18n/dictionaries.ts
git commit -m "feat(vault): bulk mark and reset that never delete review history

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: `scope=weak` cho study, và export tôn trọng bộ lọc

**Files:**
- Create: `src/lib/vault/weak-server.ts`
- Modify: `src/lib/study-engine.ts` (`buildCramQueue` nhận `scope: "weak"`)
- Modify: `src/app/study/cram/page.tsx:16-20` (parse scope qua `STUDY_SCOPES`)
- Modify: `src/app/study/flashcard/page.tsx:22` (parse scope qua `STUDY_SCOPES`)
- Modify: `src/lib/export.ts` (`getExportRows` nhận `VaultFilter`)
- Modify: `src/app/api/export/route.ts` (đọc `scope`/`cefr`/`topic`/`q`)
- Modify: `src/app/settings/settings-client.tsx:67-72` (danh sách scope export)
- Modify: `src/lib/i18n/dictionaries.ts` (cả hai nhánh)

**Interfaces:**
- Consumes: `parseFilter`, `filterWhere`, `STUDY_SCOPES`, `EXPORT_SCOPES` (`@/lib/vault/scope`)
- Produces: `getWeakWordIds(userId: string, limit: number, filter: VaultFilter): Promise<string[]>`

- [ ] **Step 1: Viết `weak-server.ts`**

```ts
import "server-only";
import { prisma } from "../db";
import { STATES } from "../fsrs";
import { filterWhere, type VaultFilter } from "./scope";

// Đường CARD-FIRST: Prisma không orderBy được qua quan hệ, nên "yếu nhất" phải
// truy vấn từ Card rồi mới lấy word — cùng khuôn getLeeches() đã dùng, ngược với
// đường word-first của danh sách kho từ.
//
// "Yếu" = stability thấp: số ngày FSRS tin người học còn nhớ được. Không dùng
// lapses (đó là "khó", tức leech) và không dùng due (từ yếu thường chưa đến hạn).
export async function getWeakWordIds(
  userId: string,
  limit: number,
  filter: VaultFilter
): Promise<string[]> {
  const wordWhere = filterWhere({ ...filter, scope: "all" }, null);
  const rows = await prisma.card.findMany({
    where: {
      userId,
      state: { gte: STATES.Learning },
      ...(Object.keys(wordWhere).length ? { word: wordWhere } : {}),
    },
    select: { wordId: true },
    orderBy: [{ stability: "asc" }, { lapses: "desc" }],
    take: limit,
  });
  return rows.map((r) => r.wordId);
}
```

- [ ] **Step 2: Cho `buildCramQueue` biết `weak`**

Trong `src/lib/study-engine.ts`, mở rộng kiểu `scope` và thêm nhánh. Giữ đúng mẹo sắp lại thứ tự mà nhánh `leeches` đang dùng — `findMany` không thể order theo danh sách id, nên phải sort trong bộ nhớ rồi cắt:

```ts
export async function buildCramQueue(opts?: {
  cefr?: string;
  topic?: string;
  limit?: number;
  userId?: string;
  scope?: "starred" | "leeches" | "weak";
}): Promise<StudyWord[]> {
```

```ts
  let orderedIds: string[] | null = null;
  if (opts?.scope === "starred" && opts.userId) {
    const ids = await getStarredWordIds(opts.userId);
    where.id = { in: ids };
  } else if (opts?.scope === "leeches" && opts.userId) {
    orderedIds = await getLeechWordIds(opts.userId);
    where.id = { in: orderedIds };
  } else if (opts?.scope === "weak" && opts.userId) {
    orderedIds = await getWeakWordIds(opts.userId, opts?.limit ?? 30, {
      scope: "all", cefr: opts.cefr, topic: opts.topic,
    });
    where.id = { in: orderedIds };
  }
```

Đổi tên biến `leechOrder` thành `orderedIds` ở cả khối sắp thứ tự bên dưới (nhánh `if (leechOrder)` → `if (orderedIds)`), để hai scope dùng chung một đường chứ không sinh nhánh thứ hai làm cùng việc.

- [ ] **Step 3: Parse scope ở hai trang study qua `STUDY_SCOPES`**

```tsx
// src/app/study/cram/page.tsx
import { parseScope, STUDY_SCOPES } from "@/lib/vault/scope";

const scope = parseScope(searchParams.scope, STUDY_SCOPES) ?? undefined;
const words = await buildCramQueue({
  cefr: searchParams.cefr, topic: searchParams.topic, limit: 30, userId: user.id,
  scope: scope as "starred" | "leeches" | "weak" | undefined,
});
```

```tsx
// src/app/study/flashcard/page.tsx:22 — flashcard chỉ hỗ trợ starred (đường SRS);
// weak/leeches là drill không ghi SRS nên thuộc cram.
// `as const` là bắt buộc: mảng literal không có nó suy ra string[] chứ không phải
// readonly Scope[], và tsc sẽ từ chối.
scope: parseScope(searchParams.scope, ["starred"] as const) ?? undefined,
```

- [ ] **Step 4: Cho export nhận bộ lọc**

```ts
// src/lib/export.ts — thay parseScope/ExportScope cũ
import { filterWhere, type VaultFilter } from "./vault/scope";

export async function getExportRows(userId: string, filter: VaultFilter): Promise<ExportRow[]> {
  const words = await prisma.word.findMany({
    where: filterWhere(filter, userId),
    select: WORD_SELECT,
    orderBy: ORDER,
  });
  return words.map(toRow);
}
```

Xoá `ExportScope`, `isCefrLevel` và `parseScope` khỏi `export.ts` (đã thay bằng `parseFilter` + alias `cefr:X`). Bốn nhánh `if` cũ biến thành một query — đó chính là khoản lãi của Task 2.

```ts
// src/app/api/export/route.ts
import { parseFilter, EXPORT_SCOPES } from "@/lib/vault/scope";

const { searchParams } = new URL(req.url);
const format = searchParams.get("format");
if (format !== "csv" && format !== "anki") {
  return NextResponse.json({ error: "invalid format" }, { status: 400 });
}
const filter = parseFilter(
  {
    scope: searchParams.get("scope") ?? undefined,
    cefr: searchParams.get("cefr") ?? undefined,
    topic: searchParams.get("topic") ?? undefined,
    q: searchParams.get("q") ?? undefined,
  },
  EXPORT_SCOPES
);
const rows = await getExportRows(userId, filter);

// Tên file mô tả đúng thứ bên trong, kể cả khi lọc nhiều tầng.
const parts = [filter.scope, filter.cefr, filter.topic].filter(Boolean);
const filename = `vocab-${parts.join("-")}.${format === "csv" ? "csv" : "txt"}`;
```

Trong `settings-client.tsx`, mở rộng `scopeOptions` để dùng đúng từ vựng mới (CEFR đi bằng tham số riêng, không còn `cefr:X`):

```tsx
  const scopeOptions = [
    { key: "all", label: t("settings.exportScopeAll") },
    { key: "mine", label: t("settings.exportScopeMine") },
    { key: "starred", label: t("settings.exportScopeStarred") },
    { key: "learned", label: t("settings.exportScopeLearned") },
    { key: "known", label: t("settings.exportScopeKnown") },
    { key: "leeches", label: t("settings.exportScopeLeeches") },
  ];
  const [exportCefr, setExportCefr] = useState("ALL");
  const exportHref = (format: string) => {
    const sp = new URLSearchParams({ format, scope: exportScope });
    if (exportCefr !== "ALL") sp.set("cefr", exportCefr);
    return `/api/export?${sp.toString()}`;
  };
```

Thêm một `<select>` CEFR ngay dưới select scope, dùng `CEFR_LEVELS` (đã import trong file). Khóa i18n mới ở **cả hai** nhánh: `exportScopeMine`/`exportScopeKnown`/`exportScopeLeeches`/`exportCefr` (`vi`: "Từ của tôi" / "Đã biết" / "Từ khó" / "Bậc"; `en`: "My words" / "Known" / "Leeches" / "Level").

- [ ] **Step 5: `tsc`, test, nghiệm**

```bash
npx tsc --noEmit
npm test
npm run dev
```

1. `/browse` → `[Ôn 20 từ yếu nhất]` → phiên cram đúng ≤20 từ, và **giữ** `cefr`/`topic` đang lọc.
2. Từ có `stability` thấp nhất phải xuất hiện; kiểm chéo bằng `db:studio` sắp `Card.stability asc`.
3. `/api/export?format=csv&scope=cefr:B2` (URL kiểu **cũ**) vẫn tải về đúng bộ B2 — đây là bài kiểm alias tương thích ngược.
4. `/api/export?format=csv&scope=known&topic=medical` → chỉ từ đã biết thuộc chủ đề y tế; tên file là `vocab-known-medical.csv`.
5. `/study/cram?scope=weak` khi chưa đăng nhập → không nổ 500 (route đã đòi user).
6. Settings → chọn từng scope + bậc → tải cả CSV và Anki, mở file kiểm nội dung.

- [ ] **Step 6: Commit**

```bash
git add src/lib/vault/weak-server.ts src/lib/study-engine.ts src/app/study/cram/page.tsx \
        src/app/study/flashcard/page.tsx src/lib/export.ts src/app/api/export/route.ts \
        src/app/settings/settings-client.tsx src/lib/i18n/dictionaries.ts
git commit -m "feat(vault): drill the weakest words, and let export honor the filter

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Sau khi xong cả 6 task

- [ ] `npm test` + `npx tsc --noEmit` + `npm run build` — cả ba xanh.
- [ ] Dùng skill `superpowers:requesting-code-review` trước khi merge.
- [ ] Merge vào `main` bằng `--no-ff` hay `--ff-only` là quyết định của người chủ repo; deploy prod là **họ** chạy `vercel --prod` từ worktree sạch.
- [ ] Gói B không đổi schema, không thêm dependency, không thêm biến môi trường — nếu một task nào phát sinh một trong ba thứ đó thì có gì đã lệch khỏi spec, dừng lại và hỏi.
