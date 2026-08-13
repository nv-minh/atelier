# Kho từ đã học + nhắc học lại — Design

- **Ngày:** 2026-08-13
- **Gói:** B (kho từ đã học) + C (nhắc học lại)
- **Trạng thái:** design đã được người dùng duyệt theo từng section
- **Branch spec:** `docs/vocab-vault-and-reminders`
- **Nền code:** `main` **sau khi** merge gói A (`docs/level-aware-word-selection`)

---

## 1. Bối cảnh

Brainstorm ngày 2026-08-13 tách yêu cầu "user khác trình độ, chỉ muốn học từ trong lĩnh vực của họ" thành bốn gói: **A** = đo trình độ + engine chọn từ mới (xong, chờ merge), **B** = kho từ đã học, **C** = nhắc học lại, **D** = bảng xếp hạng có rival (đã merge `35d6864`). Spec này là hai gói còn lại. Người dùng chọn làm **chung một spec** vì B và C đọc cùng một bộ dữ liệu (`Card.due`, `Card.state`, `Card.stability`, `lapses`) — tách ra thì cùng một truy vấn phải thiết kế hai lần.

### Trạng thái hiện tại — đã kiểm, không phỏng đoán

- **Repo đã có ba từ vựng "phạm vi" rời rạc.** `ExportScope = "all" | "starred" | "learned" | \`cefr:${Level}\`` (`src/lib/export.ts:13`); enum `scope?: "starred" | "leeches"` của study (`src/lib/study-engine.ts:217` và `:393`), parse tay ở `src/app/study/flashcard/page.tsx:22` và `src/app/study/cram/page.tsx:16`; còn `/browse` chỉ biết `q`/`cefr`/`page` (`src/app/browse/page.tsx:12`).
- **`/browse` đã gánh gần hết phần khó của gói B.** Nó đã `include` `cards` (state/due/reps) lọc theo `userId` và đã fetch `wordMark` (starred + note) cho từng dòng trong trang (`src/app/browse/page.tsx:36–54`), đã có search, filter CEFR, phân trang 40, và đã `force-dynamic`.
- **Định nghĩa "đã học" đang bị viết hai lần.** `src/lib/stats.ts:44` viết tay `c.state === 2 || c.state === 3`; `src/lib/export.ts:88` viết `state: { in: [STATES.Review, STATES.Relearning] }` kèm comment giải nghĩa. Cùng một khái niệm, hai chỗ.
- **Hai kiểu truy vấn đã có tiền lệ trong repo.** `getNotebook` đi word-first (mark → word → card), `getLeeches` đi card-first (card → word → mark), cả hai trả cùng kiểu `NotebookEntry` (`src/lib/notebook.ts`). Prisma **không** `orderBy` được qua quan hệ, nên "từ yếu nhất" buộc phải đi card-first.
- **FSRS đã hoàn chỉnh**, `Card` lưu `stability`/`difficulty`/`due`/`state`/`lapses`, đã có `/api/stats/forecast`. Gói C **không cần thuật toán mới**, chỉ cần một lớp *nhắc*.
- **Chưa có bất kỳ hạ tầng thông báo nào.** `public/sw.js` (122 dòng) chỉ có `install` (`:21`), `activate` (`:28`), `fetch` (`:43`) — không `push`, không `notificationclick`. **Không có `vercel.json`** trong repo, nên đây sẽ là cron đầu tiên.
- **App không lưu timezone của user ở bất cứ đâu.**
- **Hợp đồng kiểm thử:** 19 file `*.test.ts`, **không file nào chạm `prisma`**. Repo đã có tiền lệ tách thuần/server rõ ràng: `src/lib/leaderboard/pace.ts` vs `pace-server.ts` — lý do là `server-only` **không resolve được dưới vitest**.
- **Mốc "ngày" của toàn app là UTC.** `todayStr()` dùng `toISOString()`, nên ngày mới bắt đầu lúc **07:00 giờ VN**. `DailyStat`, streak (`computeStreakFromDb`), daily goal đều theo mốc đó.
- **`WordMark.known` chỉ tồn tại trên branch A** (`prisma/schema.prisma`, gói A). DB live **đã có** cột (chạy `prisma db push` hôm A1) nhưng schema trên `main` chưa khai báo nên Prisma client trên `main` không thấy.
- Repo deploy bằng `vercel --prod` từ worktree sạch, **không** có git integration — push lên `main` không deploy.

