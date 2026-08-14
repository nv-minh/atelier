# Nhắc học lại (gói C) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Người học nhận **tối đa một** lời nhắc mỗi ngày, vào giờ họ chọn, với lý do đúng nhất trong bốn lý do — qua Web Push nếu họ bật, và luôn có một lớp nhắc trong app cho mọi người còn lại.

**Architecture:** Toàn bộ chính sách nằm trong hai hàm thuần: `pickReminder` (trạng thái → một lời nhắc hoặc `null`) và `nextRemindAt` (giờ địa phương → mốc UTC, đúng qua DST). Push và banner in-app gọi **cùng** `pickReminder`, nên thứ tự ưu tiên và câu chữ không thể lệch. Cap "1 lần/ngày" là bất biến của dữ liệu: cron **giành suất trước, gửi sau** bằng một `updateMany` có điều kiện trên `Settings.nextRemindAt`.

**Tech Stack:** Next.js 14 route handlers, Prisma 5 + Postgres (Neon), `web-push` (dependency mới duy nhất), service worker tự viết `public/sw.js`, vitest 2, `Intl.DateTimeFormat` cho múi giờ (không thêm thư viện ngày-giờ).

**Spec:** `docs/superpowers/specs/2026-08-13-vocab-vault-and-reminders-design.md` (§3 là gói C, §4 là méo mó app-day đã chấp nhận, §7 là các giả định của tác giả spec)

## Global Constraints

- **Cron phải giành suất TRƯỚC khi gửi.** `updateMany({ where: { id, nextRemindAt: <giá trị vừa đọc> }, data: { nextRemindAt: <mốc mai> } })`; `count === 0` nghĩa là lần chạy khác đã giành → **không gửi**. Gửi trước rồi ghi là một lần retry của cron = người dùng nhận hai thông báo.
- **`export const dynamic = "force-dynamic"` trên mọi route mới.** Gói A đã bị Next prerender `/api/placement/items` thành **Static** khiến mọi user nhận cùng một payload; header `no-store` không cứu được.
- **Test không được chạm Prisma.** `import "server-only"` không resolve được dưới vitest. `pick.ts` và `schedule.ts` phải thuần, không import gì từ `db.ts`/`stats.ts`/`study-engine.ts`.
- **Mốc "ngày" của app là UTC** (`todayStr()` dùng `toISOString()`), đổi ngày lúc 07:00 giờ VN. Mọi khái niệm "hôm nay"/"đã học hôm nay" phải dùng mốc đó — xem §4 của spec. **Không** đổi mốc này trong gói C.
- **"Có hoạt động" = `DailyStat.totalCount > 0`** — đúng predicate mà `computeStreakFromDb` dùng. Đừng định nghĩa lại bằng `reviews > 0` hay `xp > 0`, streak và nhắc sẽ lệch nhau ở những ngày biên.
- **Khóa i18n mới phải vào CẢ HAI nhánh `vi` và `en`** của `src/lib/i18n/dictionaries.ts`.
- **`text-soft/70` compile ra rỗng** (`text-soft` là class `@layer components`, không phải colour key) → dùng `text-soft opacity-70`.
- **Service worker CHỈ đăng ký ở production** (`src/components/sw-register.tsx` kiểm `NODE_ENV === "production"`). Nghĩa là **`npm run dev` không test được push** — phải `npm run build && npm start`, hoặc test trên bản deploy.
- **Nhắc tắt mặc định.** Mọi hàng `Settings` đang tồn tại có `remindHour = null`; không ai bị bật ngầm.
- Commit message tiếng Anh dạng `feat(reminders): …`, kèm `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`.
- **Ngôn ngữ comment — quy ước của repo là CHIA HAI, và các snippet dưới đây không phản ánh nó:** comment trong **module production** viết **tiếng Anh** (đã kiểm: `src/lib/selection/score.ts`, `src/lib/placement/ladder.ts`, và toàn bộ code cũ), còn **file test** viết **tiếng Việt** (đã kiểm: `src/lib/leaderboard/{pace,board,rivals,activity}.test.ts` trên `main`). Snippet trong plan này viết comment tiếng Việt cho cả hai loại; khi cài đặt, **dịch sang tiếng Anh mọi comment thuộc module production** (kể cả trong `public/sw.js`), giữ tiếng Việt trong `*.test.ts`. Giữ nguyên *nội dung* lập luận — nhất là các câu giải thích vì sao (vì sao giành suất trước khi gửi, vì sao lưu IANA `tz` chứ không lưu offset).
- **Repo KHÔNG có ESLint** dù `package.json` khai báo `"lint": "next lint"`. Đừng chạy `npm run lint`.

---

### Task 1: `reminders/schedule.ts` — giờ địa phương → mốc UTC, đúng qua DST

Đây là lý do spec lưu IANA `tz` chứ không lưu offset phút: offset lưu cứng sai đúng vào ngày đổi giờ. Nếu không ghim bằng test thì lý lẽ đó chỉ là lời nói.

**Files:**
- Create: `src/lib/reminders/schedule.ts` (thuần)
- Create: `src/lib/reminders/schedule.test.ts`

**Interfaces:**
- Consumes: —
- Produces:
  - `tzOffsetMs(instant: Date, tz: string): number`
  - `localHourIn(instant: Date, tz: string): number`
  - `nextRemindAt(now: Date, tz: string, remindHour: number): Date`

- [ ] **Step 1: Viết test**

Hai ca DST được kiểm bằng **tính chất**, không bằng timestamp cứng — giờ 02:00 ngày spring-forward *không tồn tại*, nên điều cần bảo đảm là "không ném lỗi, không trả về quá khứ, trôi tối đa một giờ", chứ không phải một con số cụ thể.

