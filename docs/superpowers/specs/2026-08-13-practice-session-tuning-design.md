# Tinh chỉnh phiên luyện tập sau Plan 1 — Design

**Ngày:** 2026-08-13
**Trạng thái:** đã được duyệt (brainstorming), chờ lập kế hoạch thực thi
**Phạm vi:** `deriveSessionLimits`, `buildSessionPlan`, `REVEAL_MS` của `PracticeShell`
**Nhánh:** `practice-session-foundation` (tiếp ngay sau `931a77b`)

---

## 1. Bối cảnh

Plan 1 (`docs/superpowers/plans/2026-08-12-practice-session-foundation.md`, Task 1–8) đã merge vào nhánh này, CI + Vercel preview pass. Chạy thật lộ ra hai điều: một thay đổi hành vi đúng-theo-spec nhưng sai-cảm-giác, và một khoảng chờ trông giống đúng cái lock mà Plan 1 đặt ra để xoá.

Đây là **gói A** trong ba gói được chốt cho lượt việc này:

| Gói | Nội dung | Nhánh |
|---|---|---|
| **A (spec này)** | Sàn từ mới cho ngày có backlog + `REVEAL_MS` theo mode | nhánh hiện tại |
| B | Âm thanh UI + tối ưu UI/UX mobile + PWA install prompt | nhánh mới |
| C | Thêm Google OAuth, ẩn login GitHub | nhánh nhỏ riêng |

Ba gói độc lập, mỗi gói một chu trình spec → plan → thực thi riêng. Thứ tự: A → B → C (đã xác nhận login GitHub trên production vẫn dùng được, nên C không phải việc chặn).

### Quyết định của người dùng (ghi lại để về sau không phải đoán lại)

| Câu hỏi | Chốt |
|---|---|
| Chia 5 việc thành mấy spec | **3 gói** A / B / C như bảng trên |
| Ngày có backlog có nên vẫn chèn từ mới | **Có** — giữ sàn từ mới mỗi phiên |
| Sàn tính thế nào | **Theo tỷ lệ ⌊size/3⌋** (15 → 5, 10 → 3, 20 → 6), không phải số cố định |
| Có thêm field Settings để user tự chỉnh sàn không | **Không** — YAGNI, hằng số là đủ |
| Thứ tự làm | A → B → C |
| `REVEAL_MS` flashcard | **180ms** (đúng con số của code cũ), không phải 0ms |
| Có sửa `RatingButtons` không | **Không** — xem mục 3.3 |

### Tiêu chí thành công

1. Phiên 15 thẻ với backlog 45 thẻ đến hạn vẫn có **5 từ mới**, không phải 0.
2. User đã học hết mọi từ khớp filter vẫn nhận **đủ 15 thẻ** đến hạn — sàn không được làm phiên teo lại.
3. Không tạo thêm row `Card` rác nào so với hiện tại (bất biến D5 của spec gốc).
4. Bấm điểm ở flashcard → sang thẻ kế trong ~0.2s, không thấy 4 nút xám đi.
5. Ba mode tự chấm (quiz / gõ / nghe-viết) giữ nguyên 1200ms để còn đọc được đáp án.

### Ngoài phạm vi

Âm thanh, animation, haptic, PWA, auth (→ gói B, C). Hub và `Settings.sessionSize` vẫn thuộc Plan 4 của spec gốc, spec này không kéo lên sớm. Không đụng `newCardsPerDay` / `reviewsPerDay` — đó vẫn là ngân sách ngày của FSRS và nó đang đúng.

---

## 2. Việc 1 — Sàn từ mới cho ngày có backlog

### 2.1 Hành vi hiện tại và vì sao phải đổi

`deriveSessionLimits` (`src/lib/practice/session-limits.ts:26-27`) lấp due trước, từ mới chỉ nhận phần dư:

```ts
const reviewLimit = Math.min(size, due, dailyReview);
const newLimit = Math.max(0, Math.min(size - reviewLimit, newAllowance));
```

