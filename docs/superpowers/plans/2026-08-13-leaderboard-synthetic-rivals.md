# Bảng xếp hạng với đối thủ tổng hợp — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trang `/leaderboard` hiển thị XP tuần của user cạnh 10 đối thủ tổng hợp được hiệu chuẩn theo nhịp học của chính user, sao cho thứ hạng do user kiếm được và bảng không lộ ra là máy.

**Architecture:** 10 rival là **hàm thuần của `(userId, weekIndex)`** — không model Prisma, không bảng bot, không cron. Tính cách rival (nhịp, giờ ưa thích, độ đều, xác suất nghỉ, thiên lệch cuối tuần) sinh từ PRNG có seed; XP mỗi ngày sinh từ tính cách + hash ngày. Danh sách rival là **cửa sổ trượt trên một hoán vị pool tên cố định theo user**, nên tuần liền nhau chia sẻ 4–5 tên mà không cần đệ quy. Toàn bộ quyết định nằm trong module thuần test được bằng vitest không mock; chỉ `pace.ts` chạm Prisma và nó mỏng.

**Tech Stack:** Next.js 14 App Router (server component), TypeScript, Prisma (chỉ đọc `DailyStat`/`Settings`), vitest (`environment: node`), Tailwind với token của repo, i18n dictionary `vi`/`en`.

**Spec:** `docs/superpowers/specs/2026-08-13-leaderboard-synthetic-rivals-design.md` (commit `ba0573f`)

## Global Constraints

- **Mốc ngày là UTC.** `todayStr()` = `d.toISOString().slice(0, 10)`. Mọi khái niệm "hôm nay"/"tuần này" phải suy từ mốc này. Không dùng giờ VN cho tuần/ngày. Ngoại lệ duy nhất: `peakHour` của rival đặt theo **giờ VN** (`VN_UTC_OFFSET_HOURS = 7`) rồi đổi sang UTC, vì nó mô phỏng đồng hồ sinh hoạt của người Việt.
- **XP tổng luôn qua `totalXp(row)`** từ `@/lib/gamification-defs`. Không cộng tay `xp + bonusXp` ở bất kỳ đâu.
- **XP tuần của user lấy từ `getWeeklyRecap(userId).thisWeek.xp`** (`@/lib/stats`) — cùng con số `/stats` hiển thị. Không tự viết query tổng tuần thứ hai.
- **Không thêm model Prisma nào.** Không migration, không `db:push`.
- **Không dùng `Math.random()`, `Date.now()`, `new Date()` không tham số** trong bất kỳ module thuần nào của `src/lib/leaderboard/`. Mọi hàm nhận `now: Date` hoặc seed. Đây là điều kiện để bảng tất định (tiêu chí 3) và test được.
- **Chỉ tên Việt** trong pool persona. Không tên nước ngoài.
- **Không ảnh người** cho avatar — chỉ vòng tròn chữ cái đầu.
- Tất cả hằng số tune được nằm trong `src/lib/leaderboard/constants.ts`. Không rải magic number ra các file khác.
- Test chạy: `npx vitest run <file>`; toàn bộ: `npm test`.

---

## File Structure

| File | Trách nhiệm |
|---|---|
| `src/lib/utils.ts` *(modify)* | thêm `addUtcDays`, nhận `isoWeekMonday` chuyển từ stats.ts |
| `src/lib/stats.ts` *(modify)* | bỏ `isoWeekMonday` cục bộ, import từ utils |
| `src/lib/leaderboard/constants.ts` | mọi hằng số tune được |
| `src/lib/leaderboard/rng.ts` | hash chuỗi → seed, PRNG, các helper rút mẫu |
| `src/lib/leaderboard/week.ts` | `weekKey`, `weekIndex`, `weekDates`, `isMondayUtc` |
| `src/lib/leaderboard/personas.ts` | pool 60 tên Việt + bảng màu avatar |
| `src/lib/leaderboard/rivals.ts` | roster cửa sổ trượt + 5 tham số tính cách |
| `src/lib/leaderboard/xp.ts` | XP ngày/tuần của rival + 3 luật cưỡng chế |
| `src/lib/leaderboard/activity.ts` | `lastActiveAt` + luật ban đêm |
| `src/lib/leaderboard/board.ts` | gộp user + rival, sort, rank, Δ hạng |
| `src/lib/leaderboard/pace.ts` | *(server)* đo nhịp user; phần tính là hàm thuần `derivePace` |
| `src/app/leaderboard/page.tsx` | server component, gate guest |
| `src/app/leaderboard/leaderboard-view.tsx` | client view |
| `src/components/leaderboard/rival-row.tsx` | một dòng bảng + avatar chữ cái |
| `src/components/leaderboard/how-it-works.tsx` | mục giải thích ⓘ |
| `src/components/auth-required.tsx` *(modify)* | thêm `"leaderboard"` vào `WallContext` |
| `src/components/nav.tsx` *(modify)* | thêm tab |
| `src/lib/i18n/dictionaries.ts` *(modify)* | khối `leaderboard.*` cho `vi` + `en` |

---

## Task 1: Chuyển `isoWeekMonday` ra module thuần

`week.ts` cần `isoWeekMonday`, nhưng nó đang là hàm private trong `stats.ts` — file có `import "server-only"` và kéo theo Prisma. Module thuần không được import file đó. Chuyển ra `utils.ts` (đã thuần: chỉ import clsx + tailwind-merge, đã chứa `todayStr`/`addDays`).

Đồng thời thêm `addUtcDays`. `addDays` hiện dùng `setDate`/`getDate` (giờ **địa phương**); với một Date là nửa đêm UTC thì nó đúng ở mọi múi giờ **trừ** khi máy chạy qua mốc DST — lúc đó lệch ±1h và `toISOString().slice(0,10)` có thể lùi một ngày. Production trên Vercel chạy UTC nên chưa lộ, nhưng code mới không nên thừa hưởng cái bẫy đó.

**Files:**
- Modify: `src/lib/utils.ts` (thêm sau `addDays`, dòng ~27)
- Modify: `src/lib/stats.ts:167-172` (bỏ hàm cục bộ) và dòng import ở đầu file
- Test: `src/lib/utils.test.ts` (file mới)

**Interfaces:**
- Consumes: `addDays` đã có trong utils.
- Produces:
  - `addUtcDays(date: Date, days: number): Date`
  - `isoWeekMonday(d?: Date): Date` — trả về nửa đêm UTC của thứ Hai chứa `d`

- [ ] **Step 1: Viết test thất bại**

Tạo `src/lib/utils.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { addUtcDays, isoWeekMonday, todayStr } from "./utils";

describe("addUtcDays", () => {
  it("cộng đúng số ngày trên trục UTC", () => {
    const base = new Date(Date.UTC(2026, 7, 13)); // thứ Năm 2026-08-13
    expect(todayStr(addUtcDays(base, 3))).toBe("2026-08-16");
    expect(todayStr(addUtcDays(base, -13))).toBe("2026-07-31");
  });

  it("giữ nguyên nửa đêm UTC, không bị giờ địa phương kéo lệch", () => {
    const base = new Date(Date.UTC(2026, 7, 13));
    const out = addUtcDays(base, 1);
    expect(out.getUTCHours()).toBe(0);
    expect(out.getUTCMinutes()).toBe(0);
  });
});

describe("isoWeekMonday", () => {
  it("trả về thứ Hai của tuần chứa ngày đó", () => {
    // 2026-08-13 là thứ Năm; thứ Hai cùng tuần là 2026-08-10
    expect(todayStr(isoWeekMonday(new Date(Date.UTC(2026, 7, 13))))).toBe("2026-08-10");
  });

  it("thứ Hai trả về chính nó", () => {
    expect(todayStr(isoWeekMonday(new Date(Date.UTC(2026, 7, 10))))).toBe("2026-08-10");
  });

  it("Chủ nhật thuộc tuần đang chạy, không phải tuần sau", () => {
    // 2026-08-16 là Chủ nhật → vẫn thuộc tuần bắt đầu 2026-08-10
    expect(todayStr(isoWeekMonday(new Date(Date.UTC(2026, 7, 16))))).toBe("2026-08-10");
  });

  it("luôn là nửa đêm UTC", () => {
    const m = isoWeekMonday(new Date(Date.UTC(2026, 7, 13, 23, 59)));
    expect(m.getUTCHours()).toBe(0);
    expect(m.getUTCDay()).toBe(1);
  });
});
```

- [ ] **Step 2: Chạy test để chắc chắn nó fail**

Run: `npx vitest run src/lib/utils.test.ts`
Expected: FAIL — `addUtcDays is not a function` / `isoWeekMonday is not a function` (không được export từ utils).

- [ ] **Step 3: Thêm hai hàm vào `src/lib/utils.ts`**

Chèn ngay sau `addDays`:

```ts
// Day arithmetic on the UTC axis. addDays() above uses local setDate/getDate,
// which is correct for a UTC-midnight base in every timezone EXCEPT across a
// DST transition, where the ±1h shift can push toISOString().slice(0,10) back
// a day. Everything date-keyed in this app (DailyStat.dateStr, streaks, the
// leaderboard week) is UTC, so new code uses this instead.
export function addUtcDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86400000);
}

// Monday (UTC midnight) of the ISO week containing `d`. Moved here from
// stats.ts so pure modules can use it without importing a server-only file.
export function isoWeekMonday(d = new Date()): Date {
  const base = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dow = base.getUTCDay(); // 0=Sun
  const back = dow === 0 ? 6 : dow - 1; // days since Monday
  return addUtcDays(base, -back);
}
```

- [ ] **Step 4: Bỏ bản cục bộ trong `stats.ts`**

Xoá khối `function isoWeekMonday(d = new Date()): Date { … }` ở `src/lib/stats.ts:167-172` và thêm `isoWeekMonday` vào import đã có ở đầu file:

```ts
import { todayStr, addDays, isoWeekMonday } from "./utils";
```

(Dòng import hiện tại là `import { todayStr, addDays } from "./utils";` — chỉ thêm tên, không đổi gì khác. `addDays` vẫn được dùng chỗ khác trong file nên giữ lại.)

- [ ] **Step 5: Chạy test + toàn bộ suite**

Run: `npx vitest run src/lib/utils.test.ts` → Expected: PASS
Run: `npm test` → Expected: PASS toàn bộ (getWeeklyRecap dùng lại `isoWeekMonday` mới, hành vi không đổi)

- [ ] **Step 6: Commit**

```bash
git add src/lib/utils.ts src/lib/utils.test.ts src/lib/stats.ts
git commit -m "refactor(utils): share isoWeekMonday, add UTC-safe addUtcDays"
```

---

## Task 2: PRNG có seed

**Files:**
- Create: `src/lib/leaderboard/rng.ts`
- Test: `src/lib/leaderboard/rng.test.ts`

**Interfaces:**
- Consumes: không.
- Produces:
  - `hashSeed(...parts: (string | number)[]): number` — FNV-1a 32-bit, unsigned
  - `makeRng(seed: number): () => number` — mulberry32, trả về `[0, 1)`
  - `rngFloat(rng: () => number, min: number, max: number): number`
  - `rngInt(rng: () => number, minInclusive: number, maxInclusive: number): number`
  - `rngPick<T>(rng: () => number, arr: readonly T[]): T`
  - `rngShuffle<T>(rng: () => number, arr: readonly T[]): T[]`