### Quyết định của người dùng (ghi lại để về sau không phải đoán lại)

1. Gói B phục vụ **cả bốn** nhu cầu: tra lại từ đã gặp, thấy mình đi được bao xa, chọn từ để ôn có chủ đích, và quản lý từ (đánh dấu/reset).
2. Kho từ **mở rộng `/browse`**, không phải trang mới, không phải hợp nhất `/browse` với `/notebook`. `/notebook` giữ nguyên vai trò sổ tay chọn lọc (starred / khó / đã biết).
3. Gói C dùng **in-app làm nền + Web Push opt-in**. Không email.
4. **Bốn lý do nhắc:** có từ đến hạn, sắp đứt chuỗi, leech tích tụ, vắng nhiều ngày (win-back).
5. **Tối đa 1 lời nhắc/ngày**, user chọn giờ; các lý do tranh nhau một suất và xếp theo ưu tiên.
6. **Merge gói A vào `main` trước**, rồi làm B/C từ `main` sạch.
7. Không nhắc "bị vượt hạng" — rival của gói D là hàm thuần tổng hợp nên đó là áp lực xã hội bịa ra, và nó còn buộc cron tính lại cả bảng.
8. Không tách `ReminderState`; `nextRemindAt` nằm trên `Settings` (xem §3.1).

### Tiêu chí thành công

1. Từ `/browse`, người học lọc được đúng năm phạm vi (`mine`, `learned`, `learning`, `known`, `unseen`) kết hợp được với `q`, `cefr`, `topic`, và **mỗi kết hợp đều có đường đi thẳng sang một phiên học và sang export** mà không cần bảng dịch từ vựng nào.
2. Không có định nghĩa "đã học" thứ ba: `stats.ts`, `export.ts` và kho từ dùng **cùng một hằng** `LEARNED_STATES`.
3. `reset` một từ **không làm thay đổi XP** của người học, kể cả sau khi chạy lại `db:backfill-xp --force`.
4. Một người học bật nhắc nhận **đúng một** thông báo mỗi ngày, kể cả khi cron chạy trùng hoặc retry — tính chất này được cưỡng chế bởi dữ liệu, không bởi chính sách trong code.
5. `pickReminder` là hàm thuần và bảng ưu tiên của nó được ghim bằng test, gồm cả nhánh "không có gì đáng nói → không gửi".
6. `nextRemindAt` đúng qua cả hai ca DST (giờ không tồn tại và giờ xảy ra hai lần) mà không thêm dependency ngày-giờ nào.
7. Người học đang có `Settings` **không** bị bật nhắc ngầm sau khi C deploy.

### Ngoài phạm vi

Push "bị vượt hạng"; email nhắc; công tắc riêng cho từng lý do nhắc; quiet hours (vô nghĩa khi chỉ có 1 suất/ngày do user tự chọn giờ); xoá `Card`; truyền danh sách id vào phiên học; đổi mốc app-day sang giờ địa phương; Badging API đếm số trên icon; hợp nhất `/browse` với `/notebook`. **Zipf cho lô crawl sau không thuộc spec này** — đó là việc bounded riêng ở `scripts/packs/build-crawl-batch.ts`, chỉ có ý nghĩa khi có lô crawl mới.

---

## 2. Gói B — kho từ sống trong `/browse`

### 2.1 Một từ vựng phạm vi dùng chung

Trục của gói B **không** phải là UI mà là việc gom ba từ vựng phạm vi rời rạc về một chỗ. Nếu B thêm bộ lọc thứ tư, mọi nút "Ôn từ này"/"Xuất" sẽ cần bảng dịch giữa bốn từ vựng — và bảng dịch đó là nơi lỗi sẽ sống.

`src/lib/vault/scope.ts` — **thuần, có test**:

```ts
export const SCOPES = [
  "all", "mine", "learned", "learning", "known", "unseen", "starred", "leeches", "weak",
] as const;
export type Scope = (typeof SCOPES)[number];

// Mỗi nơi tiêu thụ khai báo tập con nó nhận; parse trả null khi không hợp lệ.
// Ba tập con, khai báo dứt khoát — không để chỗ nào "tuỳ ý mở rộng sau":
export const BROWSE_SCOPES = ["all","mine","learned","learning","known","unseen"] as const;
export const STUDY_SCOPES  = ["starred","leeches","weak"] as const;
export const EXPORT_SCOPES = ["all","mine","learned","learning","known","unseen","starred","leeches"] as const;

export function parseScope(raw: string | null, allowed: readonly Scope[]): Scope | null;
export function scopeWhere(scope: Scope, userId: string): Record<string, unknown>;
```

`scopeWhere` trả mảnh Prisma `where` trên `Word`:

| scope | mảnh `where` |
|---|---|
| `all` | `{}` |
| `mine` | `OR: [ { cards: { some: { userId } } }, { marks: { some: { userId, OR: [{ starred: true }, { known: true }] } } } ]` |
| `learned` | `cards: { some: { userId, state: { in: LEARNED_STATES } } }` |
| `learning` | `cards: { some: { userId, state: { in: [STATES.New, STATES.Learning] } } }` |
| `known` | `marks: { some: { userId, known: true } }` |
| `unseen` | `cards: { none: { userId } }` |
| `starred` | `marks: { some: { userId, starred: true } }` |
| `leeches` | `cards: { some: { userId, ...leechCardWhere() } }` |

**`learning` gồm cả state 0.** `Card` chỉ được tạo khi từ đã được đưa vào một phiên học (`fetchNewCards`), nên một card `state = 0` là từ *đã gặp mà chưa tốt nghiệp* — với người học đó là "đang học". `stats.ts` gọi nó là `newCardsSeen` và đếm riêng, nên khi nghiệm phải nhớ: **`learning` của kho từ = `learningCards` + `newCardsSeen` của `/stats`**, không phải `learningCards`. Nếu bỏ state 0 ra thì có một nhóm từ không thuộc phạm vi nào ngoài `mine`, và người học sẽ không tìm lại được chúng.

**`leeches` không được định nghĩa lần thứ hai.** `study-engine.ts` đang có `leechWhere(userId)` trả `where` trên `Card`; bóc phần điều kiện không liên quan `userId` ra thành `leechCardWhere()` rồi dùng cho cả hai chỗ. Nếu chép lại `lapses >= LEECH_THRESHOLD, state >= 1` vào `scope.ts` thì repo có hai định nghĩa leech, đúng thứ mà tiêu chí 2 đang cấm với "đã học".

`cefr`, `topic`, `q` **vẫn là tham số riêng**, không nhồi vào scope — vì thế `cefr:A1` của `ExportScope` cũ được `parseScope` nhận như **alias hợp lệ** map sang `{ scope: "all", cefr: "A1" }`, giữ nguyên mọi URL export đang chạy. Filter `topic` dùng đúng khuôn đã có: `topics: { contains: '"slug"' }` (`study-engine.ts:122`).

**Dọn dẹp có chủ đích, trong phạm vi:** `LEARNED_STATES` lên nằm cạnh `STATES` trong `src/lib/fsrs.ts`; `stats.ts:44` và `export.ts:88` sửa để dùng nó. Không dọn gì khác.

### 2.2 Module

`src/lib/vault/`:

| file | loại | trách nhiệm |
|---|---|---|
| `scope.ts` | thuần | từ vựng scope, parse, `scopeWhere` |
| `summary.ts` | thuần | biến kết quả `groupBy` thô thành `VaultSummary` |
| `summary-server.ts` | server | 3 query: `card.groupBy(state)`, `wordMark.count({known})`, `word.groupBy(cefr)` |
| `weak-server.ts` | server | card-first: `orderBy: { stability: "asc" }`, `state: { gte: 1 }`, giới hạn `limit` |
| `bulk.ts` | server | `applyBulk(userId, wordIds, action)` |