Đúng theo spec gốc §5 ("thẻ đến hạn trước… thiếu thì bù bằng từ mới") và đúng FSRS về mặt ưu tiên. Nhưng hệ quả: backlog 45 thẻ + phiên 15 thẻ = **ba phiên liền không có từ mới nào**. Queue cũ (`buildStudyQueue`) thì mỗi ngày vẫn đưa 20 từ mới bất kể backlog. Với người học 5–10 phút mỗi ngày, nghỉ vài ngày rồi quay lại mà không học được từ nào mới là một cú mất động lực — trong khi ưu tiên FSRS thật ra vẫn giữ được nếu chỉ nhường ra một phần ba phiên.

### 2.2 Số học mới

Hàm vẫn thuần, vẫn cùng signature, chỉ đổi thân:

```ts
const floor = Math.min(Math.floor(size / 3), newAllowance);
const reviewLimit = Math.min(size - floor, due, dailyReview);
const newLimit = Math.min(size - reviewLimit, newAllowance);
```

`size: "all"` **không đổi**: trả nguyên `{ reviewLimit: dailyReview, newLimit: newAllowance }`. Kẹp âm/thập phân của đầu vào giữ nguyên như hiện tại (`Math.max(0, Math.floor(...))` trên cả ba tham số số lượng).

Ba tính chất đáng nói:

- **Sàn là sàn mềm.** Nó bị kẹp bởi `newAllowance` trước tiên, nên hết hạn mức ngày thì due lấp trọn phiên — sàn không bao giờ giữ chỗ trống.
- **Thiếu due thì sàn không cản.** `newLimit = size - reviewLimit` chứ không phải `= floor`, nên due=3 vẫn cho 12 từ mới như hiện tại.
- **Phiên dưới 3 thẻ thì không có từ mới.** `⌊2/3⌋ = 0`. Cố ý: một phiên 1–2 thẻ nên dùng trọn cho việc cấp bách hơn.

### 2.3 Cạm bẫy phải xử lý: hạn mức ≠ số từ mới thật có

`newAllowanceToday` là **hạn mức còn lại của ngày**, không phải số từ mới thật còn trong DB. Nếu user đã học hết mọi từ khớp filter, `newAllowance` vẫn là 20 nhưng `fetchNewCards` trả về 0. Khi đó sàn 5 đã cắt `reviewLimit` xuống 10, và không có gì bù vào → **phiên 15 thẻ tụt còn 10**. Bỏ qua chỗ này là biến một cải tiến thành một hồi quy.

Cách chữa: gọi **đúng hàm thuần đó hai lần** trong `buildSessionPlan`, và đảo thứ tự fetch — mới trước, due sau:

```ts
const budget = deriveSessionLimits({
  size: opts.size, dueAvailable, newAllowanceToday, dailyReviewLimit: settings.reviewsPerDay,
});

// Fetch new FIRST: how many new cards actually exist decides how many due to take.
const newCards = await fetchNewCards(userId, where, wordFilter, starredIds, budget.newLimit);

// Same pure function, second call: newAllowanceToday is now the REAL count.
const actual = deriveSessionLimits({
  size: opts.size, dueAvailable,
  newAllowanceToday: newCards.length, dailyReviewLimit: settings.reviewsPerDay,
});

const dueCards = await fetchDueCards(where, actual.reviewLimit);
const queue = [...dueCards, ...newCards];   // display order stays due-first
```

Slot từ mới không dùng được trả về cho due. Thứ tự hiển thị vẫn due-first vì thứ tự `queue` do phép nối quyết định, không do thứ tự fetch.

Mẫu gọi-hai-lần này dùng chung cho cả `size: "all"`, không cần nhánh `if` riêng: nhánh `"all"` của hàm bỏ qua `newAllowanceToday` khi tính `reviewLimit` (luôn trả `dailyReview`), nên lần gọi thứ hai trả đúng cùng giá trị như lần đầu — hành vi `"all"` không đổi so với hiện tại.

**Bất biến D5 vẫn giữ** (không tạo row `Card` rác). Chứng minh: `fetchNewCards` được gọi với `limit = budget.newLimit ≤ ⌊size/3⌋`, nên `newCards.length ≤ ⌊size/3⌋`. Ở lần gọi thứ hai, `floor = min(⌊size/3⌋, newCards.length) = newCards.length`, do đó `reviewLimit ≤ size − newCards.length`, và `newLimit = min(size − reviewLimit, newCards.length) = newCards.length`. Tức **mọi thẻ mới đã fetch đều được hiển thị** — không bao giờ fetch thừa rồi cắt. Số stub tối đa tạo ra mỗi phiên là `⌊size/3⌋` (5 với phiên mặc định), thấp hơn hiện tại.