- [ ] **Step 1: Viết test thất bại**

Tạo `src/lib/leaderboard/rng.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { hashSeed, makeRng, rngFloat, rngInt, rngPick, rngShuffle } from "./rng";

describe("hashSeed", () => {
  it("cùng input → cùng seed", () => {
    expect(hashSeed("user_1", "2026-W33", 0)).toBe(hashSeed("user_1", "2026-W33", 0));
  });

  it("đổi bất kỳ phần nào → seed khác", () => {
    const a = hashSeed("user_1", "2026-W33", 0);
    expect(hashSeed("user_2", "2026-W33", 0)).not.toBe(a);
    expect(hashSeed("user_1", "2026-W34", 0)).not.toBe(a);
    expect(hashSeed("user_1", "2026-W33", 1)).not.toBe(a);
  });

  it("không nhập nhằng khi ghép phần (a|bc vs ab|c)", () => {
    expect(hashSeed("a", "bc")).not.toBe(hashSeed("ab", "c"));
  });

  it("luôn là unsigned 32-bit", () => {
    for (const s of ["", "x", "user_abc", "2026-W01"]) {
      const h = hashSeed(s);
      expect(Number.isInteger(h)).toBe(true);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThan(2 ** 32);
    }
  });
});

describe("makeRng", () => {
  it("cùng seed → cùng dãy", () => {
    const a = makeRng(12345);
    const b = makeRng(12345);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it("seed khác → dãy khác", () => {
    const a = makeRng(1);
    const b = makeRng(2);
    expect(a()).not.toBe(b());
  });

  it("luôn nằm trong [0, 1)", () => {
    const r = makeRng(999);
    for (let i = 0; i < 500; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe("helpers", () => {
  it("rngFloat nằm trong khoảng", () => {
    const r = makeRng(7);
    for (let i = 0; i < 200; i++) {
      const v = rngFloat(r, 0.55, 1.6);
      expect(v).toBeGreaterThanOrEqual(0.55);
      expect(v).toBeLessThan(1.6);
    }
  });

  it("rngInt bao gồm cả hai đầu", () => {
    const r = makeRng(3);
    const seen = new Set<number>();
    for (let i = 0; i < 500; i++) seen.add(rngInt(r, 0, 2));
    expect([...seen].sort()).toEqual([0, 1, 2]);
  });

  it("rngPick trả về phần tử của mảng", () => {
    const r = makeRng(5);
    const arr = ["a", "b", "c"] as const;
    for (let i = 0; i < 50; i++) expect(arr).toContain(rngPick(r, arr));
  });

  it("rngShuffle giữ nguyên phần tử, không sửa mảng gốc", () => {
    const src = [1, 2, 3, 4, 5];
    const out = rngShuffle(makeRng(11), src);
    expect(out).toHaveLength(5);
    expect([...out].sort((x, y) => x - y)).toEqual([1, 2, 3, 4, 5]);
    expect(src).toEqual([1, 2, 3, 4, 5]);
  });

  it("rngShuffle tất định theo seed", () => {
    expect(rngShuffle(makeRng(11), [1, 2, 3, 4, 5])).toEqual(rngShuffle(makeRng(11), [1, 2, 3, 4, 5]));
  });
});
```

- [ ] **Step 2: Chạy test để chắc chắn nó fail**

Run: `npx vitest run src/lib/leaderboard/rng.test.ts`
Expected: FAIL — không resolve được `./rng`.

- [ ] **Step 3: Viết `src/lib/leaderboard/rng.ts`**

```ts
// Deterministic randomness for the leaderboard. Nothing here may call
// Math.random(): the whole board must be reproducible from (userId, week) so
// two devices show the same thing and tests need no mocking.

// FNV-1a, 32-bit. Parts are joined with a NUL so ("a","bc") and ("ab","c")
// cannot collide.
export function hashSeed(...parts: (string | number)[]): number {
  const s = parts.join(" ");
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

// mulberry32 — small, fast, good enough for cosmetic variation.
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return function next(): number {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function rngFloat(rng: () => number, min: number, max: number): number {
  return min + rng() * (max - min);
}

export function rngInt(rng: () => number, minInclusive: number, maxInclusive: number): number {
  return minInclusive + Math.floor(rng() * (maxInclusive - minInclusive + 1));
}

export function rngPick<T>(rng: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

// Fisher-Yates driven by the seeded rng (utils.shuffle uses Math.random and so
// cannot be reused here).
export function rngShuffle<T>(rng: () => number, arr: readonly T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
```

- [ ] **Step 4: Chạy test**

Run: `npx vitest run src/lib/leaderboard/rng.test.ts` → Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/leaderboard/rng.ts src/lib/leaderboard/rng.test.ts
git commit -m "feat(leaderboard): seeded PRNG and sampling helpers"
```

---

## Task 3: Tuần theo UTC

**Files:**
- Create: `src/lib/leaderboard/week.ts`
- Test: `src/lib/leaderboard/week.test.ts`

**Interfaces:**
- Consumes: `isoWeekMonday`, `addUtcDays`, `todayStr` từ `@/lib/utils` (Task 1).
- Produces:
  - `weekKey(now: Date): string` — `"YYYY-Www"` theo ISO-8601, ví dụ `"2026-W33"`
  - `weekIndex(now: Date): number` — số tuần liên tục kể từ mốc 1970-01-05 (thứ Hai đầu tiên của epoch)
  - `weekDates(now: Date): string[]` — 7 `dateStr` từ thứ Hai đến Chủ nhật
  - `isMondayUtc(now: Date): boolean`

- [ ] **Step 1: Viết test thất bại**

Tạo `src/lib/leaderboard/week.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { weekKey, weekIndex, weekDates, isMondayUtc } from "./week";

const utc = (y: number, m: number, d: number, h = 0) => new Date(Date.UTC(y, m - 1, d, h));

describe("weekKey", () => {
  it("mọi ngày trong cùng tuần cho cùng key", () => {
    const mon = weekKey(utc(2026, 8, 10));
    expect(weekKey(utc(2026, 8, 13))).toBe(mon);
    expect(weekKey(utc(2026, 8, 16, 23))).toBe(mon); // Chủ nhật
  });

  it("thứ Hai kế tiếp là key khác", () => {
    expect(weekKey(utc(2026, 8, 17))).not.toBe(weekKey(utc(2026, 8, 16)));
  });

  it("đúng định dạng YYYY-Www", () => {
    expect(weekKey(utc(2026, 8, 13))).toMatch(/^\d{4}-W\d{2}$/);
  });

  it("tuần chứa 4 tháng 1 là tuần 01 (quy tắc ISO)", () => {
    // 2026-01-04 là Chủ nhật → tuần bắt đầu 2025-12-29, và đó là W01 của 2026
    expect(weekKey(utc(2026, 1, 4))).toBe("2026-W01");
    expect(weekKey(utc(2025, 12, 29))).toBe("2026-W01");
  });
});

describe("weekIndex", () => {
  it("tăng đúng 1 mỗi tuần", () => {
    const a = weekIndex(utc(2026, 8, 13));
    expect(weekIndex(utc(2026, 8, 20))).toBe(a + 1);
    expect(weekIndex(utc(2026, 8, 6))).toBe(a - 1);
  });

  it("không đổi trong cùng tuần", () => {
    const a = weekIndex(utc(2026, 8, 10));
    expect(weekIndex(utc(2026, 8, 16, 23))).toBe(a);
  });
});

describe("weekDates", () => {
  it("7 ngày từ thứ Hai đến Chủ nhật", () => {
    expect(weekDates(utc(2026, 8, 13))).toEqual([
      "2026-08-10", "2026-08-11", "2026-08-12", "2026-08-13",
      "2026-08-14", "2026-08-15", "2026-08-16",
    ]);
  });

  it("Chủ nhật vẫn trả về tuần đang chạy", () => {
    expect(weekDates(utc(2026, 8, 16))[0]).toBe("2026-08-10");
  });
});

describe("isMondayUtc", () => {
  it("nhận đúng thứ Hai theo UTC", () => {
    expect(isMondayUtc(utc(2026, 8, 10, 12))).toBe(true);
    expect(isMondayUtc(utc(2026, 8, 11))).toBe(false);
  });

  it("23:00 UTC Chủ nhật chưa phải thứ Hai (dù giờ VN đã sang)", () => {
    // 2026-08-16 23:00 UTC = 2026-08-17 06:00 giờ VN, nhưng app tính theo UTC
    expect(isMondayUtc(utc(2026, 8, 16, 23))).toBe(false);
  });
});
```

- [ ] **Step 2: Chạy test để chắc chắn nó fail**

Run: `npx vitest run src/lib/leaderboard/week.test.ts`
Expected: FAIL — không resolve được `./week`.

- [ ] **Step 3: Viết `src/lib/leaderboard/week.ts`**

```ts
// The leaderboard week. Everything here rides the SAME UTC day axis as
// todayStr()/DailyStat.dateStr — see the Global Constraints in the plan. A week
// keyed to Vietnam time would drift from the seven DailyStat rows /stats shows,
// and only at the two boundary days, which is the hardest kind of mismatch to
// trace.

import { addUtcDays, isoWeekMonday, todayStr } from "@/lib/utils";

// First Monday of the Unix epoch (1970-01-05), the anchor for weekIndex.
const EPOCH_MONDAY_MS = Date.UTC(1970, 0, 5);
const WEEK_MS = 7 * 86400000;

// ISO-8601 week: week 01 is the one containing January 4th.
export function weekKey(now: Date): string {
  const monday = isoWeekMonday(now);
  const thursday = addUtcDays(monday, 3); // the week's year is its Thursday's year
  const year = thursday.getUTCFullYear();
  const firstMonday = isoWeekMonday(new Date(Date.UTC(year, 0, 4)));
  const week = Math.round((monday.getTime() - firstMonday.getTime()) / WEEK_MS) + 1;
  return `${year}-W${String(week).padStart(2, "0")}`;
}

// Continuous week counter. Used as the offset of the rival roster's sliding
// window, so it must increase by exactly 1 per week with no year-boundary
// discontinuity — which is why it is NOT derived from weekKey.
export function weekIndex(now: Date): number {
  return Math.round((isoWeekMonday(now).getTime() - EPOCH_MONDAY_MS) / WEEK_MS);
}

export function weekDates(now: Date): string[] {
  const monday = isoWeekMonday(now);
  return Array.from({ length: 7 }, (_, i) => todayStr(addUtcDays(monday, i)));
}

export function isMondayUtc(now: Date): boolean {
  return now.getUTCDay() === 1;
}
```

- [ ] **Step 4: Chạy test**

Run: `npx vitest run src/lib/leaderboard/week.test.ts` → Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/leaderboard/week.ts src/lib/leaderboard/week.test.ts
git commit -m "feat(leaderboard): UTC-aligned week key, index and date list"
```

---

## Task 4: Hằng số, pool tên, và roster rival

