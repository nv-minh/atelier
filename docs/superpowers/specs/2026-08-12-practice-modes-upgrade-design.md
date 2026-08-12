# Nâng cấp các chế độ luyện tập — Design

**Ngày:** 2026-08-12
**Trạng thái:** đã được duyệt (brainstorming), chờ lập kế hoạch thực thi
**Phạm vi:** tầng phiên học, chấm điểm, 2 dạng bài mới, hub, animation

---

## 1. Bối cảnh & mục tiêu

App hiện có 7 chế độ luyện tập. Chúng chạy được nhưng nông ở ba mặt: phiên học không có điểm dừng, các mode tự chấm chỉ ghi được 2 trong 4 mức FSRS, và logic phiên đã bị nhân bản (rồi trôi) qua 4 component riêng biệt.

### Quyết định của người dùng (ghi lại để về sau không phải đoán lại)

| Câu hỏi | Chốt |
|---|---|
| Vấn đề cần giải | Cả ba: chế độ hiện có còn nông, thiếu dạng bài mới, trải nghiệm rời rạc — cộng UI/UX + animation |
| Thói quen học | **Mobile-first**, 5–10 phút, thường xuyên, cần điểm dừng rõ |
| Mục tiêu học | **Giao tiếp / công việc** — cần nói ra được và nghe hiểu, không chỉ nhận ra nghĩa |
| Phạm vi spec | **Một spec cho cả ba** hệ thống, chia phase bên trong |
| Cấu trúc phiên | **Một dạng bài mỗi phiên** — chế độ mix bị loại |
| Giới hạn phiên | Chọn `10 · 20 · Hết thẻ` **tại hub**, mặc định từ Settings |
| Hết giới hạn mà còn thẻ | Tổng kết + nút **"Học tiếp 15 thẻ"** — dừng là mặc định, tiếp là chủ động |
| Chấm điểm mode tự chấm | **Tự suy ra 4 mức** từ tín hiệu riêng từng mode + chip sửa tuỳ chọn, thiên về an toàn |
| Dạng bài mới | Distractor thông minh + **Ảnh → từ** + **Cloze có chấm điểm** |
| Chuyển động | **Gamified có kiểm soát** — giữ palette/typography, thêm combo/haptic/XP bay |

### Tiêu chí thành công

1. Một phiên trên điện thoại kết thúc trong 5–10 phút và **tự dừng**, có tổng kết đáng đọc.
2. Cả 6 mode dựa-trên-thẻ ghi đủ 4 mức FSRS và đều tạo `StudySession` row.
3. Không mode nào chặn người học quá 0ms sau khi đã trả lời (tap là đi tiếp).
4. Thêm một dạng bài mới sau này chỉ cần ~120 dòng, không sửa shell.
5. Logic ghi vào FSRS được test tự động.

### Điều spec này **không** giải quyết

Chọn mode nào cho hôm nay vẫn do người học tự quyết (không có mix/gợi ý tự động). Vì mục tiêu là giao tiếp, gánh nặng "đẩy từ nhận-ra sang nói-ra-được" được chuyển vào **nhóm mode ở hub** (mục 7) và **hai dạng bài mới thiên về sản xuất** (mục 8), chứ không phải vào một scheduler tự chọn dạng bài.

---

## 2. Khuyết điểm đã xác nhận trong code hiện tại

Các điểm dưới đây được xác nhận bằng đọc code / grep, không phải phỏng đoán. Chúng là lý do tồn tại của phần lớn design này.