`remaining` không đổi công thức: `due: dueAvailable − dueCards.length`, `new: newAllowanceToday − newCards.length`. Giá trị `remaining.due` sẽ lớn hơn trước (vì lấy ít due hơn) — đúng, nó nuôi nút "Học tiếp N thẻ" ở tổng kết.

Một chi phí phải nói rõ: backlog rút chậm hơn. 45 thẻ nợ cần ~4,5 phiên thay vì 3. Đây là cái giá đã biết của quyết định, không phải sơ suất.

### 2.4 Sửa spec gốc

Spec gốc §5 nói "Thứ tự lấp: **thẻ đến hạn trước**, thiếu thì bù bằng từ mới". Câu đó nay được **bổ sung**, không bị thay: due vẫn ưu tiên, nhưng sau khi đã giữ trước ⌊size/3⌋ slot cho từ mới trong hạn mức ngày. Ghi vào spec này để lần sau đọc `session-limits.ts` không tưởng là code lệch spec.

---

## 3. Việc 2 — `REVEAL_MS` theo từng mode

### 3.1 Nguyên nhân thật

`REVEAL_MS = 1200` (`src/components/practice/practice-shell.tsx:16`) dùng chung cho cả 4 mode. Nhưng con số không phải toàn bộ câu chuyện. Code cũ (`study-session.tsx:89,97` trước commit `b55ff75`) làm **hai** việc khi user bấm điểm:

```ts
setFlipped(false);                                   // phản hồi tức thì: thẻ lật về mặt trước
setTimeout(() => { ...; setIndex(i => i + 1); }, 180);
```

Shell mới không có phản hồi nào trong cửa sổ 1200ms đó: thẻ đứng nguyên ở mặt sau, và `RatingButtons` có `disabled:opacity-50` (`rating-buttons.tsx:38,45`) nên cả 4 nút xám đi suốt một giây. Chạm chỗ nào cũng đi tiếp ngay (listener D4 vẫn đúng), nhưng nó **đọc như** cái lock 1100ms mà nhánh này đặt ra để xoá.

Với ba mode tự chấm thì 1200ms là đúng: có đáp án đúng và `FeedbackStrip` để đọc. Với flashcard thì cửa sổ đó rỗng — user vừa tự đánh giá, thẻ đã lật rồi, không có gì mới để đọc.

### 3.2 Sửa

`REVEAL_MS` thành map theo mode:

```ts
const REVEAL_MS: Record<PracticeMode, number> = {
  flashcard: 180,    // self-rated: nothing new to read, the card is already flipped
  quiz: 1200,
  typing: 1200,
  dictation: 1200,
  cloze: 1200,
  "image-word": 1200,
};
```

Chỗ dùng: `setTimeout(advance, REVEAL_MS[mode])` trong `onAnswer`. `mode` đã nằm trong deps của `onAnswer` nên không phát sinh dependency mới. Comment ở đầu file và comment ở effect unmount (đang viết "~1.2s") cập nhật theo.

180ms là đúng con số của code cũ — chọn nó thay vì 0ms để giữ một nhịp nghỉ cố ý, và để nút vừa bấm kịp hiện `whileTap` scale 0.95 trước khi thẻ rời đi.

Nhịp thấy được sau khi bấm: 180ms chờ → 200ms anim exit của `AnimatePresence` (`mode="wait"`) → 200ms anim enter của thẻ kế.

### 3.3 Cố ý không sửa `RatingButtons`

Ở 180ms, `disabled:opacity-50` chỉ còn khoảng 3 frame — không nhìn ra. Mà giữ thuộc tính `disabled` thì vẫn còn tác dụng: nó chặn cú bấm điểm thứ hai trong cửa sổ chờ (một nút `disabled` không phát `pointerdown`). Đổi sang `aria-disabled` sẽ kéo theo 3 chỗ khác đang dùng component này — `cram-session.tsx:150`, `topic-viewer.tsx:166`, `study/flashcard.tsx:84` — mà không đổi được gì user thấy. YAGNI.

### 3.4 Không có bug ẩn ở `flipped`