```ts
// src/lib/reminders/schedule.test.ts
import { describe, it, expect } from "vitest";
import { nextRemindAt, localHourIn, tzOffsetMs } from "./schedule";

const VN = "Asia/Ho_Chi_Minh"; // UTC+7 quanh năm, không DST
const NY = "America/New_York";

describe("tzOffsetMs", () => {
  it("VN luôn +7 giờ, bất kể tháng nào", () => {
    const H = 3_600_000;
    expect(tzOffsetMs(new Date("2026-01-15T00:00:00Z"), VN)).toBe(7 * H);
    expect(tzOffsetMs(new Date("2026-07-15T00:00:00Z"), VN)).toBe(7 * H);
  });

  it("New York đổi giữa -5 và -4 theo DST", () => {
    const H = 3_600_000;
    expect(tzOffsetMs(new Date("2026-01-15T12:00:00Z"), NY)).toBe(-5 * H);
    expect(tzOffsetMs(new Date("2026-07-15T12:00:00Z"), NY)).toBe(-4 * H);
  });
});

describe("nextRemindAt — múi giờ không DST (giá trị chính xác)", () => {
  it("21h giờ VN = 14:00 UTC cùng ngày, khi hiện tại còn sớm hơn", () => {
    const now = new Date("2026-08-13T03:00:00Z"); // 10:00 sáng VN
    expect(nextRemindAt(now, VN, 21).toISOString()).toBe("2026-08-13T14:00:00.000Z");
  });

  it("giờ nhắc đã trôi qua hôm nay → nhảy sang mai, KHÔNG trả về quá khứ", () => {
    const now = new Date("2026-08-13T15:00:00Z"); // 22:00 VN, đã qua 21h
    expect(nextRemindAt(now, VN, 21).toISOString()).toBe("2026-08-14T14:00:00.000Z");
  });

  it("đang đúng ngay giờ nhắc → suất kế tiếp là ngày mai", () => {
    // Nếu trả về chính lúc này, cron vừa gửi xong sẽ thấy nextRemindAt <= now và
    // gửi lần nữa trong cùng phút.
    const now = new Date("2026-08-13T14:00:00Z"); // đúng 21:00 VN
    expect(nextRemindAt(now, VN, 21).toISOString()).toBe("2026-08-14T14:00:00.000Z");
  });

  it("qua giao thừa vẫn đúng", () => {
    const now = new Date("2026-12-31T16:00:00Z"); // 23:00 VN ngày 31/12
    expect(nextRemindAt(now, VN, 21).toISOString()).toBe("2027-01-01T14:00:00.000Z");
  });

  it("nhắc 0h (nửa đêm giờ địa phương) không bị hiểu thành 24h", () => {
    // Intl với hour12:false trả "24" cho nửa đêm ở một số phiên bản ICU.
    const now = new Date("2026-08-13T03:00:00Z"); // 10:00 VN
    const at = nextRemindAt(now, VN, 0);
    expect(localHourIn(at, VN)).toBe(0);
    expect(at.getTime()).toBeGreaterThan(now.getTime());
  });
});

describe("nextRemindAt — DST (kiểm tính chất, không kiểm timestamp cứng)", () => {
  it("luôn ở tương lai và luôn rơi vào đúng giờ địa phương đã chọn", () => {
    const now = new Date("2026-11-01T05:30:00Z");
    const at = nextRemindAt(now, NY, 21);
    expect(at.getTime()).toBeGreaterThan(now.getTime());
    expect(localHourIn(at, NY)).toBe(21);
  });

  it("giờ 02:00 KHÔNG TỒN TẠI ngày spring-forward → trôi tối đa 1 giờ, không nổ", () => {
    // 2026-03-08, New York nhảy từ 01:59 sang 03:00: giờ 2 không có trên đồng hồ.
    // Yêu cầu: không ném lỗi, không trả về quá khứ, và giờ địa phương là 2 hoặc 3.
    const now = new Date("2026-03-08T04:00:00Z"); // 23:00 ngày 7/3 giờ NY
    const at = nextRemindAt(now, NY, 2);
    expect(at.getTime()).toBeGreaterThan(now.getTime());
    expect([2, 3]).toContain(localHourIn(at, NY));
  });

  it("giờ 02:00 XẢY RA HAI LẦN ngày fall-back → chọn một lần, cách nhau 23–25 giờ", () => {
    // 2026-11-01, New York lặp lại giờ 1; quanh mốc đó khoảng cách giữa hai lần
    // nhắc liên tiếp không còn đúng 24 giờ. Điều phải giữ: vẫn đúng giờ địa
    // phương, và không bao giờ ra 0 giờ (gửi trùng) hay 48 giờ (nhảy mất ngày).
    const first = nextRemindAt(new Date("2026-10-31T20:00:00Z"), NY, 2);
    const second = nextRemindAt(new Date(first.getTime() + 60_000), NY, 2);
    const gapH = (second.getTime() - first.getTime()) / 3_600_000;
    expect(gapH).toBeGreaterThanOrEqual(23);
    expect(gapH).toBeLessThanOrEqual(25);
    expect(localHourIn(second, NY)).toBe(2);
  });

  it("tz rác → không nổ, coi như UTC", () => {
    // Giá trị này đến từ trình duyệt; một tz lạ không được làm chết cả cron.
    const now = new Date("2026-08-13T03:00:00Z");
    const at = nextRemindAt(now, "Không/Phải_Múi_Giờ", 21);
    expect(at.toISOString()).toBe("2026-08-13T21:00:00.000Z");
  });
});
```

- [ ] **Step 2: Chạy để thấy fail**

```bash
npx vitest run src/lib/reminders/schedule.test.ts
```

Expected: FAIL — `Failed to resolve import "./schedule"`.

- [ ] **Step 3: Viết `schedule.ts`**

```ts
// Lịch nhắc: đổi "giờ H theo đồng hồ của người học" thành một mốc UTC.
//
// Vì sao dùng Intl chứ không lưu offset phút: offset lưu cứng SAI đúng vào ngày
// đổi DST. Intl.DateTimeFormat với timeZone biết luật DST của từng vùng, và nó có
// sẵn trong Node — không thêm dependency ngày-giờ nào.
//
// Module THUẦN: không prisma, không server-only.

const HOUR_MS = 3_600_000;

function partsIn(instant: Date, tz: string) {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const map: Record<string, number> = {};
  for (const p of dtf.formatToParts(instant)) {
    if (p.type !== "literal") map[p.type] = Number(p.value);
  }
  // hour12:false trả "24" cho nửa đêm ở một số phiên bản ICU → chuẩn hoá về 0.
  map.hour = map.hour % 24;
  return map;
}

// Offset của tz tại đúng thời điểm `instant`, tính bằng ms (dương nếu đi trước UTC).
export function tzOffsetMs(instant: Date, tz: string): number {
  let m;
  try {
    m = partsIn(instant, tz);
  } catch {
    return 0; // tz rác (đến từ trình duyệt) → coi như UTC, không làm chết cron
  }
  const asIfUtc = Date.UTC(m.year, m.month - 1, m.day, m.hour, m.minute, m.second);
  return asIfUtc - instant.getTime();
}

export function localHourIn(instant: Date, tz: string): number {
  try {
    return partsIn(instant, tz).hour;
  } catch {
    return instant.getUTCHours();
  }
}

// Mốc UTC ứng với "ngày địa phương của `ref`, cộng `dayOffset` ngày, lúc `hour`:00".
function utcForLocalHour(ref: Date, tz: string, hour: number, dayOffset: number): Date {
  let m;
  try {
    m = partsIn(ref, tz);
  } catch {
    return new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), ref.getUTCDate() + dayOffset, hour));
  }
  const wall = Date.UTC(m.year, m.month - 1, m.day + dayOffset, hour);

  // Hai vòng: offset phụ thuộc thời điểm, mà thời điểm lại phụ thuộc offset. Lần
  // hai giải đúng cho mọi ngày thường; ngày DST thì hai lần khác nhau và lần hai
  // là kết quả — với giờ không tồn tại (spring forward) nó trôi sang giờ kế tiếp,
  // đó là hành vi mong muốn: nhắc muộn một giờ vẫn hơn không nhắc.
  const off1 = tzOffsetMs(new Date(wall), tz);
  const guess = new Date(wall - off1);
  const off2 = tzOffsetMs(guess, tz);
  return off2 === off1 ? guess : new Date(wall - off2);
}

// Lần kế tiếp đồng hồ của người học chỉ `remindHour`:00, tính từ `now`.
// LUÔN ở tương lai — nếu trả về đúng `now`, cron vừa gửi sẽ thấy
// `nextRemindAt <= now` và gửi lần nữa trong cùng phút.
export function nextRemindAt(now: Date, tz: string, remindHour: number): Date {
  const hour = Math.min(23, Math.max(0, Math.round(remindHour)));
  for (let day = 0; day <= 3; day++) {
    const at = utcForLocalHour(now, tz, hour, day);
    if (at.getTime() > now.getTime()) return at;
  }
  // Không thể xảy ra với dữ liệu hợp lệ; giữ để không bao giờ trả về quá khứ.
  return new Date(now.getTime() + 24 * HOUR_MS);
}
```

- [ ] **Step 4: Chạy test**

```bash
npx vitest run src/lib/reminders/schedule.test.ts
npx tsc --noEmit
```