Không gọi `getDashboardStats` cho dải tổng hợp: hàm đó còn fetch 100 `ReviewLog` + CEFR fanout mà dải này không cần.

### 2.3 Dải tổng hợp

Trên đầu danh sách: `1.204 từ thuộc · 318 đang học · A2 68%` cùng hai nút `[Ôn 20 từ yếu nhất]` và `[Xuất]`. Số liệu từ `getVaultSummary(userId)`. Dải này là toàn bộ phần "thấy mình đã đi được bao xa" của gói B — biểu đồ chi tiết theo CEFR **đã có** ở `/stats` (`src/components/stats/cefr-progress.tsx`), không dựng lại.

### 2.4 Hành động hàng loạt, và `reset` không được xoá log

`POST /api/vault/bulk` với `{ wordIds: string[], action }`, `action` ∈ `mark-known` | `unmark-known` | `star` | `unstar` | `reset`. Chặn: chỉ nhận `wordIds` trong **trang hiện tại** (tối đa 40 id), luôn thao tác trong phạm vi `userId` của session.

**`reset` chỉ đưa `Card` về `state = 0, due = now, stability = 0, difficulty = 0, elapsedDays = 0, scheduledDays = 0` và giữ nguyên toàn bộ `ReviewLog`.** Lý do là ràng buộc thật, không phải khẩu vị: `UserProgress.xp` và `DailyStat.xp` là **ReviewLog-derived** và `db:backfill-xp --force` dựng lại `xp` từ `ReviewLog`, nên xoá log nghĩa là XP của người học **tụt âm thầm ở lần backfill sau** — một lỗi không thể truy ra từ triệu chứng. `reps`/`lapses` cũng giữ, vì chúng là lịch sử đã xảy ra chứ không phải trạng thái lịch.

**Không có hành động xoá `Card`.** "Đừng hỏi tôi từ này nữa" đi bằng `mark-known`, vì đó là tín hiệu đảo lại được, còn xoá thì không — và engine chọn từ của gói A **hạ ưu tiên** từ `known` chứ không xoá nó (đây là quyết định đã chốt của gói A, spec này không được phá).

### 2.5 Handoff: nút mang theo bộ lọc, không mang theo lựa chọn tay

`[Ôn 20 từ yếu nhất]` → `/study/cram?scope=weak&cefr=…&topic=…`; `[Xuất]` → `/api/export?format=csv&scope=…&cefr=…&topic=…`. Checkbox **chỉ** dùng cho bulk mark/reset, **không** có đường truyền danh sách id vào phiên học: một nguồn sự thật duy nhất cho "phiên này gồm những từ nào", và URL tự mô tả được nó.

Hai chỗ phải sửa theo: `study-engine.ts` nhận thêm `scope: "weak"` (đường card-first, không có nhánh SRS — giống `leeches` đã làm, vì từ yếu thường không đến hạn), và `getExportRows` nhận `{ scope, cefr, topic, q }` rồi dùng `scopeWhere` thay cho bốn nhánh `if` hiện tại. Phần tạo dòng CSV/Anki của `export.ts` **không** đổi.

### 2.6 Guest

Chip phạm vi khoá bằng `AuthRequired` đúng khuôn `page > 1` đang chạy (`browse/page.tsx:24–29`) — guest không có `Card` nào nên mọi phạm vi ngoài `all` đều rỗng, và hiện danh sách rỗng thì tệ hơn là mời đăng nhập.

---

## 3. Gói C — nhắc học lại

### 3.1 Lược đồ

`Settings` thêm:

```prisma
remindHour   Int?      // giờ địa phương 0–23; null = tắt nhắc
tz           String    @default("Asia/Ho_Chi_Minh")  // IANA
nextRemindAt DateTime?
```

Model mới:

```prisma
model PushSubscription {
  id         String   @id @default(cuid())
  userId     String
  endpoint   String   @unique
  p256dh     String
  auth       String
  userAgent  String?
  createdAt  DateTime @default(now())
  lastOkAt   DateTime?
  failCount  Int      @default(0)

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
}
```