| # | Khuyết điểm | Bằng chứng | Sửa ở phase |
|---|---|---|---|
| D1 | **Quiz / Gõ / Nghe-viết không tạo `StudySession` row nào.** Hệ quả: mất XP `awardForSessionEnd`, và ba mode này vô hình trong thống kê theo mode. | `study-session.tsx`, `matching-game.tsx`, `pronunciation-session.tsx` đều `fetch("/api/study/session")`; `practice-session.tsx` không có lời gọi nào | 1 |
| D2 | `getQuizDistractors()` (`src/lib/study-engine.ts:356`) là **code chết** — `api/study/quiz-options/route.ts` tự viết lại logic distractor và `shuffle` riêng | `grep -rn getQuizDistractors src/` chỉ trả về đúng dòng định nghĩa | 5 |
| D3 | Filter **Hướng** (`dir`) hiển thị ở hub cho cả 7 mode, nhưng chỉ `flashcard` và `cram` đọc nó. Đổi hướng rồi vào Trắc nghiệm → không có gì xảy ra. | `quiz/typing/dictation/page.tsx` chỉ nhận `searchParams: { cefr, topic }` | 7 |
| D4 | Mỗi thẻ bị **khoá cứng 1.100ms** sau khi trả lời, không cho đi tiếp. 15 thẻ ≈ 16 giây ngồi chờ. | `setTimeout(..., 1100)` + cờ `busy` trong `practice-session.tsx` | 1 |
| D5 | Queue = `reviewsPerDay + newCardsPerDay` = **tối đa 220 thẻ**, không điểm dừng | `buildStudyQueue` trả `.slice(0, reviewLimit + newLimit)`; `Settings` default 200 + 20 | 1 |
| D6 | `quiz-options` treo skeleton **vĩnh viễn** nếu trả về <4 đáp án — không có nhánh lỗi | `practice-session.tsx`: `if (d.options && d.options.length === 4) setQuizOpts(d)`, không có `else` | 1 |
| D7 | Distractor là nghĩa của từ **random cùng CEFR**, không lọc loại từ → loại trừ được mà không cần biết từ | `quiz-options/route.ts`: `where: { cefr, word: { not }, definitionEn: { not: null } }` | 5 |

**D1 là bằng chứng trung tâm cho quyết định kiến trúc ở mục 4:** logic phiên đã bị nhân bản qua 4 component, và cái bị trôi lại là cái quan trọng — ghi phiên và cấp XP. Ba thứ spec này thêm vào (giới hạn phiên, chấm 4 mức, tổng kết) đều là loại logic *phải* giống nhau ở mọi mode.

---

## 3. Dữ liệu — đã đo, không phỏng đoán

Đo trên `data/vocabulary.json` (3.677 từ nền) + `data/packs/*.json` (5.471 từ) + `data/images.json`, khử trùng theo `word` → **6.394 từ duy nhất**.

### Độ phủ theo trường

| Trường | Base | Packs | Kết luận |
|---|---|---|---|
| `example` | 99.5% | 83.8% | đủ cho cloze — nhưng câu **rất ngắn**: median 6 từ, p10 = 3 từ; 23 câu là mẫu ngữ pháp dạng `+ noun, …` |
| `audio` (từ đơn) | 100% | 82.7% | tốt. **Không có audio câu** → nghe-câu phải dùng TTS |
| `synonyms` | 59.4% | 12.3% | pool quá mỏng cho mode đồng nghĩa |
| `antonyms` | 5.4% | 5.0% | mode trái nghĩa không khả thi |
| `extra_definitions` | 99.1% | 34.1% | nguyên liệu tốt cho distractor khó |
| `imageUrl` | ~99.7% (DB) | | mode ảnh khả thi |
| collocation | 0% | 0% | cần pipeline data mới → ngoài scope |

### Pool khả dụng cho hai mode mới

**Ảnh → từ:** 3.741 danh từ (`type_en` chứa `"noun"`), **100% trong số đó có ảnh** — 606 Wikimedia, 3.135 Pexels. Pool dư sức cho phiên 10–20 thẻ.

**Cloze có chấm điểm:** **3.830 từ (59.9%)** thoả cả ba điều kiện: câu ví dụ ≥5 từ, chứa chính từ đó (khớp `\b<word>[\w'-]*`), và không khớp `/^[+(\[]/`. Đây là con số mà test của `eligibility.ts` sẽ neo vào.

`data/images.json` có ghi `source` (`wikimedia` | `pexels`) nhưng `Word.imageUrl` trong DB chỉ là URL. Khi cần biết nguồn, suy từ hostname (`upload.wikimedia.org` vs `images.pexels.com`) — **không** thêm cột.

---

## 4. Kiến trúc

### Quyết định: tách một vỏ phiên (session shell)

`PracticeShell` sở hữu toàn bộ phần không phụ thuộc mode: queue, index, progress, combo, chấm điểm, gọi API, tổng kết, resume. Mỗi mode co lại thành một hàm render **một item** rồi báo kết quả về.

### Phương án đã loại