Expected: PASS toàn bộ. Nếu một ca DST fail, **đọc kỹ giá trị thực tế trước khi sửa code** — có thể kỳ vọng trong test cần nới, nhưng hai tính chất "luôn ở tương lai" và "cách nhau 23–25 giờ" thì **không được** nới, chúng chính là thứ bảo vệ cap 1 lần/ngày.

- [ ] **Step 5: Commit**

```bash
git add src/lib/reminders/schedule.ts src/lib/reminders/schedule.test.ts
git commit -m "feat(reminders): local reminder hour to UTC, correct across DST

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: `reminders/pick.ts` — bốn lý do tranh một suất

**Files:**
- Create: `src/lib/reminders/pick.ts` (thuần)
- Create: `src/lib/reminders/pick.test.ts`

**Interfaces:**
- Consumes: `LEECH_THRESHOLD` (`@/lib/leech`)
- Produces:
  - `type ReminderKind = "streak-risk" | "due" | "leech" | "winback"`
  - `type ReminderInput = { studiedToday: boolean; streak: number; dueCount: number; leechCount: number; daysInactive: number; isSaturday: boolean }`
  - `type Reminder = { kind: ReminderKind; url: string; n: number }`
  - `LEECH_NUDGE_MIN = 5`, `WINBACK_DAYS = [3, 7, 14]`
  - `pickReminder(input: ReminderInput): Reminder | null`
  - `countDaysInactive(activeDateStrs: string[], today: string): number`
  - `isSaturdayAppDay(now: Date): boolean`

- [ ] **Step 1: Viết test**

```ts
// src/lib/reminders/pick.test.ts
import { describe, it, expect } from "vitest";
import { pickReminder, countDaysInactive, isSaturdayAppDay, type ReminderInput } from "./pick";

const base: ReminderInput = {
  studiedToday: false,
  streak: 0,
  dueCount: 0,
  leechCount: 0,
  daysInactive: 0,
  isSaturday: false,
};

describe("pickReminder — thứ tự ưu tiên", () => {
  it("đứt chuỗi THẮNG đến hạn khi cả hai đều đúng", () => {
    // Mất chuỗi 30 ngày là thiệt hại không lấy lại được; 12 từ đến hạn thì mai ôn
    // vẫn được. Một suất mỗi ngày nên phải chọn cái đắt hơn.
    const r = pickReminder({ ...base, streak: 30, dueCount: 12 });
    expect(r?.kind).toBe("streak-risk");
    expect(r?.n).toBe(30);
  });

  it("không có chuỗi nhưng có từ đến hạn → nhắc đến hạn, mang theo số lượng", () => {
    const r = pickReminder({ ...base, streak: 0, dueCount: 24 });
    expect(r).toEqual({ kind: "due", url: "/study", n: 24 });
  });

  it("leech chỉ bắn thứ Bảy, và chỉ khi tích đủ ngưỡng", () => {
    expect(pickReminder({ ...base, studiedToday: true, leechCount: 9, isSaturday: false })).toBeNull();
    expect(pickReminder({ ...base, studiedToday: true, leechCount: 4, isSaturday: true })).toBeNull();
    const r = pickReminder({ ...base, studiedToday: true, leechCount: 9, isSaturday: true });
    expect(r).toEqual({ kind: "leech", url: "/study/cram?scope=leeches", n: 9 });
  });

  it("win-back CHỈ ở mốc 3, 7, 14 — ngày 4/5/6 im lặng", () => {
    for (const d of [3, 7, 14]) {
      expect(pickReminder({ ...base, daysInactive: d })?.kind).toBe("winback");
    }
    for (const d of [1, 2, 4, 5, 6, 8, 13, 15, 30]) {
      expect(pickReminder({ ...base, daysInactive: d })).toBeNull();
    }
  });

  it("sau ngày 14 thì ngừng hẳn — người rời app 3 tuần thì đó là spam", () => {
    expect(pickReminder({ ...base, daysInactive: 21 })).toBeNull();
    expect(pickReminder({ ...base, daysInactive: 400 })).toBeNull();
  });

  it("win-back xếp SAU đến hạn: vắng 3 ngày mà có từ đến hạn thì nói về từ", () => {
    const r = pickReminder({ ...base, daysInactive: 3, dueCount: 40 });
    expect(r?.kind).toBe("due");
  });
});

describe("pickReminder — im lặng", () => {
  it("đã học hôm nay → null (trừ leech thứ Bảy)", () => {
    // Nhắc tiếp người vừa học xong là hình phạt cho việc xuất hiện.
    expect(pickReminder({ ...base, studiedToday: true, streak: 10, dueCount: 50 })).toBeNull();
    expect(pickReminder({ ...base, studiedToday: true, leechCount: 9, isSaturday: true })?.kind).toBe("leech");
  });

  it("không có gì đáng nói → null, và cron vẫn phải đẩy nextRemindAt sang mai", () => {
    expect(pickReminder(base)).toBeNull();
  });

  it("chưa học, không chuỗi, không từ đến hạn, chưa vắng đủ → null", () => {
    expect(pickReminder({ ...base, daysInactive: 1 })).toBeNull();
  });
});

describe("countDaysInactive", () => {
  it("có hoạt động hôm nay → 0", () => {
    expect(countDaysInactive(["2026-08-13", "2026-08-12"], "2026-08-13")).toBe(0);
  });

  it("hoạt động gần nhất là hôm qua → 1", () => {
    expect(countDaysInactive(["2026-08-12"], "2026-08-13")).toBe(1);
  });

  it("đếm đúng qua mốc tháng", () => {
    expect(countDaysInactive(["2026-07-29"], "2026-08-01")).toBe(3);
  });

  it("chưa từng học → trả 0, KHÔNG phải vô cực", () => {
    // User mới toanh không phải người "bỏ app": trả 0 để win-back không bắn ngay
    // ngày đăng ký.
    expect(countDaysInactive([], "2026-08-13")).toBe(0);
  });

  it("bỏ qua ngày trong tương lai (lệch đồng hồ) thay vì ra số âm", () => {
    expect(countDaysInactive(["2026-08-20"], "2026-08-13")).toBe(0);
  });
});

describe("isSaturdayAppDay — ghim mốc ngày UTC của app (§4 của spec)", () => {
  it("thứ Bảy tính theo app-day (UTC), KHÔNG theo đồng hồ người dùng", () => {
    // 2026-08-15 là thứ Bảy. App đổi ngày lúc 00:00 UTC = 07:00 giờ VN, nên
    // 23:00 UTC thứ Bảy vẫn là thứ Bảy dù ở VN đã 06:00 sáng Chủ nhật.
    expect(isSaturdayAppDay(new Date("2026-08-15T00:00:00Z"))).toBe(true);
    expect(isSaturdayAppDay(new Date("2026-08-15T23:59:59Z"))).toBe(true);
    expect(isSaturdayAppDay(new Date("2026-08-16T00:00:00Z"))).toBe(false);
  });

  it("KHÔNG dùng giờ địa phương của máy chạy code", () => {
    // Nếu ai đó đổi sang getDay() (giờ local) thì test này đổ trên máy lệch múi:
    // 2026-08-14T23:00Z là thứ Sáu theo UTC nhưng đã là thứ Bảy ở VN.
    expect(isSaturdayAppDay(new Date("2026-08-14T23:00:00Z"))).toBe(false);
  });
});
```

- [ ] **Step 2: Chạy để thấy fail**

```bash
npx vitest run src/lib/reminders/pick.test.ts
```

Expected: FAIL — `Failed to resolve import "./pick"`.

- [ ] **Step 3: Viết `pick.ts`**

```ts
// Chính sách nhắc học: trạng thái người học → MỘT lời nhắc, hoặc không nhắc gì.
//
// Đây là bộ não duy nhất cho cả hai kênh — cron push và banner in-app đều gọi hàm
// này, nên thứ tự ưu tiên và câu chữ không thể lệch giữa hai nơi.
//
// Module THUẦN: không prisma, không server-only, không đọc Date.now().
export type ReminderKind = "streak-risk" | "due" | "leech" | "winback";