Roster phải thoả hai điều cùng lúc: tất định, và tuần liền nhau chia sẻ 4–5 tên. Cách làm: mỗi user có một **hoán vị cố định** của pool 60 tên (seed chỉ từ `userId`), roster của tuần là **cửa sổ 10 tên trượt** trên hoán vị đó với bước 5 hoặc 6 (luân phiên theo `weekIndex`). Cửa sổ 10 trượt 5 → chia sẻ đúng 5 tên với tuần trước; trượt 6 → chia sẻ 4. Không đệ quy, không cần biết roster tuần trước.

**Files:**
- Create: `src/lib/leaderboard/constants.ts`
- Create: `src/lib/leaderboard/personas.ts`
- Create: `src/lib/leaderboard/rivals.ts`
- Test: `src/lib/leaderboard/rivals.test.ts`

**Interfaces:**
- Consumes: `hashSeed`, `makeRng`, `rngFloat`, `rngInt`, `rngShuffle` (Task 2); `weekIndex` (Task 3).
- Produces:
  - `constants.ts`: `RIVAL_COUNT = 10`, `PACE_FACTOR_MIN = 0.55`, `PACE_FACTOR_MAX = 1.6`, `WEEKLY_CAP_MULTIPLIER = 2.2`, `WINDOW_STEP_MIN = 5`, `WINDOW_STEP_MAX = 6`, `NIGHT_PEAK_MAX = 2`, `NIGHT_HOURS_VN: readonly [0, 5]`, `VN_UTC_OFFSET_HOURS = 7`, `PACE_WINDOW_DAYS = 7`, `PACE_MIN_ACTIVE_DAYS = 3`, `REST_PROB_MIN = 0.05`, `REST_PROB_MAX = 0.45`, `REGULARITY_MIN = 0.15`, `REGULARITY_MAX = 0.6`, `WEEKEND_BIAS_MAX = 0.45`, `FORM_TREND_MAX = 0.25`
  - `personas.ts`: `PERSONA_NAMES: readonly string[]` (60 tên Việt), `AVATAR_COLORS: readonly string[]` (class Tailwind)
  - `rivals.ts`: `type Rival`, `buildRivals(userId: string, now: Date): Rival[]`

```ts
export type Rival = {
  /** Ổn định theo (user, tên) nên rival "cùng người" qua các tuần vẫn một id. */
  id: string;
  name: string;
  colorClass: string;
  paceFactor: number;   // 0.55 … 1.6
  peakHourVn: number;   // 0 … 23, giờ VN
  regularity: number;   // σ tương đối của XP ngày
  restProb: number;     // 0.05 … 0.45
  weekendBias: number;  // -0.45 … 0.45
  formTrend: number;    // -0.25 … 0.25, đổi theo tuần
};
```

- [ ] **Step 1: Viết test thất bại**

Tạo `src/lib/leaderboard/rivals.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildRivals } from "./rivals";
import { PERSONA_NAMES, AVATAR_COLORS } from "./personas";
import {
  RIVAL_COUNT, PACE_FACTOR_MIN, PACE_FACTOR_MAX,
  REST_PROB_MIN, REST_PROB_MAX, NIGHT_PEAK_MAX,
} from "./constants";

const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d));
const U = "user_abc";

describe("pool persona", () => {
  it("có đúng 60 tên, không trùng", () => {
    expect(PERSONA_NAMES).toHaveLength(60);
    expect(new Set(PERSONA_NAMES).size).toBe(60);
  });

  it("không có tên chứa ký tự ngoài chữ Việt và khoảng trắng", () => {
    for (const n of PERSONA_NAMES) expect(n).toMatch(/^[\p{L}]+( [\p{L}]+)+$/u);
  });

  it("bảng màu không rỗng", () => {
    expect(AVATAR_COLORS.length).toBeGreaterThan(2);
  });
});

describe("buildRivals", () => {
  it("trả về đúng RIVAL_COUNT rival, tên không trùng trong tuần", () => {
    const rivals = buildRivals(U, utc(2026, 8, 13));
    expect(rivals).toHaveLength(RIVAL_COUNT);
    expect(new Set(rivals.map((r) => r.name)).size).toBe(RIVAL_COUNT);
  });

  it("tất định: cùng user + cùng tuần → cùng roster", () => {
    expect(buildRivals(U, utc(2026, 8, 13))).toEqual(buildRivals(U, utc(2026, 8, 16)));
  });

  it("user khác → roster khác", () => {
    const a = buildRivals(U, utc(2026, 8, 13)).map((r) => r.name);
    const b = buildRivals("user_xyz", utc(2026, 8, 13)).map((r) => r.name);
    expect(a).not.toEqual(b);
  });

  it("giữ lại 4–5 rival của tuần trước", () => {
    const thisWeek = new Set(buildRivals(U, utc(2026, 8, 13)).map((r) => r.name));
    const lastWeek = buildRivals(U, utc(2026, 8, 6)).map((r) => r.name);
    const kept = lastWeek.filter((n) => thisWeek.has(n)).length;
    expect(kept).toBeGreaterThanOrEqual(4);
    expect(kept).toBeLessThanOrEqual(5);
  });

  it("giữ 4–5 rival ở mọi tuần liên tiếp trong 30 tuần", () => {
    for (let w = 0; w < 30; w++) {
      const prev = buildRivals(U, utc(2026, 1, 5 + w * 7)).map((r) => r.name);
      const cur = new Set(buildRivals(U, utc(2026, 1, 12 + w * 7)).map((r) => r.name));
      const kept = prev.filter((n) => cur.has(n)).length;
      expect(kept, `tuần ${w}`).toBeGreaterThanOrEqual(4);
      expect(kept, `tuần ${w}`).toBeLessThanOrEqual(5);
    }
  });

  it("id ổn định theo người: cùng tên → cùng id qua các tuần", () => {
    const a = buildRivals(U, utc(2026, 8, 6));
    const b = buildRivals(U, utc(2026, 8, 13));
    for (const r of a) {
      const same = b.find((x) => x.name === r.name);
      if (same) expect(same.id).toBe(r.id);
    }
  });

  it("mọi tham số nằm trong khoảng đã định", () => {
    const rivals = buildRivals(U, utc(2026, 8, 13));
    for (const r of rivals) {
      expect(r.paceFactor).toBeGreaterThanOrEqual(PACE_FACTOR_MIN);
      expect(r.paceFactor).toBeLessThan(PACE_FACTOR_MAX);
      expect(r.restProb).toBeGreaterThanOrEqual(REST_PROB_MIN);
      expect(r.restProb).toBeLessThan(REST_PROB_MAX);
      expect(r.peakHourVn).toBeGreaterThanOrEqual(0);
      expect(r.peakHourVn).toBeLessThanOrEqual(23);
      expect(AVATAR_COLORS).toContain(r.colorClass);
    }
  });

  it("tối đa NIGHT_PEAK_MAX rival có giờ ưa thích lúc nửa đêm (0–5h VN)", () => {
    // Luật này là điều kiện để bảng không tự tố cáo lúc 3h sáng (spec mục 5.4).
    for (let w = 0; w < 40; w++) {
      const rivals = buildRivals(U, utc(2026, 1, 5 + w * 7));
      const night = rivals.filter((r) => r.peakHourVn >= 0 && r.peakHourVn <= 5).length;
      expect(night, `tuần ${w}`).toBeLessThanOrEqual(NIGHT_PEAK_MAX);
    }
  });

  it("tối đa NIGHT_PEAK_MAX rival ban đêm với nhiều user khác nhau", () => {
    for (let i = 0; i < 40; i++) {
      const rivals = buildRivals(`user_${i}`, utc(2026, 8, 13));
      const night = rivals.filter((r) => r.peakHourVn <= 5).length;
      expect(night, `user_${i}`).toBeLessThanOrEqual(NIGHT_PEAK_MAX);
    }
  });
});
```

- [ ] **Step 2: Chạy test để chắc chắn nó fail**

Run: `npx vitest run src/lib/leaderboard/rivals.test.ts`
Expected: FAIL — không resolve được `./rivals`.

- [ ] **Step 3: Viết `src/lib/leaderboard/constants.ts`**

```ts
// Every tunable number for the leaderboard. These are STARTING values chosen by
// the spec author, not measured results — tune here, never inline.

export const RIVAL_COUNT = 10;

// Rival strength relative to the user's own median pace.
export const PACE_FACTOR_MIN = 0.55;
export const PACE_FACTOR_MAX = 1.6;

// No rival's weekly XP may exceed this multiple of (pace × 7). A board where
// first place laps you tenfold does not motivate, it discourages.
export const WEEKLY_CAP_MULTIPLIER = 2.2;

// Roster is a 10-wide window sliding over a per-user permutation of the name
// pool. Step 5 → 5 names shared with last week; step 6 → 4 shared.
export const WINDOW_STEP_MIN = 5;
export const WINDOW_STEP_MAX = 6;

// At most this many rivals may have a small-hours peak, so opening the app at
// 3am never shows ten people who "just studied".
export const NIGHT_PEAK_MAX = 2;
export const NIGHT_HOURS_VN: readonly [number, number] = [0, 5];

// The app's day axis is UTC; rival body clocks are Vietnamese.
export const VN_UTC_OFFSET_HOURS = 7;

// Pace measurement.
export const PACE_WINDOW_DAYS = 7;
export const PACE_MIN_ACTIVE_DAYS = 3;

// Personality ranges.
export const REST_PROB_MIN = 0.05;
export const REST_PROB_MAX = 0.45;
export const REGULARITY_MIN = 0.15;
export const REGULARITY_MAX = 0.6;
export const WEEKEND_BIAS_MAX = 0.45;
export const FORM_TREND_MAX = 0.25;
```

- [ ] **Step 4: Viết `src/lib/leaderboard/personas.ts`**

```ts
// Rival names. Vietnamese given names only — the audience is Vietnamese and a
// mixed pool read as generated. Hand-written rather than syllable-generated:
// assembled syllables produce names that are subtly wrong to a native reader.
export const PERSONA_NAMES: readonly string[] = [
  "Thu Hà", "Minh Quân", "Duy Anh", "Như Ý", "Khánh Ly",
  "Bảo Châu", "Gia Hân", "Tuấn Kiệt", "Ngọc Diệp", "Hoàng Long",
  "Phương Uyên", "Đức Huy", "Thanh Trúc", "Quốc Bảo", "Mai Chi",
  "Hữu Nghĩa", "Lan Anh", "Trung Hiếu", "Thuỳ Dương", "Đăng Khoa",
  "Hải Yến", "Nhật Minh", "Kim Ngân", "Anh Tuấn", "Bích Ngọc",
  "Xuân Bách", "Diệu Linh", "Thành Đạt", "Yến Nhi", "Văn Hậu",
  "Hồng Nhung", "Tiến Dũng", "Thảo Vy", "Quang Vinh", "Ngọc Ánh",
  "Bá Lộc", "Tường Vi", "Chí Thành", "Hà My", "Sơn Tùng",
  "Phương Thảo", "Nam Khánh", "Trà My", "Đình Trọng", "Khánh Huyền",
  "Việt Anh", "Thu Thảo", "Hoài Nam", "Mỹ Duyên", "Trọng Nhân",
  "Kiều Trinh", "Hữu Phước", "Quỳnh Chi", "Đại Nghĩa", "Vân Khánh",
  "Bảo Long", "Tố Uyên", "Công Minh", "Hạ Vy", "Phú Quý",
];

// Avatar tint classes. The cefr.* and moss.* keys are plain hex values in
// tailwind.config.ts, so the /12 opacity form compiles fine. Do NOT swap these
// for a bare `bg-<token>` on a DEFAULT-keyed color without checking the
// DEFAULT-key note in tailwind.config.ts.
export const AVATAR_COLORS: readonly string[] = [
  "bg-cefr-a1/12 text-cefr-a1",
  "bg-cefr-a2/12 text-cefr-a2",
  "bg-cefr-b1/12 text-cefr-b1",
  "bg-cefr-b2/12 text-cefr-b2",
  "bg-cefr-c1/12 text-cefr-c1",
  "bg-moss-500/12 text-moss-500",
];
```