**Bổ sung từng mode, không refactor.** Rủi ro tức thời thấp, ship dần được. Loại vì: sẽ thành 5–6 bản copy của cùng logic phiên, và **D1 chứng minh drift này đã xảy ra rồi** chỉ với một tính năng. Ba thứ ta thêm đều ghi vào FSRS — sai lệch giữa các mode làm hỏng dữ liệu học chứ không chỉ hỏng UI.

**Shell chỉ cho mode mới, mode cũ để nguyên.** Loại vì tệ nhất cả hai phía: hai hệ thống phiên song song vĩnh viễn, và các mode dùng nhiều nhất thì không được cải thiện.

### Rủi ro của phương án đã chọn, và cách giảm

Refactor sờ vào code đang chạy được; một lỗi trong shell làm sập 6 mode cùng lúc. Giảm thiểu: **Phase 0 dựng lưới test cho các module thuần trước**, rồi Phase 1 dựng shell và migrate **đúng một mode (Trắc nghiệm)**, verify chạy thật, mới migrate phần còn lại ở Phase 2.

### Phân chia module

```
src/lib/practice/
  types.ts          PracticeItem · ItemResult · GradeSignals · SessionPlan
  session-plan.ts   (server) dựng plan có giới hạn N + đếm "còn lại"
  grading.ts        (thuần)  GradeSignals → FSRS Rating, có kẹp an toàn
  session-state.ts  (thuần)  reducer: results → progress · combo · missed · summary
  eligibility.ts    (thuần)  từ nào dùng được cho cloze / ảnh→từ
  distractors.ts    (server) chọn nhiễu cho trắc nghiệm

src/components/practice/
  practice-shell.tsx    vỏ: queue · progress · combo · POST · resume · tổng kết
  session-summary.tsx   %, XP, danh sách từ sai, ôn lại, học tiếp
  combo-meter.tsx
  modes/quiz.tsx · typing.tsx · dictation.tsx · cloze.tsx · image-word.tsx · flashcard.tsx
```

Bốn module thuần (`grading`, `session-state`, `eligibility`, `distractors`) không import Prisma, không dùng DOM → test được không cần DB hay browser. Đây là lý do chúng được tách ra khỏi component.

### Hợp đồng shell ↔ mode

Cố tình hẹp. Mode **không** biết FSRS, không gọi API, không giữ điểm.

```ts
type ModeView = (p: {
  item: PracticeItem;
  reveal: "hidden" | "correct" | "wrong";   // shell quyết định, mode chỉ vẽ
  onAnswer: (r: { correct: boolean; signals: GradeSignals }) => void;
}) => JSX.Element;
```

`onAnswer` được phép gọi bất đồng bộ (mode Phát âm cần chờ speech recognition), nên shell không được giả định chấm điểm là đồng bộ.

Flashcard là biến thể **tự đánh giá**: nó bỏ qua `grading.ts` và truyền thẳng rating người dùng chọn qua một nhánh `onAnswer({ correct, signals: { selfRated: rating } })`. Shell tôn trọng `selfRated` nếu có.

### Mode nào vào shell

| Mode | Vào shell? | Lý do |
|---|---|---|
| Trắc nghiệm, Gõ, Nghe-viết, Flashcard | ✅ Phase 1–2 | đều là "một thẻ → trả lời → chấm" |
| Cloze, Ảnh→từ (mới) | ✅ Phase 6 | sinh ra trong shell |
| **Ghép cặp** | ❌ giữ nguyên | đơn vị của nó là *vòng 6 cặp*, không phải một thẻ — nhồi vào shell sẽ bóp méo shell |
| **Phát âm** | 🔶 Phase 9, tuỳ chọn | item-based nên ghép được, nhưng 645 dòng với luồng xin quyền mic; hợp đồng đã cho phép ghép sau mà không sửa shell |
| **Cram** | ❌ giữ nguyên | không ghi SRS, không cần chấm điểm; sẽ dùng lại `session-summary` ở Phase 4 |

---

## 5. Giới hạn phiên

Không đổi `newCardsPerDay` / `reviewsPerDay` — đó là ngân sách **ngày** của FSRS, đang đúng. Thêm một lớp **kích thước phiên** lên trên.

```ts
buildSessionPlan(userId, {
  mode: PracticeMode;
  cefr?: string; topic?: string;
  size: number | "all";
}): Promise<{
  items: PracticeItem[];
  remaining: { due: number; new: number };  // sau khi trừ plan này
  sizeUsed: number;
}>
```