export type ReminderInput = {
  studiedToday: boolean; // theo app-day (UTC) — xem §4 của spec
  streak: number;
  dueCount: number;
  leechCount: number;
  daysInactive: number;
  isSaturday: boolean;
};

// `n` là con số duy nhất câu chữ cần (số ngày chuỗi, số từ đến hạn, …). Giữ ở đây
// để copy.ts chỉ việc nội suy, không phải tự tính lại.
export type Reminder = { kind: ReminderKind; url: string; n: number };

export const LEECH_NUDGE_MIN = 5;
export const WINBACK_DAYS = [3, 7, 14] as const;

export function pickReminder(input: ReminderInput): Reminder | null {
  // Leech là lời nhắc duy nhất được phép bắn cho người đã học hôm nay: nó nói về
  // một việc khác (ôn riêng nhóm từ khó), không phải "học đi".
  const leechReady = input.isSaturday && input.leechCount >= LEECH_NUDGE_MIN;

  if (input.studiedToday) {
    return leechReady ? { kind: "leech", url: "/study/cram?scope=leeches", n: input.leechCount } : null;
  }

  if (input.streak >= 1) return { kind: "streak-risk", url: "/study", n: input.streak };
  if (input.dueCount > 0) return { kind: "due", url: "/study", n: input.dueCount };
  if (leechReady) return { kind: "leech", url: "/study/cram?scope=leeches", n: input.leechCount };
  if ((WINBACK_DAYS as readonly number[]).includes(input.daysInactive)) {
    return { kind: "winback", url: "/study", n: input.daysInactive };
  }
  return null;
}

// Số app-day liên tiếp gần nhất KHÔNG có hoạt động. `activeDateStrs` là các
// DailyStat.dateStr có totalCount > 0 (đúng predicate computeStreakFromDb dùng).
export function countDaysInactive(activeDateStrs: string[], today: string): number {
  if (activeDateStrs.length === 0) return 0; // user mới, không phải người bỏ app
  const active = new Set(activeDateStrs);
  const start = Date.parse(today + "T00:00:00Z");
  if (Number.isNaN(start)) return 0;

  for (let d = 0; d <= 400; d++) {
    const iso = new Date(start - d * 86_400_000).toISOString().slice(0, 10);
    if (active.has(iso)) return d;
  }
  return 0; // hoạt động cuối cùng quá xa → không còn là ứng viên win-back
}

// Thứ Bảy theo APP-DAY, tức mốc UTC (đổi ngày lúc 07:00 giờ VN) — cùng mốc mà
// todayStr(), DailyStat, streak và daily goal đang dùng. Để ở module thuần thay vì
// tính bằng now.getUTCDay() trong state-server để mốc này được test ghim: dùng
// getDay() (giờ local của máy chạy code) là một lỗi im lặng, chỉ lộ ở hai ngày biên.
export function isSaturdayAppDay(now: Date): boolean {
  return now.getUTCDay() === 6;
}
```

- [ ] **Step 4: Chạy test**

```bash
npx vitest run src/lib/reminders/pick.test.ts
npm test
```

Expected: file mới PASS, toàn bộ test vẫn xanh.

- [ ] **Step 5: Commit**

```bash
git add src/lib/reminders/pick.ts src/lib/reminders/pick.test.ts
git commit -m "feat(reminders): four reasons competing for one daily slot

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Lược đồ + đường ghi `nextRemindAt`

**Files:**
- Modify: `prisma/schema.prisma` (`Settings` thêm 3 cột, model `PushSubscription`, `User` thêm quan hệ)
- Create: `src/lib/reminders/prefs-server.ts`
- Modify: `src/app/api/settings/route.ts` (nhận `remindHour`, `tz`)

**Interfaces:**
- Consumes: `nextRemindAt` (`@/lib/reminders/schedule`), `prisma`
- Produces: `setReminderPrefs(userId, { remindHour, tz }): Promise<{ remindHour: number | null; tz: string; nextRemindAt: Date | null }>`

- [ ] **Step 1: Sửa schema**

```prisma
model Settings {
  id               String @id @default(cuid())
  userId           String @unique
  requestRetention Float  @default(0.9)
  newCardsPerDay   Int    @default(20)
  reviewsPerDay    Int    @default(200)
  theme            String @default("system")
  dailyGoalXp      Int    @default(60)

  // ── Nhắc học ──────────────────────────────────────────────────────
  // remindHour: giờ ĐỊA PHƯƠNG 0–23; null = tắt nhắc (mặc định của mọi hàng cũ,
  // nên không ai bị bật ngầm khi tính năng deploy).
  remindHour Int?
  // IANA, không phải offset phút: offset lưu cứng sai đúng ngày đổi DST.
  tz         String @default("Asia/Ho_Chi_Minh")
  // Con trỏ DẪN XUẤT, và là ngoại lệ có chủ ý của nguyên tắc "Settings = user đặt
  // tay". Nó ở đây vì cap "1 lời nhắc/ngày" được cưỡng chế bằng MỘT câu update có
  // điều kiện trên đúng hàng này (xem /api/cron/reminders); tách sang bảng riêng
  // thì cron phải join rồi ghi hai nơi, và tính chất quan trọng nhất của tính năng
  // lại phụ thuộc vào việc hai ghi đó không lệch nhau.
  nextRemindAt DateTime?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([nextRemindAt])
}

// Một người học có nhiều thiết bị → không nhét được vào Settings.
model PushSubscription {
  id        String    @id @default(cuid())
  userId    String
  endpoint  String    @unique
  p256dh    String
  auth      String
  userAgent String?
  createdAt DateTime  @default(now())
  lastOkAt  DateTime?
  failCount Int       @default(0)

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
}
```

Thêm vào `model User` danh sách quan hệ: `pushSubscriptions PushSubscription[]`.

- [ ] **Step 2: Đẩy schema lên DB và sinh lại client**

```bash
npm run db:push
```

Expected: `Your database is now in sync with your Prisma schema`, và Prisma client được sinh lại. Nếu báo mất dữ liệu (`data loss`) thì **dừng** — task này chỉ thêm cột nullable và một bảng mới, không có lý do gì mất dữ liệu.

> `prisma` CLI tự đọc `.env`, nhưng script `tsx` thì không (repo dùng `prisma/load-env.ts` cho việc đó). `db:push` là `prisma db push` nên chạy trực tiếp được.

- [ ] **Step 3: Viết `prefs-server.ts`**