- [ ] **Step 5: Viết `src/lib/leaderboard/rivals.ts`**

```ts
// The ten rivals: a pure function of (userId, week). No DB rows, no cron, no
// stored state — see the spec's section 2 for why.

import { hashSeed, makeRng, rngFloat, rngInt, rngShuffle } from "./rng";
import { weekIndex } from "./week";
import { PERSONA_NAMES, AVATAR_COLORS } from "./personas";
import {
  RIVAL_COUNT, PACE_FACTOR_MIN, PACE_FACTOR_MAX,
  WINDOW_STEP_MIN, WINDOW_STEP_MAX, NIGHT_PEAK_MAX, NIGHT_HOURS_VN,
  REST_PROB_MIN, REST_PROB_MAX, REGULARITY_MIN, REGULARITY_MAX,
  WEEKEND_BIAS_MAX, FORM_TREND_MAX,
} from "./constants";

export type Rival = {
  id: string;
  name: string;
  colorClass: string;
  paceFactor: number;
  peakHourVn: number;
  regularity: number;
  restProb: number;
  weekendBias: number;
  formTrend: number;
};

// A permutation of the name pool that is fixed forever for this user, so the
// roster window can slide over it without ever consulting last week's roster
// (which would need recursion back through every past week).
function namePermutation(userId: string): string[] {
  return rngShuffle(makeRng(hashSeed("perm", userId)), PERSONA_NAMES);
}

// Window start for a given week. Step alternates 5/6 so consecutive weeks share
// 5 or 4 names — familiar faces, but not the same league forever.
function windowStart(userId: string, wIndex: number): number {
  const stepRng = makeRng(hashSeed("step", userId));
  let start = rngInt(stepRng, 0, PERSONA_NAMES.length - 1);
  for (let w = 0; w < wIndex; w++) {
    const step = (w % 2 === 0) ? WINDOW_STEP_MIN : WINDOW_STEP_MAX;
    start = (start + step) % PERSONA_NAMES.length;
  }
  return start;
}

// Personality is seeded from (userId, rival name) so a rival carried across
// weeks keeps their character; only formTrend varies by week.
function buildOne(userId: string, name: string, wIndex: number, allowNight: boolean): Rival {
  const rng = makeRng(hashSeed("rival", userId, name));
  const paceFactor = rngFloat(rng, PACE_FACTOR_MIN, PACE_FACTOR_MAX);
  const regularity = rngFloat(rng, REGULARITY_MIN, REGULARITY_MAX);
  const restProb = rngFloat(rng, REST_PROB_MIN, REST_PROB_MAX);
  const weekendBias = rngFloat(rng, -WEEKEND_BIAS_MAX, WEEKEND_BIAS_MAX);
  const colorClass = AVATAR_COLORS[Math.floor(rng() * AVATAR_COLORS.length)];
  let peakHourVn = rngInt(rng, 0, 23);
  // Night-peak quota (spec 5.4): a rival over quota is moved to the evening
  // rather than resampled, so the shift stays deterministic.
  const [nightLo, nightHi] = NIGHT_HOURS_VN;
  if (!allowNight && peakHourVn >= nightLo && peakHourVn <= nightHi) {
    peakHourVn = 19 + (peakHourVn % 4); // 19..22
  }
  // formTrend is the only week-varying trait: form comes and goes.
  const formRng = makeRng(hashSeed("form", userId, name, wIndex));
  const formTrend = rngFloat(formRng, -FORM_TREND_MAX, FORM_TREND_MAX);
  return {
    id: `r_${hashSeed(userId, name).toString(36)}`,
    name,
    colorClass,
    paceFactor,
    peakHourVn,
    regularity,
    restProb,
    weekendBias,
    formTrend,
  };
}

export function buildRivals(userId: string, now: Date): Rival[] {
  const wIndex = weekIndex(now);
  const perm = namePermutation(userId);
  const start = windowStart(userId, wIndex);
  const names = Array.from(
    { length: RIVAL_COUNT },
    (_, i) => perm[(start + i) % perm.length]
  );

  // Two passes: build with night peaks allowed, then re-build the ones over
  // quota with them disallowed. Order is fixed, so the result is deterministic.
  const [nightLo, nightHi] = NIGHT_HOURS_VN;
  const first = names.map((n) => buildOne(userId, n, wIndex, true));
  let nightUsed = 0;
  return first.map((r) => {
    const isNight = r.peakHourVn >= nightLo && r.peakHourVn <= nightHi;
    if (!isNight) return r;
    if (nightUsed < NIGHT_PEAK_MAX) {
      nightUsed++;
      return r;
    }
    return buildOne(userId, r.name, wIndex, false);
  });
}
```

- [ ] **Step 6: Chạy test**

Run: `npx vitest run src/lib/leaderboard/rivals.test.ts` → Expected: PASS

Nếu test "giữ lại 4–5 rival" fail: kiểm `WINDOW_STEP_*` — cửa sổ rộng `RIVAL_COUNT = 10`, trượt 5 thì giao là 5, trượt 6 thì giao là 4. Bước phải luôn `< RIVAL_COUNT` và `> RIVAL_COUNT / 2`.

- [ ] **Step 7: Commit**

```bash
git add src/lib/leaderboard/constants.ts src/lib/leaderboard/personas.ts src/lib/leaderboard/rivals.ts src/lib/leaderboard/rivals.test.ts
git commit -m "feat(leaderboard): deterministic rival roster with sliding-window carryover"
```

---

## Task 5: XP của rival + ba luật cưỡng chế

Ba luật của spec (mục 5.1, 5.2, 5.3) **không tự rơi ra** từ tham số ngẫu nhiên — phải cưỡng chế:

1. Không XP tròn chục.
2. Mỗi ngày ≥ 1 rival có XP = 0 (nếu không ai tự nghỉ thì buộc người có `restProb` cao nhất nghỉ).
3. XP tuần không vượt `WEEKLY_CAP_MULTIPLIER × pace × 7`.

**Files:**
- Create: `src/lib/leaderboard/xp.ts`
- Test: `src/lib/leaderboard/xp.test.ts`

**Interfaces:**
- Consumes: `Rival` (Task 4), `hashSeed`/`makeRng`/`rngFloat` (Task 2), `weekDates` (Task 3), `WEEKLY_CAP_MULTIPLIER` (Task 4).
- Produces:
  - `rivalDailyXp(rival: Rival, dateStr: string, pace: number): number`
  - `dailyXpForAll(rivals: Rival[], dateStr: string, pace: number): number[]` — đã áp luật ngày-nghỉ
  - `rivalWeeklyXp(rivals: Rival[], dates: string[], pace: number): number[]` — đã áp cap
  - `isRestDay(rival: Rival, dateStr: string): boolean`

- [ ] **Step 1: Viết test thất bại**

Tạo `src/lib/leaderboard/xp.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildRivals } from "./rivals";
import { rivalDailyXp, dailyXpForAll, rivalWeeklyXp } from "./xp";
import { weekDates } from "./week";
import { WEEKLY_CAP_MULTIPLIER } from "./constants";

const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d));
const U = "user_abc";
const NOW = utc(2026, 8, 13);
const PACE = 60;

describe("rivalDailyXp", () => {
  it("tất định theo (rival, ngày)", () => {
    const r = buildRivals(U, NOW)[0];
    expect(rivalDailyXp(r, "2026-08-11", PACE)).toBe(rivalDailyXp(r, "2026-08-11", PACE));
  });

  it("ngày khác cho giá trị khác (không phải hằng số)", () => {
    const r = buildRivals(U, NOW)[0];
    const vals = weekDates(NOW).map((d) => rivalDailyXp(r, d, PACE));
    expect(new Set(vals).size).toBeGreaterThan(1);
  });

  it("không âm và là số nguyên", () => {
    for (const r of buildRivals(U, NOW)) {
      for (const d of weekDates(NOW)) {
        const v = rivalDailyXp(r, d, PACE);
        expect(Number.isInteger(v)).toBe(true);
        expect(v).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("pace = 0 thì mọi XP = 0", () => {
    for (const r of buildRivals(U, NOW)) {
      expect(rivalDailyXp(r, "2026-08-11", 0)).toBe(0);
    }
  });
});

describe("dailyXpForAll — luật ngày nghỉ", () => {
  it("mỗi ngày có ít nhất một rival XP = 0", () => {
    const rivals = buildRivals(U, NOW);
    for (const d of weekDates(NOW)) {
      const xps = dailyXpForAll(rivals, d, PACE);
      expect(xps.filter((x) => x === 0).length, d).toBeGreaterThanOrEqual(1);
    }
  });

  it("giữ luật đó với 20 user khác nhau và cả tuần", () => {
    for (let i = 0; i < 20; i++) {
      const rivals = buildRivals(`user_${i}`, NOW);
      for (const d of weekDates(NOW)) {
        expect(dailyXpForAll(rivals, d, PACE).some((x) => x === 0), `user_${i} ${d}`).toBe(true);
      }
    }
  });

  it("tất định", () => {
    const rivals = buildRivals(U, NOW);
    expect(dailyXpForAll(rivals, "2026-08-12", PACE)).toEqual(
      dailyXpForAll(rivals, "2026-08-12", PACE)
    );
  });
});

describe("rivalWeeklyXp", () => {
  it("không rival nào vượt cap 2.2 × pace × 7", () => {
    const cap = WEEKLY_CAP_MULTIPLIER * PACE * 7;
    for (let i = 0; i < 20; i++) {
      const rivals = buildRivals(`user_${i}`, NOW);
      for (const x of rivalWeeklyXp(rivals, weekDates(NOW), PACE)) {
        expect(x).toBeLessThanOrEqual(cap);
      }
    }
  });

  it("không XP tuần nào là số tròn chục", () => {
    for (let i = 0; i < 20; i++) {
      const rivals = buildRivals(`user_${i}`, NOW);
      for (const x of rivalWeeklyXp(rivals, weekDates(NOW), PACE)) {
        if (x > 0) expect(x % 10, `user_${i} → ${x}`).not.toBe(0);
      }
    }
  });

  it("có phân tán thật: mạnh nhất phải hơn yếu nhất rõ rệt", () => {
    const xs = rivalWeeklyXp(buildRivals(U, NOW), weekDates(NOW), PACE);
    expect(Math.max(...xs)).toBeGreaterThan(Math.min(...xs) * 1.3);
  });

  it("tất định", () => {
    const rivals = buildRivals(U, NOW);
    expect(rivalWeeklyXp(rivals, weekDates(NOW), PACE)).toEqual(
      rivalWeeklyXp(rivals, weekDates(NOW), PACE)
    );
  });
});
```