Đã kiểm: `FlashcardMode` reset `flipped` bằng `useEffect` keyed trên `[item]`, và flashcard requeue lại **cùng một object** khi user bấm Again. Về lý thuyết một phiên 1 thẻ (queue thành `[A, A]`) sẽ không đổi reference nên effect không chạy lại. Trên thực tế không xảy ra: shell bọc `View` trong `motion.div` có `key={cardId}-${state.index}` (`practice-shell.tsx:398`), key đổi → subtree remount → `useState(false)` mới. Effect kia chỉ là lớp bảo hiểm. Ghi lại để lần sau không ai "sửa" cái không hỏng.

---

## 4. Test & nghiệm

### 4.1 Test tự động — `src/lib/practice/session-limits.test.ts`

Đúng **một** case hiện có đổi kỳ vọng (case đầu file, "fills the whole session from due cards when there are enough"); sáu case còn lại giữ nguyên kỳ vọng và phải vẫn pass. Thêm ba case mới. Toàn bộ bảng sau khi sửa:

| size | due | hạn mức mới | daily review | → reviewLimit | → newLimit | Ghi chú |
|---|---|---|---|---|---|---|
| 15 | 45 | 20 | 200 | 10 | 5 | **đổi** (cũ: 15 / 0) — chính là case backlog |
| 15 | 45 | 2 | 200 | 13 | 2 | **mới** — sàn bị hạn mức ngày kẹp |
| 15 | 3 | 20 | 200 | 3 | 12 | không đổi — thiếu due thì sàn không cản |
| 15 | 3 | 5 | 200 | 3 | 5 | không đổi — hạn mức ngày kẹp phần bù |
| 15 | 45 | 20 | 10 | 10 | 5 | không đổi — `dailyReviewLimit` vẫn kẹp được |
| 15 | 45 | 0 | 200 | 15 | 0 | **mới** — lần gọi thứ hai: hết từ mới thật → due lấp trọn |
| 2 | 45 | 20 | 200 | 2 | 0 | **mới** — phiên dưới 3 thẻ không có từ mới |
| 15 | 0 | 0 | 200 | 0 | 0 | không đổi |
| 10.7 | −5 | −3 | 200 | 0 | 0 | không đổi — kẹp đầu vào bẩn |
| "all" | 999 | 20 | 200 | 200 | 20 | không đổi |

Viết test trước, xác nhận thất bại, rồi mới sửa `session-limits.ts` — theo TDD như Plan 1.

### 4.2 Nghiệm bằng chạy thật

Spec gốc §12 cố ý không có test component, nên phần shell nghiệm tay:

1. **Sàn từ mới:** có backlog ≥ 20 thẻ đến hạn, mở `/study/flashcard` (size mặc định 15) → header hiện 15, và trong phiên có đúng 5 thẻ mới.
2. **Không teo phiên:** filter tới một scope đã học hết từ mới (ví dụ `?cefr=A1` khi A1 đã học xong) mà vẫn còn ≥ 15 thẻ đến hạn → header hiện 15, không phải 10.
3. **Không có row rác:** đếm `Card` trước/sau khi mở một phiên → tăng tối đa 5.
4. **Flashcard mượt:** bấm 1–4 → thẻ chuyển trong ~0.2s, không thấy 4 nút xám.
5. **Ba mode kia không đổi:** quiz / gõ / nghe-viết vẫn giữ đáp án trên màn ~1,2s, và chạm vào là đi tiếp ngay.

---

## 5. Giả định do tác giả spec quyết, không do người dùng chọn

1. **⌊size/3⌋ dùng `Math.floor`**, nên 20 → 6 (không phải 7). Khớp bảng đã trình bày khi chốt.
2. **Sàn là hằng số trong module**, không phải tham số của `deriveSessionLimits`. Khi Plan 4 làm hub + `Settings.sessionSize`, nếu muốn cho user chỉnh thì lúc đó mới nâng thành tham số.
3. **Fetch mới trước due** là thay đổi thứ tự truy vấn DB, không phải thứ tự hiển thị. Không có transaction nào bị ảnh hưởng vì hai hàm này chỉ đọc (trừ phần tạo stub trong `fetchNewCards`, đã bị chặn trên bởi ⌊size/3⌋).
4. **`cloze` và `image-word`** để 1200ms trong map dù chưa tồn tại (Plan 3 mới làm) — điền sẵn để `Record<PracticeMode, number>` đủ khoá và type-check pass.