```ts
import "server-only";
import { prisma } from "../db";
import { nextRemindAt } from "./schedule";

// BA đường ghi nextRemindAt, thiếu một là tính năng chết lặng: cron chỉ quét
// `nextRemindAt <= now`, nên hàng chỉ có remindHour mà không có nextRemindAt sẽ
// KHÔNG BAO GIỜ được thấy — và không có lỗi nào để truy.
//   1. bật nhắc / đặt giờ lần đầu → tính mốc đầu tiên
//   2. đổi giờ hoặc đổi tz        → tính lại ngay theo giá trị mới
//   3. tắt nhắc                   → xoá cả remindHour và nextRemindAt
export async function setReminderPrefs(
  userId: string,
  patch: { remindHour?: number | null; tz?: string },
  now = new Date()
) {
  const current = await prisma.settings.upsert({
    where: { userId },
    update: {},
    create: { userId },
  });

  const tz = patch.tz ?? current.tz;
  const remindHour =
    patch.remindHour === undefined ? current.remindHour : patch.remindHour;

  const data =
    remindHour === null
      ? { remindHour: null, tz, nextRemindAt: null }
      : {
          remindHour: Math.min(23, Math.max(0, Math.round(remindHour))),
          tz,
          nextRemindAt: nextRemindAt(now, tz, remindHour),
        };

  const saved = await prisma.settings.update({ where: { userId }, data });
  return { remindHour: saved.remindHour, tz: saved.tz, nextRemindAt: saved.nextRemindAt };
}
```

- [ ] **Step 4: Cho `/api/settings` nhận hai trường mới**

```ts
// src/app/api/settings/route.ts — thêm sau khối dailyGoalXp
import { setReminderPrefs } from "@/lib/reminders/prefs-server";

  // remindHour/tz đi đường riêng vì việc lưu chúng còn phải tính lại
  // nextRemindAt — updateSettings() chỉ ghi thẳng nên không dùng được ở đây.
  const touchesReminder =
    body.remindHour === null || typeof body.remindHour === "number" || typeof body.tz === "string";
  if (touchesReminder) {
    await setReminderPrefs(userId, {
      remindHour: body.remindHour === null ? null : typeof body.remindHour === "number" ? body.remindHour : undefined,
      tz: typeof body.tz === "string" ? body.tz : undefined,
    });
  }
```

- [ ] **Step 5: Kiểm tra bằng app thật + DB thật**

```bash
npx tsc --noEmit
npm test
npm run dev
```

```bash
curl -s -X POST localhost:3000/api/settings -H 'Content-Type: application/json' \
  -d '{"remindHour":21,"tz":"Asia/Ho_Chi_Minh"}'
```

Rồi `npm run db:studio` và xác nhận trên hàng `Settings` của mình:

1. `remindHour = 21`, `tz = "Asia/Ho_Chi_Minh"`, và **`nextRemindAt` KHÔNG null** — đó là bài kiểm chính của task này.
2. `nextRemindAt` đúng bằng 14:00 UTC của hôm nay hoặc mai (tuỳ giờ đang chạy).
3. Gửi `{"remindHour":6}` → `nextRemindAt` **thay đổi** theo.
4. Gửi `{"remindHour":null}` → cả `remindHour` và `nextRemindAt` về null.
5. Một user khác (hoặc hàng `Settings` cũ) vẫn có `remindHour = null` — không ai bị bật ngầm.

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma src/lib/reminders/prefs-server.ts src/app/api/settings/route.ts
git commit -m "feat(reminders): reminder schedule columns and push subscriptions

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Lớp in-app — chạy cho mọi người, kể cả người từ chối quyền

**Files:**
- Create: `src/lib/reminders/copy.ts` (thuần)
- Create: `src/lib/reminders/state-server.ts`
- Create: `src/components/reminder-banner.tsx`
- Modify: `src/app/page.tsx` (đọc state, truyền xuống)
- Modify: `src/app/home-view.tsx` (render banner trên hero)
- Modify: `src/lib/i18n/dictionaries.ts` (cả hai nhánh)

**Interfaces:**
- Consumes: `pickReminder`, `countDaysInactive` (`@/lib/reminders/pick`); `computeStreakFromDb` (`@/lib/gamification-checks`); `leechWhere` (`@/lib/study-engine`); `todayStr` (`@/lib/utils`)
- Produces:
  - `reminderCopyKey(kind: ReminderKind): { title: string; body: string }`
  - `getReminderState(userId: string, now?: Date): Promise<Reminder | null>`
  - `<ReminderBanner reminder={…} />`

- [ ] **Step 1: Viết `copy.ts`**

```ts
// Khóa i18n cho từng loại nhắc. Chỉ khóa, không chuỗi cứng — app có hai ngôn ngữ
// và push cũng phải dịch được.
import type { ReminderKind } from "./pick";

export function reminderCopyKey(kind: ReminderKind) {
  return { title: `reminders.${kind}Title`, body: `reminders.${kind}Body` };
}
```

- [ ] **Step 2: Thêm khóa i18n cho cả hai ngôn ngữ**

Nhánh `vi`, khối mới `reminders:` ngang hàng với `home:`:

```ts
    reminders: {
      "streak-riskTitle": "Chuỗi {n} ngày đang chờ bạn",
      "streak-riskBody": "Học một chút hôm nay để giữ chuỗi.",
      dueTitle: "{n} từ đến hạn ôn",
      dueBody: "Ôn đúng hạn là lúc trí nhớ được củng cố nhiều nhất.",
      leechTitle: "{n} từ bạn hay quên",
      leechBody: "Ôn riêng nhóm này một lượt xem sao.",
      winbackTitle: "Đã {n} ngày rồi",
      winbackBody: "Học 5 từ thôi — hai phút là xong.",
      cta: "Học ngay",
      dismiss: "Để sau",
    },
```

Nhánh `en`, cùng cấu trúc: `"streak-riskTitle": "Your {n}-day streak is waiting"`, `"streak-riskBody": "A few minutes today keeps it alive."`, `dueTitle: "{n} words due"`, `dueBody: "Reviewing on time is when memory sticks."`, `leechTitle: "{n} words you keep forgetting"`, `leechBody: "Drill just those for one round."`, `winbackTitle: "It's been {n} days"`, `winbackBody: "Just 5 words — two minutes."`, `cta: "Study now"`, `dismiss: "Later"`.

- [ ] **Step 3: Viết `state-server.ts`**

```ts
import "server-only";
import { prisma } from "../db";
import { todayStr } from "../utils";
import { leechWhere } from "../study-engine";
import { computeStreakFromDb } from "../gamification-checks";
import { pickReminder, countDaysInactive, isSaturdayAppDay, type Reminder } from "./pick";

// Gom ReminderInput từ DB rồi giao quyết định cho pickReminder. CÙNG hàm mà cron
// dùng — đó là điều giữ cho banner in-app và push không bao giờ nói khác nhau.
export async function getReminderState(userId: string, now = new Date()): Promise<Reminder | null> {
  const today = todayStr(now);

  const [todayStat, streak, dueCount, leechCount, activeDays] = await Promise.all([
    prisma.dailyStat.findUnique({
      where: { userId_dateStr: { userId, dateStr: today } },
      select: { totalCount: true },
    }),
    computeStreakFromDb(prisma, userId),
    prisma.card.count({ where: { userId, due: { lte: now }, state: { gte: 1 } } }),
    prisma.card.count({ where: leechWhere(userId) }),
    // Chỉ 21 ngày gần nhất: win-back ngừng ở mốc 14 nên xa hơn là vô dụng.
    prisma.dailyStat.findMany({
      where: { userId, totalCount: { gt: 0 } },
      orderBy: { dateStr: "desc" },
      take: 21,
      select: { dateStr: true },
    }),
  ]);

  return pickReminder({
    // "Có hoạt động" = totalCount > 0, đúng predicate computeStreakFromDb dùng.
    studiedToday: (todayStat?.totalCount ?? 0) > 0,
    streak,
    dueCount,
    leechCount,
    daysInactive: countDaysInactive(activeDays.map((d) => d.dateStr), today),
    isSaturday: isSaturdayAppDay(now),
  });
}
```

- [ ] **Step 4: Viết banner**