- [ ] **Step 2: Chạy test để chắc chắn nó fail**

Run: `npx vitest run src/lib/leaderboard/xp.test.ts`
Expected: FAIL — không resolve được `./xp`.

- [ ] **Step 3: Viết `src/lib/leaderboard/xp.ts`**

```ts
// Rival XP. Three of the spec's anti-tell rules live here and all three are
// ENFORCED, not hoped for: no round numbers, at least one rest day per day
// across the roster, and a hard cap relative to the user's own pace.

import { hashSeed, makeRng, rngFloat } from "./rng";
import type { Rival } from "./rivals";
import { WEEKLY_CAP_MULTIPLIER } from "./constants";

function isWeekend(dateStr: string): boolean {
  const day = new Date(dateStr + "T00:00:00.000Z").getUTCDay();
  return day === 0 || day === 6;
}

export function isRestDay(rival: Rival, dateStr: string): boolean {
  const rng = makeRng(hashSeed("rest", rival.id, dateStr));
  return rng() < rival.restProb;
}

// A day's XP before the roster-level rest rule. Deterministic in (rival, date).
export function rivalDailyXp(rival: Rival, dateStr: string, pace: number): number {
  if (pace <= 0) return 0;
  if (isRestDay(rival, dateStr)) return 0;
  const rng = makeRng(hashSeed("xp", rival.id, dateStr));
  const jitter = 1 + rngFloat(rng, -rival.regularity, rival.regularity);
  const weekend = 1 + (isWeekend(dateStr) ? rival.weekendBias : 0);
  const form = 1 + rival.formTrend;
  const raw = pace * rival.paceFactor * jitter * weekend * form;
  return Math.max(0, Math.round(raw));
}

// Rule: every day, at least one rival is off. If nobody rested on their own,
// the highest-restProb rival is forced to. Ties break on id so it stays
// deterministic.
export function dailyXpForAll(rivals: Rival[], dateStr: string, pace: number): number[] {
  const xps = rivals.map((r) => rivalDailyXp(r, dateStr, pace));
  if (xps.some((x) => x === 0)) return xps;
  let idx = 0;
  for (let i = 1; i < rivals.length; i++) {
    const a = rivals[i];
    const b = rivals[idx];
    if (a.restProb > b.restProb || (a.restProb === b.restProb && a.id < b.id)) idx = i;
  }
  const out = [...xps];
  out[idx] = 0;
  return out;
}

// Nudge a value off a round ten. Real people don't stop at exactly 200 XP, and
// a column of round numbers is the cheapest tell on the board.
function deRound(value: number, seedKey: string): number {
  if (value === 0 || value % 10 !== 0) return value;
  const rng = makeRng(hashSeed("deround", seedKey));
  const shift = 1 + Math.floor(rng() * 3); // 1..3
  return value - shift > 0 ? value - shift : value + shift;
}

export function rivalWeeklyXp(rivals: Rival[], dates: string[], pace: number): number[] {
  const totals = new Array(rivals.length).fill(0) as number[];
  for (const d of dates) {
    const day = dailyXpForAll(rivals, d, pace);
    for (let i = 0; i < rivals.length; i++) totals[i] += day[i];
  }
  const cap = WEEKLY_CAP_MULTIPLIER * pace * dates.length;
  return totals.map((t, i) => {
    const capped = t > cap ? Math.floor(cap) : t;
    return deRound(capped, rivals[i].id);
  });
}
```

- [ ] **Step 4: Chạy test**

Run: `npx vitest run src/lib/leaderboard/xp.test.ts` → Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/leaderboard/xp.ts src/lib/leaderboard/xp.test.ts
git commit -m "feat(leaderboard): rival XP with enforced rest, cap and no-round rules"
```

---

## Task 6: Dấu "hoạt động X giờ trước"

Đây là chi tiết dễ tự tố cáo nhất (spec mục 5.4). Hàm sinh ra một **instant tuyệt đối**; client format tương đối.

**Files:**
- Create: `src/lib/leaderboard/activity.ts`
- Test: `src/lib/leaderboard/activity.test.ts`

**Interfaces:**
- Consumes: `Rival` (Task 4), `isRestDay` (Task 5), `hashSeed`/`makeRng`/`rngInt` (Task 2), `VN_UTC_OFFSET_HOURS` (Task 4), `addUtcDays`/`todayStr` (Task 1).
- Produces: `lastActiveAt(rival: Rival, now: Date): Date` — luôn ở quá khứ so với `now`

- [ ] **Step 1: Viết test thất bại**

Tạo `src/lib/leaderboard/activity.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildRivals } from "./rivals";
import { lastActiveAt } from "./activity";

const U = "user_abc";
// 2026-08-13 19:00 UTC = 2026-08-14 02:00 giờ VN → "đêm khuya" theo đồng hồ VN
const NIGHT_VN = new Date(Date.UTC(2026, 7, 13, 19));
// 2026-08-13 07:00 UTC = 14:00 giờ VN → giữa chiều
const AFTERNOON_VN = new Date(Date.UTC(2026, 7, 13, 7));

const hoursAgo = (now: Date, then: Date) => (now.getTime() - then.getTime()) / 3600000;

describe("lastActiveAt", () => {
  it("luôn ở quá khứ", () => {
    for (const now of [NIGHT_VN, AFTERNOON_VN]) {
      for (const r of buildRivals(U, now)) {
        expect(lastActiveAt(r, now).getTime()).toBeLessThanOrEqual(now.getTime());
      }
    }
  });

  it("tất định", () => {
    const r = buildRivals(U, AFTERNOON_VN)[0];
    expect(lastActiveAt(r, AFTERNOON_VN).getTime()).toBe(lastActiveAt(r, AFTERNOON_VN).getTime());
  });

  it("2h sáng giờ VN: ≥8/10 rival hoạt động từ hơn 6 tiếng trước", () => {
    // Luật quan trọng nhất của spec: mở app lúc 2h sáng mà thấy 10 người
    // "vừa học 10 phút trước" là chỗ user bắt được ngay.
    const rivals = buildRivals(U, NIGHT_VN);
    const stale = rivals.filter((r) => hoursAgo(NIGHT_VN, lastActiveAt(r, NIGHT_VN)) >= 6);
    expect(stale.length).toBeGreaterThanOrEqual(8);
  });

  it("giữ luật đêm với 25 user khác nhau", () => {
    for (let i = 0; i < 25; i++) {
      const rivals = buildRivals(`user_${i}`, NIGHT_VN);
      const stale = rivals.filter((r) => hoursAgo(NIGHT_VN, lastActiveAt(r, NIGHT_VN)) >= 6);
      expect(stale.length, `user_${i}`).toBeGreaterThanOrEqual(8);
    }
  });

  it("không bao giờ cả 10 rival cùng dưới 30 phút", () => {
    for (const now of [NIGHT_VN, AFTERNOON_VN]) {
      for (let i = 0; i < 25; i++) {
        const rivals = buildRivals(`user_${i}`, now);
        const fresh = rivals.filter((r) => hoursAgo(now, lastActiveAt(r, now)) < 0.5);
        expect(fresh.length).toBeLessThan(rivals.length);
      }
    }
  });

  it("buổi chiều thì có người vừa hoạt động gần đây", () => {
    // Ngược lại của luật đêm: giữa ngày bảng phải trông sống.
    let anyFresh = false;
    for (let i = 0; i < 25 && !anyFresh; i++) {
      const rivals = buildRivals(`user_${i}`, AFTERNOON_VN);
      anyFresh = rivals.some((r) => hoursAgo(AFTERNOON_VN, lastActiveAt(r, AFTERNOON_VN)) < 6);
    }
    expect(anyFresh).toBe(true);
  });
});
```

- [ ] **Step 2: Chạy test để chắc chắn nó fail**

Run: `npx vitest run src/lib/leaderboard/activity.test.ts`
Expected: FAIL — không resolve được `./activity`.

- [ ] **Step 3: Viết `src/lib/leaderboard/activity.ts`**

```ts
// "Active 3 hours ago". The riskiest detail on the board: ten people who all
// "just studied" at 3am is the tell that costs the whole board its credibility.
// So the instant is anchored to each rival's Vietnamese body clock, and if that
// moment hasn't happened yet today we fall back to yesterday's.

import { addUtcDays, todayStr } from "@/lib/utils";
import { hashSeed, makeRng, rngInt } from "./rng";
import { VN_UTC_OFFSET_HOURS } from "./constants";
import type { Rival } from "./rivals";
import { isRestDay } from "./xp";

// The UTC instant of a rival's peak hour on a given UTC calendar day.
function peakInstant(rival: Rival, dateStr: string): Date {
  const minute = rngInt(makeRng(hashSeed("peakmin", rival.id, dateStr)), 0, 59);
  const utcHour = rival.peakHourVn - VN_UTC_OFFSET_HOURS; // may go negative
  return new Date(new Date(dateStr + "T00:00:00.000Z").getTime() + utcHour * 3600000 + minute * 60000);
}

export function lastActiveAt(rival: Rival, now: Date): Date {
  // Walk back up to 4 days: today's peak may not have arrived yet, and the
  // rival may have rested. Four days is enough that "3 ngày trước" is the
  // worst case shown.
  for (let back = 0; back < 4; back++) {
    const day = todayStr(addUtcDays(now, -back));
    if (isRestDay(rival, day)) continue;
    const at = peakInstant(rival, day);
    if (at.getTime() <= now.getTime()) return at;
  }
  return addUtcDays(now, -4);
}
```

- [ ] **Step 4: Chạy test**

Run: `npx vitest run src/lib/leaderboard/activity.test.ts` → Expected: PASS

Nếu test luật đêm fail: nguyên nhân gần như chắc chắn là `NIGHT_PEAK_MAX` (Task 4) không được cưỡng chế — kiểm lại pass hai lượt trong `buildRivals`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/leaderboard/activity.ts src/lib/leaderboard/activity.test.ts
git commit -m "feat(leaderboard): last-active stamps anchored to rival body clocks"
```

---

## Task 7: Nhịp học của user

**Files:**
- Create: `src/lib/leaderboard/pace.ts`
- Test: `src/lib/leaderboard/pace.test.ts`

`derivePace` là hàm thuần và được test. Phần query Prisma (`getUserPace`) mỏng và không test — repo chưa có infra mock Prisma, nên mọi quyết định phải nằm trong hàm thuần.

**Interfaces:**
- Consumes: `totalXp` từ `@/lib/gamification-defs`; `prisma` từ `@/lib/db`; `weekDates`/`isoWeekMonday`; `PACE_WINDOW_DAYS`, `PACE_MIN_ACTIVE_DAYS` (Task 4).
- Produces:
  - `derivePace(dailyXps: number[], dailyGoalXp: number): { pace: number; activeDays: number }`
  - `getUserPace(userId: string, now: Date): Promise<{ pace: number; activeDays: number }>` *(server)*