Một user có nhiều thiết bị nên subscription không nhét được vào `Settings`.

**`nextRemindAt` là ngoại lệ có chủ ý.** Schema đang ghi rõ nguyên tắc "Settings = user đặt tay; UserProgress/LearnerProfile = hệ thống suy ra", và `nextRemindAt` là con trỏ dẫn xuất. Nó vẫn nằm trên `Settings` vì cap 1 lần/ngày được cưỡng chế bằng **một câu update có điều kiện trên đúng hàng đó** (§3.2); tách bảng thì cron phải join rồi ghi hai nơi, và tính chất quan trọng nhất của tính năng lại phụ thuộc vào việc hai ghi đó không lệch nhau. Ngoại lệ này phải có comment trong schema nói đúng lý do trên.

### 3.2 Giành suất trước, gửi sau

Cron **không** được gửi rồi mới ghi. Thứ tự bắt buộc:

```ts
const claimed = await prisma.settings.updateMany({
  where: { id, nextRemindAt: readValue },      // đúng giá trị vừa đọc
  data:  { nextRemindAt: nextLocalHour },
});
if (claimed.count === 0) continue;             // lần chạy khác đã giành — không gửi
```

0 hàng bị đổi = đã có người giành. Đây đúng khuôn race-safety mà repo dùng cho `Achievement` (unique index + P2002 làm mỏ neo, xem comment trong `schema.prisma`). Nếu gửi trước rồi mới ghi thì một lần cron retry là người dùng nhận hai thông báo — và cap "1 lần/ngày" tụt xuống thành lời hứa thay vì bất biến.

Khi `pickReminder` trả `null` (không có gì đáng nói): **vẫn** đẩy `nextRemindAt` sang mai, không gửi gì.

### 3.3 Nhân thuần

`src/lib/reminders/`:

| file | loại | trách nhiệm |
|---|---|---|
| `pick.ts` | thuần | `pickReminder(input) → Reminder \| null` |
| `schedule.ts` | thuần | `nextRemindAt(now, tz, remindHour) → Date` |
| `copy.ts` | thuần | khóa i18n cho từng `kind` |
| `state-server.ts` | server | gom `ReminderInput` từ DB |
| `send-server.ts` | server | gửi qua `web-push`, dọn subscription chết |

```ts
type ReminderInput = {
  studiedToday: boolean;   // DailyStat của app-day
  streak: number;
  dueCount: number;        // Card due <= now, state >= 1
  leechCount: number;      // lapses >= LEECH_THRESHOLD
  daysInactive: number;
};
type ReminderKind = "streak-risk" | "due" | "leech" | "winback";
```

Ưu tiên: **`streak-risk` > `due` > `leech` > `winback`**.

- `streak-risk`: `!studiedToday && streak >= 1`
- `due`: `!studiedToday && dueCount > 0`
- `leech`: `leechCount >= 5` và chỉ vào **thứ Bảy** (dùng `isoWeekMonday`/`addUtcDays` ở `src/lib/utils.ts`) — leech không cấp bách, nhắc hàng ngày là spam
- `winback`: `daysInactive ∈ {3, 7, 14}` và **chỉ** ba mốc đó, sau 14 ngày thì ngừng hẳn. Ngày 4, 5, 6 phải ra `null`.

Không lý do nào khớp → `null`. Đặc biệt: **`studiedToday === true` thì chỉ còn `leech` có thể bắn** — người đã học hôm nay mà vẫn bị nhắc "còn 50 từ đến hạn" là hình phạt cho việc xuất hiện.

`daysInactive` = số app-day liên tiếp gần nhất **không có** `DailyStat` với hoạt động, đếm ngược từ app-day hiện tại; người học hôm nay có `daysInactive = 0`. Dùng lại mốc app-day của `todayStr()`/`addUtcDays`, không tự định nghĩa mốc mới.

`nextRemindAt(now, tz, remindHour)` tìm mốc UTC của lần `remindHour` **giờ địa phương** kế tiếp bằng `Intl.DateTimeFormat` với `timeZone`. Đúng qua DST mà không thêm dependency — và đây chính là lý do lưu IANA `tz` chứ không lưu offset phút: offset lưu cứng sẽ sai đúng vào ngày đổi giờ.