```tsx
// src/components/reminder-banner.tsx
"use client";

import Link from "next/link";
import { useState } from "react";
import { Bell } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { reminderCopyKey } from "@/lib/reminders/copy";
import type { Reminder } from "@/lib/reminders/pick";

export function ReminderBanner({ reminder }: { reminder: Reminder }) {
  const { t } = useI18n();
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;

  const key = reminderCopyKey(reminder.kind);
  return (
    <div className="card-atelier p-4 mb-6 flex items-center gap-3">
      <Bell size={16} className="text-ember shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{t(key.title, { n: reminder.n })}</p>
        {/* text-soft là class @layer components, KHÔNG phải colour key: text-soft/70
            compile ra rỗng. Dùng opacity riêng. */}
        <p className="text-xs text-soft opacity-80 mt-0.5">{t(key.body, { n: reminder.n })}</p>
      </div>
      <Link
        href={reminder.url}
        className="shrink-0 rounded-full bg-ink text-paper px-4 py-2 text-xs font-medium hover:opacity-90"
      >
        {t("reminders.cta")}
      </Link>
      <button onClick={() => setHidden(true)} className="shrink-0 text-xs text-soft hover:text-ink">
        {t("reminders.dismiss")}
      </button>
    </div>
  );
}
```

- [ ] **Step 5: Nối vào Home**

Trong `src/app/page.tsx`, thêm `getReminderState(user.id)` vào khối `Promise.all` đang lấy stats (đừng thêm một `await` tuần tự — mỗi round-trip tới Postgres serverless đều tính phí độ trễ), rồi truyền `reminder` xuống `<HomeView>`. Trong `src/app/home-view.tsx`, khai báo prop `reminder: Reminder | null` và render **ngay đầu** `<section>` hero (dòng 46), trước khối tiêu đề:

```tsx
      {reminder && <ReminderBanner reminder={reminder} />}
```

- [ ] **Step 6: `tsc`, test, nghiệm trên app thật**

```bash
npx tsc --noEmit
npm test
npm run dev
```

1. Chưa học hôm nay + đang có chuỗi → banner nói về **chuỗi**, không nói về từ đến hạn.
2. Học một phiên rồi refresh Home → banner **biến mất** (trừ thứ Bảy có ≥5 leech).
3. Bấm "Học ngay" → tới `/study`; với ca leech thì tới `/study/cram?scope=leeches`.
4. Bấm "Để sau" → banner ẩn, refresh thì hiện lại (không lưu trạng thái ẩn — có ý đồ: đây không phải thông báo đã đọc).
5. Đổi sang English → không raw key nào (chú ý khóa có dấu gạch: `reminders.streak-riskTitle`).
6. User mới chưa có `DailyStat` nào → **không** có banner win-back (chứng minh `countDaysInactive([])` trả 0).

- [ ] **Step 7: Commit**

```bash
git add src/lib/reminders/copy.ts src/lib/reminders/state-server.ts \
        src/components/reminder-banner.tsx src/app/page.tsx src/app/home-view.tsx \
        src/lib/i18n/dictionaries.ts
git commit -m "feat(reminders): in-app nudge on the home hero, same brain as push

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Web Push — đăng ký, service worker, mục Settings

**Files:**
- Modify: `package.json` (`web-push`)
- Create: `src/lib/reminders/send-server.ts`
- Create: `src/app/api/push/subscribe/route.ts`
- Modify: `public/sw.js` (thêm `push` + `notificationclick`)
- Create: `src/components/reminder-settings.tsx`
- Modify: `src/app/settings/page.tsx` + `src/app/settings/settings-client.tsx` (mục "Nhắc học")
- Modify: `src/lib/i18n/dictionaries.ts` (cả hai nhánh)
- Modify: `.env.example` nếu repo có, và `DEPLOY.md`

**Interfaces:**
- Consumes: `reminderCopyKey`, `Reminder`, `prisma`
- Produces: `sendReminderTo(userId, reminder, lang): Promise<{ sent: number; pruned: number }>`

- [ ] **Step 1: Cài dependency và sinh cặp khoá VAPID**

```bash
npm i web-push
npx web-push generate-vapid-keys
```

Ghi vào `.env.local` (và Vercel Project Settings → Environment Variables khi deploy):

```
VAPID_PUBLIC_KEY=…
VAPID_PRIVATE_KEY=…
VAPID_SUBJECT=mailto:you@example.com
NEXT_PUBLIC_VAPID_PUBLIC_KEY=…   # cùng giá trị với VAPID_PUBLIC_KEY; client cần đọc được
CRON_SECRET=…                     # openssl rand -hex 32
```

> Tự viết VAPID JWT + mã hoá payload AES128GCM là chỗ không nên tự viết — đó là lý do `web-push` là dependency duy nhất của gói C.

- [ ] **Step 2: Viết `send-server.ts`**

```ts
import "server-only";
import webpush from "web-push";
import { prisma } from "../db";
import { dictionaries, type Lang } from "../i18n/dictionaries";
import { reminderCopyKey } from "./copy";
import type { Reminder } from "./pick";

let configured = false;
function configure() {
  if (configured) return;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? "mailto:noreply@example.com",
    process.env.VAPID_PUBLIC_KEY ?? "",
    process.env.VAPID_PRIVATE_KEY ?? ""
  );
  configured = true;
}

// Nội suy khóa i18n ở phía server: service worker không có i18n provider.
function render(key: string, n: number, lang: Lang): string {
  const raw = key.split(".").reduce<any>((o, k) => o?.[k], dictionaries[lang]);
  return typeof raw === "string" ? raw.replace("{n}", String(n)) : key;
}