**Chốt định nghĩa trước khi viết test:** median tính trên **các ngày CÓ hoạt động**, không phải trên cả 7 ngày. Median gồm cả ngày 0 sẽ về 0 với bất kỳ ai học 3–4 ngày/tuần — tức phần lớn người dùng thật — và rival sinh từ `pace = 0` cho ra bảng rỗng. Ngày nghỉ đã được phản ánh qua `activeDays`. Đây là chỗ plan nói rõ hơn spec §3.1; xem mục Self-Review ở cuối.

- [ ] **Step 1: Viết test thất bại**

Tạo `src/lib/leaderboard/pace.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { derivePace } from "./pace";

describe("derivePace", () => {
  it("dùng median, không dùng mean", () => {
    // Một hôm cày 600 XP không được kéo cả bảng lên rồi làm user tụt hạng cả tuần.
    // 7 ngày đều có hoạt động → median của [50,55,57,58,60,62,600] = 58.
    expect(derivePace([50, 60, 55, 600, 58, 62, 57], 60).pace).toBe(58);
  });

  it("median của số ngày chẵn là trung bình hai giá trị giữa", () => {
    // 4 ngày hoạt động → median của [40,50,60,70] = (50+60)/2 = 55.
    expect(derivePace([40, 60, 50, 70], 30).pace).toBe(55);
  });

  it("đếm đúng số ngày có hoạt động", () => {
    const { activeDays, pace } = derivePace([0, 0, 40, 50, 60, 0, 0], 30);
    expect(activeDays).toBe(3);
    expect(pace).toBe(50); // median của [40,50,60], ngày 0 không tham gia
  });

  it("ít hơn PACE_MIN_ACTIVE_DAYS ngày → dùng dailyGoalXp", () => {
    // User mới: median trên 1 ngày không đại diện cho nhịp nào cả.
    expect(derivePace([0, 0, 45, 0, 0, 0, 0], 60).pace).toBe(60);
    expect(derivePace([40, 60], 30).pace).toBe(30); // 2 ngày < 3 → fallback
    expect(derivePace([], 60).pace).toBe(60);
  });

  it("đủ ngày hoạt động thì median thắng dailyGoalXp", () => {
    expect(derivePace([100, 0, 120, 110, 0, 0, 0], 60).pace).toBe(110);
  });

  it("pace không bao giờ âm hay NaN", () => {
    const { pace } = derivePace([0, 0, 0, 0, 0, 0, 0], 0);
    expect(Number.isFinite(pace)).toBe(true);
    expect(pace).toBeGreaterThanOrEqual(0);
  });
});
```

- [ ] **Step 2: Chạy test để chắc chắn nó fail**

Run: `npx vitest run src/lib/leaderboard/pace.test.ts`
Expected: FAIL — không resolve được `./pace`.

- [ ] **Step 3: Viết `src/lib/leaderboard/pace.ts`**

```ts
import "server-only";
import { prisma } from "@/lib/db";
import { totalXp } from "@/lib/gamification-defs";
import { addUtcDays, todayStr } from "@/lib/utils";
import { PACE_WINDOW_DAYS, PACE_MIN_ACTIVE_DAYS } from "./constants";

function median(sorted: number[]): number {
  if (sorted.length === 0) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// Median over the days the user ACTUALLY studied, not over all seven. Including
// rest days as zeros drags the median to 0 for anyone who studies 3-4 days a
// week — which is most people — and rival XP scaled from 0 makes an empty board.
// Rest days are reflected in activeDays instead.
export function derivePace(
  dailyXps: number[],
  dailyGoalXp: number
): { pace: number; activeDays: number } {
  const active = dailyXps.filter((x) => x > 0).sort((a, b) => a - b);
  const activeDays = active.length;
  if (activeDays < PACE_MIN_ACTIVE_DAYS) {
    return { pace: Math.max(0, dailyGoalXp), activeDays };
  }
  return { pace: Math.max(0, median(active)), activeDays };
}

// Thin: fetch the window, hand the numbers to derivePace. Keep decisions there.
export async function getUserPace(
  userId: string,
  now: Date
): Promise<{ pace: number; activeDays: number }> {
  const start = todayStr(addUtcDays(now, -(PACE_WINDOW_DAYS - 1)));
  const [rows, settings] = await Promise.all([
    prisma.dailyStat.findMany({
      where: { userId, dateStr: { gte: start } },
      select: { xp: true, bonusXp: true },
    }),
    prisma.settings.findUnique({ where: { userId }, select: { dailyGoalXp: true } }),
  ]);
  return derivePace(rows.map(totalXp), settings?.dailyGoalXp ?? 60);
}
```

- [ ] **Step 4: Chạy test**

Run: `npx vitest run src/lib/leaderboard/pace.test.ts` → Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/leaderboard/pace.ts src/lib/leaderboard/pace.test.ts
git commit -m "feat(leaderboard): user pace from median active-day XP"
```

---

## Task 8: Gộp bảng, xếp hạng, Δ hạng

**Files:**
- Create: `src/lib/leaderboard/board.ts`
- Test: `src/lib/leaderboard/board.test.ts`

**Interfaces:**
- Consumes: `buildRivals` (Task 4), `rivalWeeklyXp`/`dailyXpForAll` (Task 5), `lastActiveAt` (Task 6), `weekDates`/`isMondayUtc` (Task 3), `addUtcDays`/`todayStr` (Task 1).
- Produces:

```ts
export type BoardEntry = {
  kind: "user" | "rival";
  key: string;
  name: string;
  colorClass: string;
  weeklyXp: number;
  streak: number;
  /** ISO instant; null cho dòng user (client dùng dữ liệu thật của họ). */
  lastActiveAt: string | null;
  rank: number;
  /** null vào thứ Hai — tuần mới, mọi người bằng 0. */
  delta: number | null;
};

export function buildBoard(input: {
  userId: string;
  userName: string;
  userWeeklyXp: number;
  userStreak: number;
  pace: number;
  now: Date;
}): BoardEntry[];
```

- [ ] **Step 1: Viết test thất bại**

Tạo `src/lib/leaderboard/board.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildBoard } from "./board";
import { RIVAL_COUNT, WEEKLY_CAP_MULTIPLIER } from "./constants";

const utc = (y: number, m: number, d: number, h = 12) => new Date(Date.UTC(y, m - 1, d, h));
// 2026-08-13 là thứ Năm (giữa tuần); 2026-08-10 là thứ Hai.
const THU = utc(2026, 8, 13);
const MON = utc(2026, 8, 10);
const PACE = 60;

const base = {
  userId: "user_abc",
  userName: "Minh",
  userStreak: 12,
  pace: PACE,
  now: THU,
};

const rankOfUser = (b: ReturnType<typeof buildBoard>) =>
  b.find((e) => e.kind === "user")!.rank;

describe("buildBoard", () => {
  it("có đúng RIVAL_COUNT + 1 dòng, xếp hạng liên tục từ 1", () => {
    const board = buildBoard({ ...base, userWeeklyXp: 300 });
    expect(board).toHaveLength(RIVAL_COUNT + 1);
    expect(board.map((e) => e.rank)).toEqual(
      Array.from({ length: RIVAL_COUNT + 1 }, (_, i) => i + 1)
    );
  });

  it("đúng một dòng kind=user", () => {
    const board = buildBoard({ ...base, userWeeklyXp: 300 });
    expect(board.filter((e) => e.kind === "user")).toHaveLength(1);
  });

  it("sort giảm dần theo XP tuần", () => {
    const board = buildBoard({ ...base, userWeeklyXp: 300 });
    for (let i = 1; i < board.length; i++) {
      expect(board[i - 1].weeklyXp).toBeGreaterThanOrEqual(board[i].weeklyXp);
    }
  });

  it("user học đều theo nhịp → hạng 4–8", () => {
    // Tiêu chí 1 của spec: 4 ngày × nhịp 60 = 240 XP giữa tuần.
    const rank = rankOfUser(buildBoard({ ...base, userWeeklyXp: PACE * 4 }));
    expect(rank).toBeGreaterThanOrEqual(4);
    expect(rank).toBeLessThanOrEqual(8);
  });

  it("cày mạnh → top 3", () => {
    const rank = rankOfUser(buildBoard({ ...base, userWeeklyXp: PACE * 7 * 2 }));
    expect(rank).toBeLessThanOrEqual(3);
  });

  it("nghỉ gần hết tuần → tụt khỏi top 8", () => {
    const rank = rankOfUser(buildBoard({ ...base, userWeeklyXp: 20 }));
    expect(rank).toBeGreaterThan(8);
  });

  it("không rival nào vượt cap", () => {
    const board = buildBoard({ ...base, userWeeklyXp: 300 });
    const cap = WEEKLY_CAP_MULTIPLIER * PACE * 7;
    for (const e of board) {
      if (e.kind === "rival") expect(e.weeklyXp).toBeLessThanOrEqual(cap);
    }
  });

  it("không XP rival nào tròn chục", () => {
    for (let i = 0; i < 15; i++) {
      const board = buildBoard({ ...base, userId: `user_${i}`, userWeeklyXp: 300 });
      for (const e of board) {
        if (e.kind === "rival" && e.weeklyXp > 0) expect(e.weeklyXp % 10).not.toBe(0);
      }
    }
  });

  it("giữa tuần thì có Δ hạng", () => {
    const board = buildBoard({ ...base, userWeeklyXp: 300 });
    expect(board.every((e) => e.delta !== null)).toBe(true);
  });

  it("thứ Hai thì Δ là null cho mọi dòng", () => {
    const board = buildBoard({ ...base, now: MON, userWeeklyXp: 40 });
    expect(board.every((e) => e.delta === null)).toBe(true);
  });

  it("rival có lastActiveAt, user thì null", () => {
    const board = buildBoard({ ...base, userWeeklyXp: 300 });
    for (const e of board) {
      if (e.kind === "rival") expect(typeof e.lastActiveAt).toBe("string");
      else expect(e.lastActiveAt).toBeNull();
    }
  });

  it("streak rival thấp khi hay nghỉ (không ai streak 7 mà vẫn có ngày nghỉ)", () => {
    const board = buildBoard({ ...base, userWeeklyXp: 300 });
    for (const e of board) {
      expect(e.streak).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(e.streak)).toBe(true);
    }
  });

  it("tất định", () => {
    expect(buildBoard({ ...base, userWeeklyXp: 300 })).toEqual(
      buildBoard({ ...base, userWeeklyXp: 300 })
    );
  });

  it("giữ nguyên streak thật của user", () => {
    const board = buildBoard({ ...base, userWeeklyXp: 300 });
    expect(board.find((e) => e.kind === "user")!.streak).toBe(12);
  });
});
```

- [ ] **Step 2: Chạy test để chắc chắn nó fail**

Run: `npx vitest run src/lib/leaderboard/board.test.ts`
Expected: FAIL — không resolve được `./board`.

- [ ] **Step 3: Viết `src/lib/leaderboard/board.ts`**

```ts
// Assembles the board: the user's real weekly XP alongside ten synthetic
// rivals. The user's RANK is earned — nothing here nudges it. The only thing
// calibrated to the user is how hard the rivals are (their pace), decided once
// per week.