Thứ tự lấp: **thẻ đến hạn trước** (đúng FSRS), thiếu thì bù bằng từ mới trong hạn mức ngày còn lại.

### Cạm bẫy phải xử lý

`buildStudyQueue` **tạo row `Card`** cho các từ chưa từng gặp (`prisma.card.create` trong nhánh `stillNeeded`). Nếu dựng 220 thẻ rồi cắt còn 15, ta tạo ~200 row rác mỗi lần mở phiên.

Vì vậy `buildSessionPlan` phải:
1. `count` số thẻ đến hạn khớp filter **trước**,
2. suy ra `reviewLimit` / `newLimit` từ `size` (kẹp trong hạn mức ngày),
3. rồi mới gọi `buildStudyQueue` với hai hạn mức đó.

Không bao giờ cắt sau khi build.

`size: "all"` → dùng nguyên hạn mức ngày (hành vi hiện tại). `remaining` nuôi nút "Học tiếp N thẻ" ở tổng kết.

### Nguồn của `size`

- **Phase 1–6:** đọc từ query param `?size=`, mặc định hằng số `DEFAULT_SESSION_SIZE = 15`.
- **Phase 7:** hub render segmented control `10 · 20 · Hết thẻ` set param này, và `Settings` nhận field mới `sessionSize Int @default(15)` làm mặc định (schema change + `npm run db:push` + một dòng trong `updateSettings` và settings UI).

Tách như vậy để Phase 1 không phải kéo theo migration.

---

## 6. Chấm 4 mức FSRS

`src/lib/practice/grading.ts`, hàm thuần, **thiên về an toàn**: khi tín hiệu không rõ thì về `Good`, không bao giờ đoán lên `Easy`.

```ts
type GradeSignals = {
  correct: boolean;
  elapsedMs: number;          // đo từ lúc item THAO TÁC ĐƯỢC
  wordLength: number;         // để chuẩn hoá ngưỡng cho mode gõ
  cardState: number;          // 0 New · 1 Learning · 2 Review · 3 Relearning
  wasHidden: boolean;         // tab từng bị ẩn giữa item
  hintUsed?: boolean;         // cloze · ảnh→từ
  typoAccepted?: boolean;     // gradeTyping trả acceptedAs === "typo"
  replays?: number;           // nghe-viết
  slowedDown?: boolean;       // nghe-viết: tốc độ < 1×
  changedAnswer?: boolean;    // trắc nghiệm
  selfRated?: Rating;         // flashcard — nếu có thì dùng thẳng
};

gradeAnswer(mode: PracticeMode, s: GradeSignals): Rating
```

Luật gồm **hai tầng**: tính một rating cơ sở, rồi áp trần. Tách hai tầng là bắt buộc — nếu viết chung thành một danh sách "khớp trước thắng" thì một thẻ Relearning dùng gợi ý sẽ ra `Good` thay vì `Hard`, tức là **nới lịch cho đúng thẻ đang yếu nhất**.

```
1. Thoát sớm
   selfRated có          → return selfRated        (flashcard)
   !correct              → return Again (1)        luôn luôn, không trần nào áp

2. Rating cơ sở
   hintUsed | typoAccepted | replays >= 3
     | slowedDown | changedAnswer                  → base = Hard (2)
   else elapsedMs < fastThreshold(mode, wordLength) → base = Easy (4)
   else                                            → base = Good (3)

3. Trần
   cap = (cardState === 3 || wasHidden) ? Good (3) : Easy (4)

4. return min(base, cap)
```

Vì thang Rating tăng dần theo độ dễ (`Again 1 < Hard 2 < Good 3 < Easy 4`), `min` chính là phép "không bao giờ đoán lên": `min(Hard, Good) = Hard` (giữ nguyên tín hiệu yếu), `min(Easy, Good) = Good` (chặn Easy). Trần **không bao giờ** nâng một rating lên.

### Hai chi tiết quyết định chất lượng tín hiệu

**Đồng hồ bắt đầu khi item *thao tác được*,** không phải lúc mount. Với trắc nghiệm nghĩa là sau khi `quiz-options` đã tải và animation vào đã xong. Nếu tính từ mount, độ trễ fetch sẽ nhiễm vào `elapsedMs` và ta cấp `Hard` oan cho một câu người học trả lời ngay.