### 3.4 Hai kênh, một bộ não

Lớp in-app gọi **đúng `pickReminder` đó** qua `getReminderState(userId)` để dựng chip/banner ở Home. Thứ tự ưu tiên và câu chữ vì thế không thể lệch giữa push và in-app: không tồn tại bản sao thứ hai của chính sách. Lớp in-app chạy cho **mọi** người học, kể cả người từ chối quyền thông báo hoặc dùng iOS chưa cài PWA vào Home Screen.

### 3.5 Endpoint và lịch

`GET /api/cron/reminders`:

- `export const dynamic = "force-dynamic"` — **bắt buộc**. Gói A đã bị Next prerender `/api/placement/items` thành **Static** khiến mọi user nhận đúng một bộ đề, và header `no-store` không cứu được.
- Chặn bằng `Authorization: Bearer $CRON_SECRET`, trả 401 khi thiếu/sai.
- Quét lô 200 hàng `Settings` có `remindHour != null AND nextRemindAt <= now`, sắp theo `nextRemindAt asc`.
- Trả JSON `{ scanned, sent, skipped, pruned }` để nghiệm bằng `curl` được.

Lịch mặc định: `vercel.json` với `"schedule": "0 * * * *"`. Vì endpoint chỉ cần secret, nếu plan của project hạn chế tần suất cron thì một workflow GitHub Actions `schedule` gọi vào là xong — **không sửa một dòng code**. Giới hạn tần suất theo plan **chưa được xác nhận** (docs Vercel tra được chỉ ra cú pháp, kể cả ví dụ `* * * * *`); phải kiểm bằng `vercel crons ls` lúc thực thi và ghi kết quả vào đây.

Dep mới: **`web-push`**. Tự viết VAPID JWT + mã hóa payload AES128GCM là chỗ không nên tự viết. Env: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `CRON_SECRET`.

Subscription trả **404/410** thì xoá hàng ngay (thiết bị đã gỡ app / hết hạn). Lỗi khác thì `failCount++`.

### 3.6 Service worker

`public/sw.js` thêm hai handler, không đụng logic cache FIFO đang chạy:

- `push`: `event.waitUntil(self.registration.showNotification(title, { body, icon, badge, data: { url }, tag: "vocab-reminder" }))`. `tag` cố định để thông báo mới **thay** thông báo cũ chưa đọc thay vì xếp đống.
- `notificationclick`: đóng thông báo, tìm client đang mở cùng origin → `focus()`; không có thì `clients.openWindow(data.url)`.

### 3.7 Settings

Mục mới "Nhắc học": công tắc bật push (xin quyền tại chỗ, đăng ký subscription qua `POST /api/push/subscribe`; tắt thì `DELETE /api/push/subscribe` xoá đúng `endpoint` của thiết bị đó) + chọn giờ nhắc. `tz` lấy tự động bằng `Intl.DateTimeFormat().resolvedOptions().timeZone` khi user bật, không bắt user chọn. Không có công tắc riêng từng lý do — đã chốt một suất/ngày nên công tắc từng loại chỉ tạo ra trạng thái vô nghĩa.

**Ba lần ghi `nextRemindAt` ngoài cron — thiếu một trong ba là tính năng chết lặng:**

| Sự kiện | Ghi |
|---|---|
| User bật nhắc / đặt `remindHour` lần đầu | `nextRemindAt = nextRemindAt(now, tz, remindHour)` |
| User đổi `remindHour` hoặc `tz` | tính lại ngay theo giá trị mới |
| User tắt nhắc | `remindHour = null`, `nextRemindAt = null` |

Nếu chỉ lưu `remindHour` mà quên tính `nextRemindAt`, cron sẽ không bao giờ thấy hàng đó (điều kiện quét là `nextRemindAt <= now`) và người học không nhận được gì mà cũng không có lỗi nào để truy.