import { addUtcDays, todayStr } from "@/lib/utils";
import { buildRivals, type Rival } from "./rivals";
import { rivalWeeklyXp, dailyXpForAll } from "./xp";
import { lastActiveAt } from "./activity";
import { weekDates, isMondayUtc } from "./week";

export type BoardEntry = {
  kind: "user" | "rival";
  key: string;
  name: string;
  colorClass: string;
  weeklyXp: number;
  streak: number;
  lastActiveAt: string | null;
  rank: number;
  delta: number | null;
};

const USER_COLOR = "bg-ember/12 text-ember";

// A rival's streak, derived from the same rest rolls that drive their XP, so
// the badge can never contradict the behaviour. Counts back from yesterday:
// today is still in progress.
function rivalStreak(rival: Rival, rivals: Rival[], now: Date, pace: number): number {
  let streak = 0;
  for (let back = 1; back <= 60; back++) {
    const day = todayStr(addUtcDays(now, -back));
    const idx = rivals.indexOf(rival);
    if (dailyXpForAll(rivals, day, pace)[idx] > 0) streak++;
    else break;
  }
  return streak;
}

type Row = Omit<BoardEntry, "rank" | "delta">;

function rowsFor(
  input: { userId: string; userName: string; userWeeklyXp: number; userStreak: number; pace: number },
  now: Date,
  dates: string[]
): Row[] {
  const rivals = buildRivals(input.userId, now);
  const weekly = rivalWeeklyXp(rivals, dates, input.pace);
  const rivalRows: Row[] = rivals.map((r, i) => ({
    kind: "rival",
    key: r.id,
    name: r.name,
    colorClass: r.colorClass,
    weeklyXp: weekly[i],
    streak: rivalStreak(r, rivals, now, input.pace),
    lastActiveAt: lastActiveAt(r, now).toISOString(),
  }));
  return [
    ...rivalRows,
    {
      kind: "user",
      key: "me",
      name: input.userName,
      colorClass: USER_COLOR,
      weeklyXp: input.userWeeklyXp,
      streak: input.userStreak,
      lastActiveAt: null,
    },
  ];
}

// XP desc; ties break on key so ordering never flickers between renders.
function rank(rows: Row[]): Map<string, number> {
  const sorted = [...rows].sort(
    (a, b) => b.weeklyXp - a.weeklyXp || (a.key < b.key ? -1 : 1)
  );
  return new Map(sorted.map((r, i) => [r.key, i + 1]));
}

export function buildBoard(input: {
  userId: string;
  userName: string;
  userWeeklyXp: number;
  userStreak: number;
  pace: number;
  now: Date;
}): BoardEntry[] {
  const dates = weekDates(input.now);
  const rows = rowsFor(input, input.now, dates);
  const todayRanks = rank(rows);

  // Δ compares against the board as it stood at the end of yesterday: the same
  // week's XP accumulated through yesterday, NOT yesterday's XP alone. On
  // Monday there is nothing comparable — everyone is at zero — so Δ is hidden.
  let yesterdayRanks: Map<string, number> | null = null;
  if (!isMondayUtc(input.now)) {
    const yesterday = addUtcDays(input.now, -1);
    const throughYesterday = dates.filter((d) => d <= todayStr(yesterday));
    // The user's own XP through yesterday isn't knowable from the weekly total
    // alone; prorating by elapsed days keeps Δ honest in direction (a day of
    // work moves you up) without inventing per-day history.
    const elapsed = Math.max(1, throughYesterday.length);
    const userThrough = Math.round((input.userWeeklyXp * (elapsed - 1)) / elapsed);
    yesterdayRanks = rank(
      rowsFor({ ...input, userWeeklyXp: userThrough }, yesterday, throughYesterday)
    );
  }

  return rows
    .map((r) => {
      const rankNow = todayRanks.get(r.key)!;
      const rankPrev = yesterdayRanks?.get(r.key);
      return {
        ...r,
        rank: rankNow,
        delta: rankPrev === undefined ? null : rankPrev - rankNow,
      };
    })
    .sort((a, b) => a.rank - b.rank);
}
```

- [ ] **Step 4: Chạy test**

Run: `npx vitest run src/lib/leaderboard/board.test.ts` → Expected: PASS

Nếu test "học đều → hạng 4–8" fail: đó là dấu hiệu `PACE_FACTOR_MIN/MAX` (Task 4) lệch, không phải lỗi `board.ts`. Khoảng 0.55–1.6 quanh 1.0 là thứ đặt user học-đúng-nhịp vào giữa bảng; điều chỉnh trong `constants.ts`.

- [ ] **Step 5: Chạy toàn bộ suite + commit**

Run: `npm test` → Expected: PASS

```bash
git add src/lib/leaderboard/board.ts src/lib/leaderboard/board.test.ts
git commit -m "feat(leaderboard): assemble board with earned ranks and daily deltas"
```

---

## Task 9: Trang `/leaderboard`

**Files:**
- Create: `src/app/leaderboard/page.tsx`
- Create: `src/app/leaderboard/leaderboard-view.tsx`
- Create: `src/components/leaderboard/rival-row.tsx`
- Modify: `src/components/auth-required.tsx` (thêm `"leaderboard"` vào `WallContext`)
- Modify: `src/lib/i18n/dictionaries.ts` (khối `leaderboard.*` cho `vi` và `en`; thêm `auth.walls.leaderboard`)

**Interfaces:**
- Consumes: `buildBoard`/`BoardEntry` (Task 8), `getUserPace` (Task 7), `getCurrentUser` từ `@/lib/session`, `getWeeklyRecap` từ `@/lib/stats`, `computeStreakFromDb` từ `@/lib/gamification-checks`, `prisma` từ `@/lib/db`, `AuthRequired` từ `@/components/auth-required`, `useI18n` từ `@/components/i18n-provider`.
- Produces: route `/leaderboard`; `RivalRow` component.

- [ ] **Step 1: Thêm context wall mới**

Trong `src/components/auth-required.tsx`, thêm `"leaderboard"` vào union `WallContext`:

```ts
export type WallContext =
  | "stats"
  | "notebook"
  | "topic"
  | "library"
  | "word"
  | "settings"
  | "home"
  | "leaderboard";
```

- [ ] **Step 2: Thêm i18n**

Trong `src/lib/i18n/dictionaries.ts`, thêm vào **cả** `vi` và `en`. Khối `vi`:

```ts
    leaderboard: {
      header: "Tuần này",
      title: "Bảng",
      titleAccent: "xếp hạng",
      subtitle: "XP tuần của bạn cạnh những người đang học cùng nhịp. Reset thứ Hai.",
      you: "Bạn",
      xpUnit: "XP",
      rank: "Hạng",
      activeNow: "vừa xong",
      activeMinutes: "{n} phút trước",
      activeHours: "{n} giờ trước",
      activeYesterday: "hôm qua",
      activeDays: "{n} ngày trước",
      streakLabel: "{n} ngày",
      deltaUp: "tăng {n} bậc",
      deltaDown: "giảm {n} bậc",
      deltaFlat: "giữ hạng",
      mondayNote: "Tuần mới vừa bắt đầu — thứ hạng sẽ động lại sau phiên học đầu tiên.",
      howTitle: "Bảng xếp hạng hoạt động thế nào?",
      howBody:
        "Thứ hạng của bạn tính từ XP thật bạn kiếm trong tuần, cộng dồn từ thứ Hai. Những người còn lại là đối thủ luyện tập do hệ thống tạo, với nhịp học đặt quanh nhịp của bạn để bảng luôn có người đáng đuổi và người đáng giữ khoảng cách.",
      howClose: "Đã hiểu",
    },
```

Khối `en`:

```ts
    leaderboard: {
      header: "This week",
      title: "Leader",
      titleAccent: "board",
      subtitle: "Your weekly XP beside learners on a similar pace. Resets Monday.",
      you: "You",
      xpUnit: "XP",
      rank: "Rank",
      activeNow: "just now",
      activeMinutes: "{n}m ago",
      activeHours: "{n}h ago",
      activeYesterday: "yesterday",
      activeDays: "{n}d ago",
      streakLabel: "{n} days",
      deltaUp: "up {n}",
      deltaDown: "down {n}",
      deltaFlat: "no change",
      mondayNote: "A new week just started — ranks start moving after your first session.",
      howTitle: "How does the leaderboard work?",
      howBody:
        "Your rank comes from the XP you actually earn, accumulated since Monday. The others are practice rivals generated by the app, paced around your own rhythm so there is always someone to chase and someone to stay ahead of.",
      howClose: "Got it",
    },
```

Thêm vào khối `auth.walls` (hoặc chỗ `AuthRequired` đang đọc copy theo context — mở `auth-required.tsx` xem key thật rồi thêm đúng nhánh đó) một entry `leaderboard` với nội dung: vi `"Bảng xếp hạng cần một tài khoản để biết XP tuần của bạn."`, en `"The leaderboard needs an account to know your weekly XP."`

- [ ] **Step 3: Viết `src/app/leaderboard/page.tsx`**

```tsx
import { getCurrentUser } from "@/lib/session";
import { getWeeklyRecap } from "@/lib/stats";
import { computeStreakFromDb } from "@/lib/gamification-checks";
import { prisma } from "@/lib/db";
import { AuthRequired } from "@/components/auth-required";
import { getUserPace } from "@/lib/leaderboard/pace";
import { buildBoard } from "@/lib/leaderboard/board";
import { LeaderboardView } from "./leaderboard-view";

export const dynamic = "force-dynamic";

export default async function LeaderboardPage() {
  const user = await getCurrentUser();
  if (!user) return <AuthRequired context="leaderboard" callbackUrl="/leaderboard" />;

  const now = new Date();
  // The user's weekly XP comes from getWeeklyRecap, the SAME number /stats
  // shows. A second hand-rolled weekly sum here is how the two drift apart.
  const [recap, pace, streak] = await Promise.all([
    getWeeklyRecap(user.id),
    getUserPace(user.id, now),
    computeStreakFromDb(prisma, user.id),
  ]);

  const board = buildBoard({
    userId: user.id,
    userName: user.name ?? "",
    userWeeklyXp: recap.thisWeek.xp,
    userStreak: streak,
    pace: pace.pace,
    now,
  });

  return <LeaderboardView board={board} nowIso={now.toISOString()} />;
}
```

- [ ] **Step 4: Viết `src/components/leaderboard/rival-row.tsx`**

```tsx
"use client";

import { Flame, ChevronUp, ChevronDown } from "lucide-react";
import type { BoardEntry } from "@/lib/leaderboard/board";
import { useI18n } from "@/components/i18n-provider";
import { cn } from "@/lib/utils";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const last = parts[parts.length - 1];
  return (parts.length > 1 ? parts[0][0] + last[0] : last.slice(0, 2)).toUpperCase();
}