**Ngưỡng "nhanh" của các mode gõ phải theo độ dài từ.** Gõ `serendipity` không thể nhanh bằng `go`. Dùng ngân sách theo ký tự:

| Mode | `fastThreshold` |
|---|---|
| Trắc nghiệm | 3.000ms (cố định — chỉ là một tap) |
| Gõ · Cloze · Ảnh→từ · Nghe-viết | `600 + 200 × wordLength` ms |

Các con số này là **điểm khởi đầu có chủ đích, cần hiệu chỉnh** sau khi có dữ liệu thật. Chúng nằm trong một object hằng số duy nhất ở đầu `grading.ts` để chỉnh một chỗ.

### Chip sửa tuỳ chọn

Ở dải feedback hiện hai chip nhỏ: `quá dễ` (nâng `Good` → `Easy`) và `may mắn thôi` (hạ `Good`/`Easy` → `Hard`). Không bắt buộc tap.

Cơ chế: **POST review bị hoãn đến lúc rời item.** Chip chỉ sửa rating đang chờ trong bộ nhớ, rồi một request duy nhất bay đi. Không cần endpoint re-grade, không cần snapshot card trước review.

Vì rời item sớm bằng tap cũng flush luôn, độ trễ thực tế bằng 0. Phòng trường hợp đóng tab trong khoảng ~1,2s đó: flush bằng `fetch(..., { keepalive: true })` trong handler `pagehide`.

### Ghi nhận về `gradeTyping`

`gradeTyping` (`src/lib/utils.ts`) trả `acceptedAs: "typo"` khi Levenshtein = 1, và `acceptedAs: <synonym>` khi khớp đồng nghĩa. Hai trường hợp này **không** giống nhau:

- `acceptedAs === "typo"` → `typoAccepted: true` → **Hard** (nhớ mờ)
- `acceptedAs` là một đồng nghĩa → đáp án hợp lệ, **không** hạ cấp

---

## 7. Hub

9 mode dàn phẳng trên mobile = cuộn dài, không thứ bậc. Chia nhóm theo **kỹ năng đang luyện**, mỗi thẻ nói trước nó sẽ đưa bao nhiêu thẻ và mất bao lâu.

```
Đến hạn hôm nay · 45 thẻ ôn · 12 từ mới
Phiên:  [10]  [20]  [Hết thẻ]          ← mặc định từ Settings.sessionSize
Lọc ▾   (CEFR · Chủ đề — gập lại trên mobile)

NHẬN DIỆN         Flashcard · Trắc nghiệm
SẢN XUẤT          Gõ đáp án · Ảnh → từ · Cloze
NGHE & NÓI        Nghe & viết · Phát âm
CHƠI & ÔN NHANH   Ghép cặp · Cram
```

Nhóm không chỉ để gọn: nó là cách spec này phục vụ mục tiêu giao tiếp mà không cần chế độ mix — nhóm **SẢN XUẤT** hiện ngay dưới NHẬN DIỆN, nên "gõ / nói ra được" luôn ở trong tầm mắt thay vì nằm lẫn giữa 9 thẻ giống nhau.

Thẻ mode compact 2 cột trên mobile (nhỏ hơn hiện tại) để một nhóm vừa một màn hình.

**Sửa D3:** điều khiển **Hướng** rời khỏi vùng filter chung, chỉ hiện trên thẻ Flashcard và Cram — hai mode thật sự đọc `dir`.

**Thời lượng ước tính** dùng **hằng số theo mode** ở phase này (ví dụ trắc nghiệm ~8s/thẻ, gõ ~15s/thẻ). Cá nhân hoá từ `StudySession` để sau — dữ liệu đó chỉ đáng tin sau khi D1 được sửa và đã tích luỹ đủ phiên thật.

---

## 8. Dạng bài mới & distractor

### 8.1 Distractor thông minh (nâng cấp Trắc nghiệm)

Xoá `getQuizDistractors` chết trong `study-engine.ts` (D2), chuyển logic thật vào `src/lib/practice/distractors.ts`, cho `quiz-options/route.ts` import nó — một nguồn sự thật.

Xếp hạng ứng viên:
1. **Cùng loại từ** (`typeEn`) — sửa trực tiếp D7: hiện tại một danh từ có thể bị hỏi với 3 nhiễu là động từ, loại trừ được mà không cần biết từ
2. Cùng CEFR
3. Độ dài định nghĩa gần với đáp án (tránh nhiễu "đáp án dài nhất là đáp án đúng")