export async function sendReminderTo(
  userId: string,
  reminder: Reminder,
  lang: Lang = "vi"
): Promise<{ sent: number; pruned: number }> {
  configure();
  const subs = await prisma.pushSubscription.findMany({ where: { userId } });
  if (subs.length === 0) return { sent: 0, pruned: 0 };

  const key = reminderCopyKey(reminder.kind);
  const payload = JSON.stringify({
    title: render(key.title, reminder.n, lang),
    body: render(key.body, reminder.n, lang),
    url: reminder.url,
  });

  let sent = 0;
  let pruned = 0;
  for (const s of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        payload
      );
      sent++;
      await prisma.pushSubscription.update({
        where: { id: s.id },
        data: { lastOkAt: new Date(), failCount: 0 },
      });
    } catch (e: any) {
      // 404/410 = thiết bị đã gỡ app hoặc subscription hết hạn: xoá ngay, đừng
      // giữ lại để gửi mãi vào hư không.
      if (e?.statusCode === 404 || e?.statusCode === 410) {
        await prisma.pushSubscription.delete({ where: { id: s.id } }).catch(() => {});
        pruned++;
      } else {
        await prisma.pushSubscription.update({
          where: { id: s.id },
          data: { failCount: { increment: 1 } },
        });
      }
    }
  }
  return { sent, pruned };
}
```

- [ ] **Step 3: Viết route đăng ký**

```ts
// src/app/api/push/subscribe/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const endpoint = body?.endpoint;
  const p256dh = body?.keys?.p256dh;
  const auth = body?.keys?.auth;
  if (typeof endpoint !== "string" || typeof p256dh !== "string" || typeof auth !== "string") {
    return NextResponse.json({ error: "invalid subscription" }, { status: 400 });
  }

  // endpoint là unique toàn cục: cùng một thiết bị đăng nhập tài khoản khác thì
  // subscription phải CHUYỂN chủ, không tạo hàng thứ hai (nếu không, người mới sẽ
  // nhận nhắc của người cũ trên cùng máy).
  await prisma.pushSubscription.upsert({
    where: { endpoint },
    update: { userId, p256dh, auth, userAgent: req.headers.get("user-agent") ?? undefined, failCount: 0 },
    create: { userId, endpoint, p256dh, auth, userAgent: req.headers.get("user-agent") ?? undefined },
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const endpoint = (await req.json().catch(() => null))?.endpoint;
  if (typeof endpoint !== "string") {
    return NextResponse.json({ error: "endpoint required" }, { status: 400 });
  }
  // Chỉ xoá subscription của chính mình — endpoint là unique nên deleteMany với
  // cả hai điều kiện là cách chặn xoá chéo tài khoản.
  await prisma.pushSubscription.deleteMany({ where: { endpoint, userId } });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Thêm hai handler vào `public/sw.js`**

Đặt **sau** listener `fetch`. Không đụng gì tới logic cache; `CACHE_VERSION` **không** cần bump (precache set và luật cache không đổi).

```js
// ── Push: thông báo nhắc học ─────────────────────────────────────────
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    // Payload không phải JSON (thăm dò từ công cụ dev): vẫn hiện một thông báo
    // chung chứ không im lặng, để lỗi lộ ra sớm.
  }
  const title = data.title || "Atelier";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      // tag cố định: lời nhắc mới THAY lời nhắc cũ chưa đọc thay vì xếp đống.
      tag: "vocab-reminder",
      data: { url: data.url || "/study" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/study";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      // Đang có tab của app thì focus nó rồi điều hướng — mở tab thứ ba mỗi lần
      // bấm thông báo là cách nhanh nhất làm người dùng tắt quyền.
      for (const client of clients) {
        if (new URL(client.url).origin === self.location.origin) {
          return client.focus().then((c) => (c && "navigate" in c ? c.navigate(url) : c));
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
```

Kiểm tra đúng tên file icon trước khi dùng:

```bash
ls public/icons
```

- [ ] **Step 5: Viết mục Settings**

```tsx
// src/components/reminder-settings.tsx
"use client";

import { useState } from "react";
import { useI18n } from "@/components/i18n-provider";

// base64url (VAPID public key) → Uint8Array, dạng PushManager.subscribe đòi hỏi.
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export function ReminderSettings({
  initialHour,
  initialTz,
}: {
  initialHour: number | null;
  initialTz: string;
}) {
  const { t } = useI18n();
  const [hour, setHour] = useState<number | null>(initialHour);
  const [status, setStatus] = useState<"idle" | "saving" | "denied" | "unsupported" | "saved">("idle");

  const save = async (nextHour: number | null) => {
    setStatus("saving");
    // tz lấy tự động — không bắt người dùng chọn múi giờ.
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || initialTz;
    await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ remindHour: nextHour, tz }),
    });
    setHour(nextHour);
    setStatus("saved");
  };

  const enable = async () => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setStatus("unsupported");
      return;
    }
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      setStatus("denied");
      return;
    }
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ""),
    });
    await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sub.toJSON()),
    });
    await save(hour ?? 21);
  };

  const disable = async () => {
    const reg = await navigator.serviceWorker.ready.catch(() => null);
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await fetch("/api/push/subscribe", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: sub.endpoint }),
      });
      await sub.unsubscribe();
    }
    await save(null);
  };

  return (
    <section className="card-atelier p-6 sm:p-7 mb-4">
      <h2 className="display text-xl mb-1">{t("settings.remind")}</h2>
      <p className="text-xs text-soft mb-5">{t("settings.remindDesc")}</p>

      {hour === null ? (
        <button onClick={enable} className="rounded-full bg-ink text-paper px-5 py-2.5 text-sm font-medium hover:opacity-90">
          {t("settings.remindEnable")}
        </button>
      ) : (
        <div className="flex items-center gap-3 flex-wrap">
          <label className="text-sm font-medium">{t("settings.remindHour")}</label>
          <select
            value={hour}
            onChange={(e) => save(Number(e.target.value))}
            className="rounded-2xl border border-line bg-transparent px-4 py-2.5 text-sm"
          >
            {Array.from({ length: 24 }, (_, h) => (
              <option key={h} value={h}>{`${String(h).padStart(2, "0")}:00`}</option>
            ))}
          </select>
          <button onClick={disable} className="text-sm text-soft hover:text-ink underline">
            {t("settings.remindDisable")}
          </button>
        </div>
      )}

      {status === "denied" && <p className="text-xs text-ember mt-3">{t("settings.remindDenied")}</p>}
      {status === "unsupported" && <p className="text-xs text-soft mt-3">{t("settings.remindUnsupported")}</p>}
      <p className="text-xs text-soft opacity-80 mt-3">{t("settings.remindIosHint")}</p>
    </section>
  );
}
```

`src/app/settings/page.tsx` đọc thêm `remindHour`/`tz` từ `Settings` và render `<ReminderSettings>` trong `settings-client.tsx` (đặt trước mục Export). Khóa i18n mới ở **cả hai** nhánh — `vi`: `remind: "Nhắc học"`, `remindDesc: "Mỗi ngày tối đa một lời nhắc, vào giờ bạn chọn."`, `remindEnable: "Bật nhắc học"`, `remindHour: "Giờ nhắc"`, `remindDisable: "Tắt nhắc"`, `remindDenied: "Trình duyệt đã chặn thông báo — bật lại trong cài đặt trang web."`, `remindUnsupported: "Trình duyệt này không hỗ trợ thông báo đẩy."`, `remindIosHint: "Trên iPhone/iPad, thông báo chỉ hoạt động sau khi bạn thêm app vào Màn hình chính."`; `en` tương ứng.

- [ ] **Step 6: Nghiệm — BẮT BUỘC dùng bản production build**

Service worker **chỉ đăng ký khi `NODE_ENV === "production"`** (`sw-register.tsx`), nên `npm run dev` không đăng ký được push. Chạy:

```bash
npx tsc --noEmit
npm test
npm run build && npm start
```

1. Mở `http://localhost:3000/settings` trên **Chrome desktop** → bấm "Bật nhắc học" → trình duyệt xin quyền.
2. `npm run db:studio` → có đúng một hàng `PushSubscription` với `userId` của mình, và `Settings.nextRemindAt` **không** null.
3. Đổi giờ nhắc → `nextRemindAt` đổi theo.
4. "Tắt nhắc" → hàng `PushSubscription` biến mất, `remindHour`/`nextRemindAt` về null.
5. Từ chối quyền (Chrome → Site settings → Notifications → Block) rồi bấm bật → hiện đúng câu `remindDenied`, **không** nổ lỗi và **không** ghi rác vào DB.
6. Firefox: lặp bước 1–2 (Firefox có Web Push, khác iOS).

> **Đừng dùng tab do browser-tool mở để kết luận về thông báo** — đó là tab ẩn. Nghiệm bằng Chrome thật.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json src/lib/reminders/send-server.ts \
        src/app/api/push/subscribe/route.ts public/sw.js src/components/reminder-settings.tsx \
        src/app/settings/page.tsx src/app/settings/settings-client.tsx src/lib/i18n/dictionaries.ts
git commit -m "feat(reminders): web push subscribe, service worker handlers, settings

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Cron — giành suất trước, gửi sau

**Files:**
- Create: `src/app/api/cron/reminders/route.ts`
- Create: `vercel.json`
- Modify: `DEPLOY.md` (biến môi trường + checklist thủ công)

**Interfaces:**
- Consumes: `getReminderState`, `sendReminderTo`, `nextRemindAt`, `prisma`
- Produces: `GET /api/cron/reminders` → `{ scanned, sent, silent, skipped, pruned }`

- [ ] **Step 1: Viết route**

```ts
// src/app/api/cron/reminders/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { nextRemindAt } from "@/lib/reminders/schedule";
import { getReminderState } from "@/lib/reminders/state-server";
import { sendReminderTo } from "@/lib/reminders/send-server";

// BẮT BUỘC: gói A từng bị Next prerender một API route thành Static, khiến mọi
// user nhận đúng một payload. Header no-store KHÔNG cứu được.
export const dynamic = "force-dynamic";

const BATCH = 200;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const rows = await prisma.settings.findMany({
    where: { remindHour: { not: null }, nextRemindAt: { lte: now } },
    orderBy: { nextRemindAt: "asc" },
    take: BATCH,
    select: { id: true, userId: true, remindHour: true, tz: true, nextRemindAt: true },
  });

  let sent = 0;
  let silent = 0;
  let skipped = 0;
  let pruned = 0;

  for (const row of rows) {
    // GIÀNH SUẤT TRƯỚC, GỬI SAU. Điều kiện `nextRemindAt: row.nextRemindAt` là mỏ
    // neo: nếu một lần chạy khác (retry, hai cron trùng nhau) đã giành thì
    // count === 0 và ta bỏ qua mà không gửi. Ghi sau khi gửi thì một retry là
    // người dùng nhận hai thông báo, và cap "1 lần/ngày" tụt xuống thành lời hứa.
    const claimed = await prisma.settings.updateMany({
      where: { id: row.id, nextRemindAt: row.nextRemindAt },
      data: { nextRemindAt: nextRemindAt(now, row.tz, row.remindHour!) },
    });
    if (claimed.count === 0) {
      skipped++;
      continue;
    }

    const reminder = await getReminderState(row.userId, now);
    if (!reminder) {
      // Không có gì đáng nói: vẫn đã đẩy nextRemindAt sang mai ở trên, không gửi.
      silent++;
      continue;
    }

    const result = await sendReminderTo(row.userId, reminder);
    sent += result.sent;
    pruned += result.pruned;
  }

  return NextResponse.json({ scanned: rows.length, sent, silent, skipped, pruned });
}
```

- [ ] **Step 2: Tạo `vercel.json`**

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "crons": [
    {
      "path": "/api/cron/reminders",
      "schedule": "0 * * * *"
    }
  ]
}
```

- [ ] **Step 3: Xác nhận plan có cho phép cron mỗi giờ**

Spec cố ý **không** phỏng đoán giới hạn tần suất cron theo plan. Kiểm bằng chính CLI, rồi ghi kết quả vào spec (§3.5) và `DEPLOY.md`:

```bash
npx vercel crons ls
```

Nếu plan không cho `0 * * * *`, **không sửa code** — endpoint chỉ cần `CRON_SECRET` nên đổi sang GitHub Actions và xoá `vercel.json`:

```yaml
# .github/workflows/reminders.yml
name: reminders
on:
  schedule:
    - cron: "0 * * * *"
  workflow_dispatch:
jobs:
  ping:
    runs-on: ubuntu-latest
    steps:
      - run: |
          curl -sS -f -X GET "$URL" -H "Authorization: Bearer $SECRET"
        env:
          URL: ${{ secrets.REMINDERS_CRON_URL }}
          SECRET: ${{ secrets.CRON_SECRET }}
```

- [ ] **Step 4: Nghiệm cap 1 lần/ngày — đây là tiêu chí 4 của spec**

```bash
npm run build && npm start
```

```bash
# 1) Không có secret → 401
curl -s -o /dev/null -w '%{http_code}\n' localhost:3000/api/cron/reminders

# 2) Đặt nextRemindAt về quá khứ trong db:studio, rồi gọi lần một
curl -s localhost:3000/api/cron/reminders -H "Authorization: Bearer $CRON_SECRET"

# 3) Gọi lần hai NGAY LẬP TỨC
curl -s localhost:3000/api/cron/reminders -H "Authorization: Bearer $CRON_SECRET"
```

Kỳ vọng: lần một trả `{"scanned":1,"sent":1,...}` và máy hiện **một** thông báo; lần hai trả `{"scanned":0,"sent":0,...}` và **không** có thông báo thứ hai. Nếu lần hai vẫn gửi thì việc giành suất đang sai — đọc lại Step 1, đừng "sửa" bằng cách thêm cờ đã-gửi.

Nghiệm tiếp:

4. Bấm vào thông báo → mở đúng URL của lý do; nếu app đang mở thì **focus tab đó**, không mở tab mới.
5. Trong `db:studio`, xoá `PushSubscription` rồi gọi cron → `sent: 0`, không nổ.
6. Với user đã học hôm nay và không phải thứ Bảy → `{"silent":1,"sent":0}` **và** `nextRemindAt` vẫn nhảy sang mai (im lặng không được làm treo con trỏ).
7. Gỡ quyền thông báo ở trình duyệt rồi gọi cron → endpoint trả `pruned: 1` khi push service trả 404/410.

- [ ] **Step 5: Cập nhật `DEPLOY.md`**

Thêm một mục cạnh mục PWA đang có, ghi bốn thứ: (a) năm biến môi trường mới (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `CRON_SECRET`) và cách sinh cặp VAPID; (b) kết quả `vercel crons ls` — cron chạy bằng Vercel hay GitHub Actions; (c) `db:push` phải chạy trước khi deploy vì code mới đọc ba cột mới; (d) checklist **không test được headless**:

```markdown
### Nhắc học — test thủ công (KHÔNG test được headless)

- [ ] iPhone/iPad: push CHỈ hoạt động sau khi thêm app vào Màn hình chính. Kiểm cả hai: chưa cài (không xin được quyền, hiện `remindIosHint`) và đã cài (nhận được thông báo).
- [ ] Thông báo khi app đã đóng hoàn toàn (không chỉ ẩn tab).
- [ ] Từ chối quyền → hiện `remindDenied`, không rác trong DB.
- [ ] Bấm thông báo lúc app đang mở → focus tab cũ, không mở tab thứ hai.
- [ ] Nhiều thiết bị cùng tài khoản → mỗi thiết bị một hàng `PushSubscription`, và một lần cron gửi tới tất cả.
- [ ] Cùng thiết bị đổi sang tài khoản khác → subscription CHUYỂN chủ, người mới không nhận nhắc của người cũ.
```

- [ ] **Step 6: Commit**

```bash
git add src/app/api/cron/reminders/route.ts vercel.json DEPLOY.md
git commit -m "feat(reminders): hourly cron that claims the slot before sending

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Sau khi xong cả 6 task

- [ ] `npm test` + `npx tsc --noEmit` + `npm run build` — cả ba xanh.
- [ ] Đối chiếu bảy tiêu chí thành công ở §1 của spec; tiêu chí 4 (một thông báo mỗi ngày kể cả khi cron chạy trùng) đã đo ở Task 6 Step 4, tiêu chí 6 (DST) ở Task 1.
- [ ] Dùng skill `superpowers:requesting-code-review` trước khi merge.
- [ ] Trước khi deploy: `db:push` trên DB đích, năm biến môi trường trên Vercel, và **người chủ repo** chạy `vercel --prod` từ worktree sạch.
- [ ] Sau deploy: gọi tay một lần `curl -H "Authorization: Bearer $CRON_SECRET" https://<domain>/api/cron/reminders` và đọc JSON trả về trước khi tin cron tự chạy.