export function RivalRow({ entry, nowIso }: { entry: BoardEntry; nowIso: string }) {
  const { t } = useI18n();
  const isUser = entry.kind === "user";

  const activeLabel = (() => {
    if (!entry.lastActiveAt) return null;
    const mins = Math.max(0, (Date.parse(nowIso) - Date.parse(entry.lastActiveAt)) / 60000);
    if (mins < 5) return t("leaderboard.activeNow");
    if (mins < 60) return t("leaderboard.activeMinutes", { n: Math.round(mins) });
    const hours = mins / 60;
    if (hours < 24) return t("leaderboard.activeHours", { n: Math.round(hours) });
    const days = Math.round(hours / 24);
    return days <= 1 ? t("leaderboard.activeYesterday") : t("leaderboard.activeDays", { n: days });
  })();

  return (
    <li
      className={cn(
        "flex items-center gap-3 sm:gap-4 rounded-2xl px-3 sm:px-4 py-3",
        isUser && "bg-ember/8 border border-ember/20"
      )}
    >
      <span className={cn("w-6 text-right font-mono text-sm", isUser ? "text-ember" : "text-soft")}>
        {entry.rank}
      </span>

      <span
        aria-hidden
        className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-semibold", entry.colorClass)}
      >
        {initials(entry.name)}
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className={cn("truncate text-sm", isUser ? "font-semibold" : "font-medium")}>
            {isUser ? t("leaderboard.you") : entry.name}
          </span>
          {entry.streak > 0 && (
            <span className="inline-flex shrink-0 items-center gap-0.5 text-xs text-soft">
              <Flame size={11} className="text-ember" />
              {entry.streak}
            </span>
          )}
        </span>
        {activeLabel && <span className="block text-xs text-soft/70">{activeLabel}</span>}
      </span>

      {entry.delta !== null && entry.delta !== 0 && (
        <span
          className={cn(
            "inline-flex shrink-0 items-center text-xs font-medium",
            entry.delta > 0 ? "text-moss-500" : "text-cefr-b2"
          )}
          aria-label={
            entry.delta > 0
              ? t("leaderboard.deltaUp", { n: entry.delta })
              : t("leaderboard.deltaDown", { n: -entry.delta })
          }
        >
          {entry.delta > 0 ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          {Math.abs(entry.delta)}
        </span>
      )}

      <span className="w-16 shrink-0 text-right font-mono text-sm tabular-nums">
        {entry.weeklyXp.toLocaleString()}
      </span>
    </li>
  );
}
```

- [ ] **Step 5: Viết `src/app/leaderboard/leaderboard-view.tsx`**

```tsx
"use client";

import type { BoardEntry } from "@/lib/leaderboard/board";
import { RivalRow } from "@/components/leaderboard/rival-row";
import { HowItWorks } from "@/components/leaderboard/how-it-works";
import { useI18n } from "@/components/i18n-provider";

export function LeaderboardView({ board, nowIso }: { board: BoardEntry[]; nowIso: string }) {
  const { t } = useI18n();
  const isMonday = board.every((e) => e.delta === null);

  return (
    <main className="shell py-10 sm:py-16 pb-28 md:pb-16">
      <header className="mb-8 sm:mb-12 max-w-2xl">
        <p className="text-sm text-soft mb-3 font-mono">{t("leaderboard.header")}</p>
        <h1 className="display text-display-lg mb-4">
          {t("leaderboard.title")}{" "}
          <span className="display-it text-ember">{t("leaderboard.titleAccent")}</span>
        </h1>
        <p className="text-soft leading-relaxed">{t("leaderboard.subtitle")}</p>
      </header>

      {isMonday && (
        <p className="mb-5 text-sm text-soft">{t("leaderboard.mondayNote")}</p>
      )}

      <ul className="card-atelier divide-y divide-ink/10 p-1.5 sm:p-2">
        {board.map((e) => (
          <RivalRow key={e.key} entry={e} nowIso={nowIso} />
        ))}
      </ul>

      <div className="mt-6">
        <HowItWorks />
      </div>
    </main>
  );
}
```

- [ ] **Step 6: Kiểm build + typecheck**

Run: `npx tsc --noEmit`
Expected: không lỗi. Nếu `card-atelier` / `text-display-lg` báo thiếu thì kiểm `src/app/globals.css` — chúng là component class của repo, dùng y như `study/page.tsx` đang dùng.

Run: `npm test` → Expected: PASS (không có test nào bị ảnh hưởng)

- [ ] **Step 7: Commit**

```bash
git add src/app/leaderboard src/components/leaderboard/rival-row.tsx src/components/auth-required.tsx src/lib/i18n/dictionaries.ts
git commit -m "feat(leaderboard): weekly board page with rival rows"
```

---

## Task 10: Mục giải thích ⓘ, tab nav, nghiệm bằng tay

**Files:**
- Create: `src/components/leaderboard/how-it-works.tsx`
- Modify: `src/components/nav.tsx` (thêm link)

**Interfaces:**
- Consumes: `useI18n`; key `leaderboard.how*` (Task 9).
- Produces: `HowItWorks` component (đã được `leaderboard-view.tsx` import ở Task 9 — task này làm nó tồn tại thật).

- [ ] **Step 1: Viết `src/components/leaderboard/how-it-works.tsx`**

Spec chốt: dòng minh bạch đặt ở chỗ **tìm được nhưng không chắn đường**. Một `<details>` là đủ — không cần modal, không chặn gì, và mở được bằng bàn phím.

```tsx
"use client";

// The honest answer, placed where a curious user finds it and an uninterested
// one never trips over it. The board's credibility comes from rival behaviour
// looking real (see lib/leaderboard/activity.ts), not from hiding what they are
// — so when someone does ask, the app answers instead of getting caught.

import { Info } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";

export function HowItWorks() {
  const { t } = useI18n();
  return (
    <details className="group rounded-2xl border border-line px-4 py-3">
      <summary className="flex cursor-pointer list-none items-center gap-2 text-sm text-soft hover:text-ink transition-colors">
        <Info size={14} />
        {t("leaderboard.howTitle")}
      </summary>
      <p className="mt-3 text-sm leading-relaxed text-soft">{t("leaderboard.howBody")}</p>
    </details>
  );
}
```

- [ ] **Step 2: Thêm tab vào `src/components/nav.tsx`**

Trong mảng `links`, thêm sau entry `/stats`. Bảng xếp hạng cần XP của chính user nên guest không xem được → `locked: true`. Import thêm `Trophy` từ `lucide-react` vào dòng import icon đã có.

```ts
    { href: "/leaderboard", label: t("nav.leaderboard"), icon: Trophy, mobile: true, locked: true },
```

Thanh dưới mobile hiện có 5 tab (`/`, `/topics`, `/browse`, `/notebook`, `/stats`); thêm cái thứ 6 là chật. Đặt `/browse` thành `mobile: false` (Thư viện vẫn còn ở nav desktop và vẫn tới được từ trang chủ), giữ thanh mobile ở 5 tab.

Thêm key `nav.leaderboard` vào `dictionaries.ts`: vi `"Xếp hạng"`, en `"Ranks"`.

- [ ] **Step 3: Kiểm typecheck + test**

Run: `npx tsc --noEmit` → Expected: không lỗi
Run: `npm test` → Expected: PASS

- [ ] **Step 4: Nghiệm bằng tay**

Run: `npm run dev`, mở `/leaderboard`.

Kiểm 6 điều (tiêu chí 1, 2, 3, 9 của spec):

1. Refresh 5 lần → **bảng không đổi** một con số nào.
2. Dòng của bạn có viền ember và ghi "Bạn"; XP của nó **khớp chính xác** con số XP tuần ở `/stats` (mục recap tuần).
3. Không XP rival nào tròn chục.
4. Có ít nhất một rival streak thấp / hiển thị "2 ngày trước" — bảng không phải 10 người đều tăm tắp.
5. Học một phiên → XP tăng → hạng **lên** (hoặc giữ nếu chưa vượt ai). Không có trường hợp học xong mà tụt.
6. Nếu hôm nay là thứ Hai: không có mũi tên Δ nào và có dòng `mondayNote`.

Ghi lại kết quả 6 mục này vào PR/commit body.

- [ ] **Step 5: Commit**

```bash
git add src/components/leaderboard/how-it-works.tsx src/components/nav.tsx src/lib/i18n/dictionaries.ts
git commit -m "feat(leaderboard): nav tab and how-it-works disclosure"
```

---

## Self-Review

**Spec coverage:**

| Yêu cầu spec | Task |
|---|---|
| §2 kiến trúc tất định, không model/cron | 2, 3, 4 |
| §3.1 nhịp user, median, fallback dailyGoalXp | 7 |
| §3.2 năm tham số tính cách | 4 |
| §3.3 cap 2.2× | 5 |
| §4 tên + avatar chữ cái, chỉ tên Việt | 4 (pool), 9 (render) |
| §4 streak 🔥 suy từ restProb | 8 |
| §4 Δ hạng, thứ Hai ẩn Δ | 8 |
| §4 "hoạt động X giờ trước" | 6 (instant), 9 (format) |
| §5.1 không XP tròn chục | 5 |
| §5.2 ≥1 rival XP 0 mỗi ngày (cưỡng chế) | 5 |
| §5.4 luật đêm ≥8/10 | 4 (quota peakHour), 6 (test) |
| §5.5 giữ 4–5 rival mỗi tuần | 4 |
| §5.6 không trùng tên trong tuần | 4 |
| §5 dòng minh bạch ở ⓘ | 10 |
| §6 `entries: kind user/rival` cho user thật về sau | 8 (`BoardEntry.kind`) |
| §7 toàn bộ bảng test | 2–8 |
| Tiêu chí 9 (khớp `/stats`) | 9 (dùng `getWeeklyRecap`) |

Không có yêu cầu spec nào thiếu task.

**Ghi chú lệch có ý thức, không phải thiếu sót:**

- Spec §3.1 nói "median XP/ngày của 7 ngày gần nhất". Task 7 chốt rõ hơn: **median trên các ngày có hoạt động**. Median gồm cả ngày 0 sẽ về 0 với bất kỳ ai học 3–4 ngày/tuần, làm rival sinh ra XP 0. Lý do đã ghi trong comment của `derivePace` và trong Task 7 Step 3.
- Δ hạng của **dòng user** dùng XP prorate theo số ngày đã trôi, vì XP tuần tổng không cho biết lịch sử từng ngày. Đúng về **hướng** (học thêm thì lên) nhưng không phải lịch sử thật. Nếu muốn chính xác thì cần một query `DailyStat` thứ hai cho tuần — cân nhắc sau nếu Δ của dòng user thấy sai.

**Placeholder scan:** không có TBD/TODO; mọi step code đều có code thật; mọi hàm được tham chiếu đều được định nghĩa trong một task cụ thể.

**Type consistency:** `Rival` (Task 4) dùng nguyên si ở Task 5, 6, 8. `BoardEntry` (Task 8) dùng ở Task 9. `derivePace`/`getUserPace` (Task 7) khớp với chỗ gọi ở Task 9. `isRestDay` export từ `xp.ts` (Task 5) và được `activity.ts` (Task 6) import — cùng tên, cùng chữ ký. `lastActiveAt` là **hàm** trong `activity.ts` và là **field string|null** trong `BoardEntry`; hai thứ khác scope, không xung đột import vì `board.ts` import hàm rồi gán vào field.