Thêm một nhiễu lấy từ **`extraDefs` của chính từ đó** — một nghĩa khác của cùng từ. Đây là nhiễu khó nhất và `extra_definitions` phủ 99.1% từ nền.

Loại bỏ ứng viên chỉ khác đáp án về dấu câu / hoa-thường (dùng `normalizeWord` đã có).

Bất biến: **luôn trả đúng 3 nhiễu, không nhiễu nào trùng đáp án, không nhiễu nào trùng nhau.** Nếu pool không đủ (từ ở CEFR/loại từ hiếm), nới điều kiện theo bậc — cùng loại từ → cùng CEFR → bất kỳ — chứ không trả về <4 đáp án.

Bất biến này khiến "<4 đáp án" không còn xảy ra *do thiếu pool*, nhưng **không** thay thế cách xử lý D6 ở mục 11: route vẫn có thể lỗi vì DB/mạng, và D6 được sửa ở Phase 1 — trước phase này. Hai lớp bảo vệ độc lập, giữ cả hai.

### 8.2 Cloze có chấm điểm

Pool 3.830 từ (59.9%). `eligibility.ts` lọc như mục 3. **Từ không đủ điều kiện không vào queue của mode này** — không bao giờ hiện một thẻ hỏng rồi bắt bỏ qua.

Dùng lại `buildCloze` (`src/lib/cloze.ts`) đã có: nó blank lần xuất hiện đầu tiên kể cả biến thể (`\b<word>[\w'-]*`) nên plural/-ed/-ing vẫn khớp.

Gợi ý theo bậc: ký tự đầu → số ký tự → bỏ qua. Bấm gợi ý → `hintUsed` → **Hard**.

Lưu ý về `dir=cloze`: flashcard đã có một *hướng* tên cloze. Hai thứ này khác nhau — hướng flashcard là **mặt thẻ tự đánh giá**, mode mới là **bài có chấm điểm**. Giữ cả hai (đổi tên/xoá `dir=cloze` sẽ phá link đã lưu); hub phân biệt bằng cách chỉ hiện điều khiển Hướng trên thẻ Flashcard/Cram.

### 8.3 Ảnh → từ

Pool 3.741 danh từ, 100% có ảnh. Cổng vào: `typeEn` chứa `"noun"` **và** có `imageUrl`.

Rủi ro thật: ảnh Pexels cho từ trừu tượng có thể mơ hồ (`abandon` → ảnh gì?). Xử lý bằng **gợi ý theo yêu cầu** — bấm là hiện định nghĩa EN. Nhờ vậy không bao giờ thành đường cùng, và vì bấm gợi ý bị tính `Hard`, tín hiệu chấm điểm vẫn trung thực.

Nhập bằng **gõ chữ**; chấm bằng `gradeTyping` nên đồng nghĩa được chấp nhận. Biến thể "nói" ngoài scope phase này (mode Phát âm đã phục vụ mục đích đó).

---

## 9. Tổng kết phiên, ôn lại từ sai, resume

Hiện tại phiên kết thúc chỉ hiện một con số %. Đây là phần bổ sung có giá trị cao nhất.

`session-summary.tsx` hiện:

- % · số thẻ · XP · **combo dài nhất**
- **Danh sách từ đã sai** — từ, đáp án đúng, nút audio, **nút star** (dùng lại `WordMark` + `star-button.tsx` đã có)
- `Ôn lại N từ sai` → drill ngay các từ đó
- `Học tiếp N thẻ` — chỉ hiện khi `remaining.due + remaining.new > 0`
- `Đổi chế độ`

### Ràng buộc bắt buộc: drill "ôn lại từ sai" KHÔNG ghi SRS

Nếu ghi, một từ vừa bị quên sẽ nhận `Good` sau 30 giây, FSRS đẩy `stability` lên sai lệch, và người học **mất từ đó vài tuần sau** — đúng cái mà spec này định chống. Drill này đi đường `bonusXp`, giống Ghép cặp và Cram đang làm (`DailyStat.bonusXp` + `UserProgress.bonusXp` đã có trong schema, và backfill cố ý không chạm vào chúng).