Hàng `Settings` đang tồn tại có `remindHour = null` → **nhắc tắt mặc định**, không ai bị bật ngầm.

---

## 4. Méo mó đã chấp nhận: "hôm nay" là app-day (UTC)

`streak-risk` và `studiedToday` đo theo **app-day**, tức mốc UTC đổi ngày lúc 07:00 giờ VN. Với người học ở VN, nhắc lúc 21:00 là trung thực: app-day vẫn còn tới 07:00 sáng mai. Với người lệch múi nhiều — ví dụ UTC−5 — 21:00 giờ họ đã là 02:00 UTC ngày sau, nên "hôm nay" mà câu nhắc nói tới **đã sang ngày khác** so với cảm nhận của họ.

Cách sửa tận gốc là đổi mốc ngày của toàn app sang giờ địa phương, việc đó phá `DailyStat`, streak, daily goal và cả bảng xếp hạng tuần của gói D — **không làm trong C**. Thay vào đó: test ghim hành vi này để về sau không ai "sửa" nó thành nửa vời, và câu chữ tránh khẳng định mốc giờ cụ thể.

---

## 5. Test & nghiệm

Test đơn vị chỉ chạm module thuần (hợp đồng của repo: 19/19 file test hiện tại không chạm `prisma`):

- `vault/scope.test.ts` — so khớp mảnh `where` cho cả 9 scope; `parseScope` trả `null` với rác và nhận alias `cefr:A1`; `BROWSE_SCOPES` không chứa `weak`.
- `vault/summary.test.ts` — biến `groupBy` thô thành `VaultSummary`, gồm ca "user chưa có card nào".
- `reminders/pick.test.ts` — **bảng ưu tiên** trên `studiedToday × streak × dueCount × leechCount × daysInactive`; ca `streak-risk` thắng `due`; `leech` chỉ vào thứ Bảy; win-back ra `null` ở ngày 4/5/6 và ra `winback` ở 3/7/14; ca "không gì đáng nói → `null`".
- `reminders/schedule.test.ts` — `nextRemindAt` khi giờ nhắc đã trôi qua, khi đúng ngay giờ nhắc, qua giao thừa, với `Asia/Ho_Chi_Minh` (không DST), và **hai ca DST của `America/New_York`**: giờ 02:00 không tồn tại (spring forward) và giờ 02:00 xảy ra hai lần (fall back).

Không test đơn vị (mỏng hoặc chạm DB): `*-server.ts`, `/api/vault/bulk`, `/api/cron/reminders`, `/api/push/subscribe`, `send-server.ts`.

**Nghiệm bằng app thật — bắt buộc, không thay bằng `tsc`/`build`.** Gói A trả giá cho bài học này: ba lỗi thật (`force-dynamic`, khóa i18n thiếu, filter không được compile vào `where`) đều lọt qua `tsc --noEmit` **và** `next build`.

1. `/browse` với từng phạm vi × `cefr` × `topic` × `q`: `learned` khớp `learnedCards` của `/stats`, `learning` khớp `learningCards + newCardsSeen` (xem §2.1); phân trang giữ nguyên tham số; `unseen` không hiện từ nào đã có card.
2. `[Ôn 20 từ yếu nhất]` mở phiên đúng 20 từ và **cùng bộ lọc**; `[Xuất]` tải về đúng tập đó.
3. Bulk: `mark-known` rồi mở `/notebook?tab=known` thấy từ; `reset` rồi kiểm `db:backfill-xp --force` **không** đổi `UserProgress.xp` (đây là tiêu chí 3, phải đo trên DB thật).
4. Guest vào `/browse`: chip phạm vi khoá, trang 1 vẫn xem được.
5. Bật nhắc trên Chrome desktop: quyền được xin, subscription vào DB; `curl` cron endpoint với `CRON_SECRET` → nhận đúng một thông báo; gọi lại lần hai → `{ sent: 0 }`, **không** có thông báo thứ hai (tiêu chí 4).
6. Bấm thông báo → mở đúng URL, và nếu app đang mở thì focus tab đó chứ không mở tab mới.
7. Gỡ quyền/gỡ subscription rồi gọi cron → hàng `PushSubscription` bị xoá (`pruned: 1`).
8. Mọi khóa i18n mới có ở **cả hai** nhánh `vi` và `en` của `src/lib/i18n/dictionaries.ts` — kiểm bằng cách xem UI ở cả hai ngôn ngữ, không chỉ đọc file.