Đây cũng chính là lý do tồn tại của `scope: "leeches"` trong `buildCramQueue`: comment trong `study-engine.ts` đã nói rõ leech review là cram-only vì "off-schedule Good ratings would corrupt FSRS stability". Drill từ-sai theo đúng nguyên tắc đó.

### Resume

Phiên lưu vào `localStorage`: danh sách item id + index + kết quả + mốc thời gian, khoá theo `mode + filters`. Mở lại trong vòng **2 giờ** → hỏi "Tiếp tục phiên?".

Không thêm bảng, không thêm API: review đã commit từng thẻ rồi, thứ duy nhất có thể mất là *còn thẻ nào* và *điểm/combo*.

### Sửa D1

Shell gọi `POST /api/study/session` khi bắt đầu và `PATCH` khi kết thúc — một lần, cho mọi mode. Ba mode quiz/gõ/nghe-viết từ nay có `StudySession` row, được `awardForSessionEnd`, và xuất hiện trong thống kê theo mode.

---

## 10. Animation

Giữ nguyên palette, typography, chất giấy. Thêm phản hồi có nhịp.

| Chỗ | Chuyển động | Ngân sách |
|---|---|---|
| Đổi item | slide + fade (đã có, rút ngắn từ 300ms) | 200ms |
| Đúng | tick scale-in + nháy moss trên đáp án + số XP bay lên | 300ms, **song song** |
| Sai | rung ngang khung nhập / đáp án (8px) + viền đỏ | 300ms |
| Combo | thanh mảnh dưới progress, đầy dần; mốc 5/10/15 pop nhãn; sai → reset về 0 | 200ms |
| Haptic | `navigator.vibrate(10)` đúng · `[20, 40, 20]` sai | — |
| Xong phiên | progress đầy → co thành vòng tròn → % đếm lên | ~800ms, bỏ qua được |

### Hai luật cứng

**`prefers-reduced-motion` phải được tôn trọng** qua **một** hook duy nhất `useMotionPrefs()` (bọc `useReducedMotion` của Motion) trả về bảng duration đã chỉnh. Không rải `if (reducedMotion)` khắp component.

**Không animation nào chặn nhịp học.** Cờ `busy` 1.100ms bị **xoá** (D4). Reveal hiện ra, **tap chỗ nào cũng đi tiếp ngay**; tự động đi tiếp sau 1,2s chỉ là đường lười, không phải khoá.

### Hạn chế phải nói rõ

`navigator.vibrate` **iOS Safari không hỗ trợ** — trên iPhone sẽ không có haptic, và không có cách vá nào trong web app. Android có. Code phải feature-detect, không giả định.

---

## 11. Lỗi & trường hợp biên

| Tình huống | Xử lý |
|---|---|
| `quiz-options` lỗi hoặc trả <4 đáp án (D6) | Bỏ qua item, đẩy về cuối queue, **không tính điểm**; nếu lỗi lại thì loại khỏi phiên. Không bao giờ treo skeleton |
| POST review thất bại | Kết quả vào hàng chờ trong bộ nhớ, thử lại 1 lần; cuối phiên báo rõ "N thẻ chưa lưu". Không âm thầm bỏ |
| Plan nhỏ hơn `size` yêu cầu | Chạy với số thực có + nói rõ ("chỉ còn 7 thẻ"). Không hiện `EmptyStudy` |
| Pool mode mới quá nhỏ sau khi lọc | Thẻ ở hub **vô hiệu hoá kèm lý do**, không để bấm vào rồi mới báo trống |
| TTS / audio lỗi | `tts.ts` đã có fallback; nghe-viết thêm nút "hiện từ" để không kẹt |
| `endSession` trả 403 (không sở hữu session) | Route đã xử lý; shell coi như 0 XP, phiên vẫn hoàn tất bình thường |
| Tab bị ẩn giữa item | `wasHidden: true` → chấm tối đa `Good` (mục 6) |
| `localStorage` không dùng được (private mode) | Resume tắt im lặng; phiên vẫn chạy |

---

## 12. Test

**Repo hiện không có test runner.** CI (`.github/workflows/ci.yml`) chỉ chạy `tsc --noEmit` + `next build`. `playwright` có trong devDependencies nhưng dùng để crawl ảnh, không phải test.

Đề xuất tối thiểu: thêm **vitest**, test đúng bốn module thuần — chúng là chỗ mà một lỗi sẽ âm thầm phá dữ liệu học.

| Module | Phải test |
|---|---|
| `grading.ts` | mọi nhánh. Bắt buộc: `!correct` → `Again` **luôn**; `cardState === 3` không bao giờ ra `Easy`; `wasHidden` hạ cấp; ngưỡng gõ scale theo `wordLength`; `typoAccepted` → `Hard` nhưng đồng nghĩa thì không |
| `session-state.ts` | combo reset đúng khi sai; danh sách từ sai không trùng; tổng cộng khớp số item |
| `eligibility.ts` | bộ lọc cloze cho đúng **3.830** từ trên dataset đã commit (test neo vào con số đo được ở mục 3); loại được mẫu `+ noun, …` |
| `distractors.ts` | luôn 3 nhiễu; không nhiễu nào trùng đáp án sau `normalizeWord`; không trùng nhau; nới điều kiện theo bậc khi pool nhỏ |

Thêm `npm test` vào CI, sau bước type-check.

**Không** viết test cho component/animation ở phase này: chi phí cao, giá trị thấp, và animation sẽ còn chỉnh tay nhiều. Verify bằng chạy thật trên mobile.

---

## 13. Ngoài scope

Ghi rõ để không trôi phạm vi:

| Bị loại | Vì sao |
|---|---|
| Nghe câu & viết | không có audio câu; TTS trình duyệt không đều, iOS Safari hay hụt giọng |
| Mode đồng nghĩa | `synonyms` chỉ ~40% toàn bộ — pool quá mỏng |
| Sắp xếp câu | câu median 6 từ nên quá dễ; UI kéo-thả mobile đắt; giá trị từ vựng thấp |
| Collocation | 0% dữ liệu — cần pipeline nguồn mới |
| Chế độ mix / tự chọn dạng bài | người dùng đã loại |
| Ghép cặp vào shell | đơn vị công việc khác (vòng, không phải thẻ) |
| Cá nhân hoá thời lượng ước tính | cần `StudySession` sạch — chỉ có sau khi D1 được sửa |
| Phiên học offline (PWA) | service worker hiện chỉ cache static; đồng bộ review offline là một spec riêng |

---

## 14. Thứ tự thực thi

| Phase | Nội dung | Vì sao ở vị trí này |
|---|---|---|
| 0 | vitest + `npm test` trong CI | có lưới an toàn **trước khi** sờ vào logic ghi FSRS |
| 1 | `PracticeShell` + `buildSessionPlan` + migrate **Trắc nghiệm** + sửa D1, D4, D5, D6 | chứng minh kiến trúc trên một mode thật trước khi nhân bản |
| 2 | Migrate Gõ · Nghe-viết · Flashcard | nhân bản sau khi shell đã được xác nhận chạy |
| 3 | `grading.ts` 4 mức + chip sửa | cần shell đứng vững và có chỗ đặt tín hiệu |
| 4 | Tổng kết + danh sách từ sai + drill non-SRS + resume | |
| 5 | `distractors.ts` + sửa D2, D7 | rẻ nhất, tác động lớn nhất trên mỗi dòng code |
| 6 | Cloze có chấm điểm + Ảnh → từ | |
| 7 | Hub chia nhóm + `Settings.sessionSize` + sửa D3 | cần biết danh sách mode cuối cùng mới chia nhóm được |
| 8 | Animation · haptic · `useMotionPrefs` toàn bộ | polish sau khi luồng đã đứng |
| 9 | *(tuỳ chọn)* Phát âm vào shell | |

Mỗi phase phải để repo ở trạng thái chạy được và `tsc --noEmit` sạch.

---

## 15. Giả định do tác giả spec quyết, không do người dùng chọn

1. **Ghép cặp không vào shell** — đơn vị công việc của nó khác.
2. **Thời lượng ước tính dùng hằng số**, không cá nhân hoá ở phase này.
3. **Ảnh → từ chỉ nhận gõ chữ**, chưa có biến thể nói.
4. **Ngưỡng thời gian ở mục 6 là điểm khởi đầu**, cần hiệu chỉnh bằng dữ liệu thật; chúng nằm gọn trong một object hằng số để chỉnh một chỗ.
5. **Cửa sổ resume 2 giờ.**
6. **Drill từ-sai đi đường `bonusXp`** thay vì tạo loại XP mới.

Người dùng đã được thông báo (1)–(3) và không phản đối.