**Không nghiệm được headless, đưa vào checklist thủ công của `DEPLOY.md`** (đúng tiền lệ mic/PWA): push trên iOS **chỉ** hoạt động khi PWA đã cài vào Home Screen; hành vi khi từ chối quyền; thông báo lúc app đã đóng hẳn. Lưu ý sẵn: tab do browser-tool mở là tab ẩn, đừng dùng nó để kết luận về thông báo.

---

## 6. Chia plan triển khai

| Plan | Nội dung | Phụ thuộc |
|---|---|---|
| **0** | Merge `docs/level-aware-word-selection` vào `main`, deploy theo quy trình worktree sạch + `vercel --prod` | — |
| **B1** | `vault/scope.ts` + `LEARNED_STATES` + sửa `stats.ts`/`export.ts` dùng chung, kèm test | Plan 0 |
| **B2** | `/browse`: chip phạm vi + filter `topic` + dải tổng hợp (`summary`) | B1 |
| **B3** | Bulk API + checkbox + `reset` giữ log | B1 |
| **B4** | `scope=weak` cho study + `getExportRows` nhận filter | B1 |
| **C1** | Lược đồ (`Settings` 3 cột + `PushSubscription`) + `db push` | Plan 0 |
| **C2** | `reminders/pick.ts` + `schedule.ts` + `copy.ts`, kèm test — **không** chạm DB | — |
| **C3** | Lớp in-app: `getReminderState` + chip/banner Home | C2 |
| **C4** | `web-push` + `/api/push/subscribe` + sw.js `push`/`notificationclick` + mục Settings | C1 |
| **C5** | `/api/cron/reminders` (giành suất trước, gửi sau) + `vercel.json`/GitHub Actions + env trên Vercel | C1, C2, C4 |

**B ship được một mình:** không đổi schema, không dep mới, không env mới — nó chỉ đọc dữ liệu đã có. Đó là lý do B đi trước C.

---

## 7. Giả định do tác giả spec quyết, không do người dùng chọn

1. **`mine` gồm cả từ chỉ được `star`/`known` mà chưa có `Card`.** "Từ của tôi" là quan hệ của người học với từ, không phải riêng lịch ôn.
2. **`leech` chỉ nhắc thứ Bảy**, ngưỡng `leechCount >= 5`. Người dùng chọn "leech tích tụ" là một lý do nhắc nhưng không định tần suất; nhắc hàng ngày về việc không cấp bách là cách nhanh nhất để bị tắt.
3. **Win-back dừng sau ngày 14.** Người đã rời app 3 tuần thì thông báo là spam, không phải nhắc.
4. **Bulk giới hạn trong 40 id của trang hiện tại.** Không có "chọn tất cả 1.204 từ" — một cú `reset` như thế không có đường lùi.
5. **Dải tổng hợp không vẽ biểu đồ.** `/stats` đã có `cefr-progress`; vẽ lại là hai nguồn sự thật cho cùng một con số.
6. **`tag: "vocab-reminder"` cố định** để thông báo mới thay cái cũ chưa đọc.
7. **`tz` lấy tự động từ trình duyệt lúc user bật nhắc**, không có ô chọn múi giờ. Ai đi du lịch thì bật/tắt lại là cập nhật.
8. **`weak` không thuộc `EXPORT_SCOPES`.** "Yếu nhất" chỉ có nghĩa cùng với một `limit`, mà export không có khái niệm giới hạn — "xuất toàn bộ từ yếu" là xuất mọi từ đã học theo thứ tự khác.
9. **Học hôm nay rồi thì im lặng** (trừ `leech` thứ Bảy). Người dùng chọn cả bốn lý do nhưng không nói lý do nào được phép bắn khi họ đã học; nhắc tiếp là hình phạt cho việc xuất hiện.
