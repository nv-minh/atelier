# Module học ngữ pháp tiếng Anh — Design

- **Ngày:** 2026-08-14
- **Trạng thái:** design đã được người dùng duyệt theo từng section (5 phần, duyệt lần lượt trong brainstorm 2026-08-14)
- **Branch spec:** `docs/grammar-module`
- **Nền code:** `main` (`d3a40b2`)
- **Nguồn dữ liệu:** `EnglishGrammar_extracted/` (trích xuất từ một app Android, KHÔNG commit vào repo)

---

## 1. Bối cảnh

App hiện chỉ dạy từ vựng. Người dùng muốn thêm một module học **ngữ pháp** hoàn chỉnh — "thật đẹp, dễ sử dụng, tương tác tốt" — dựng từ bộ dữ liệu song ngữ Anh–Việt có sẵn trong `EnglishGrammar_extracted/`. Module là một subsystem mới (không có flow ngữ pháp nào tồn tại trước đó) nên đi theo path architectural: hỏi làm rõ → chọn phương án → duyệt design từng phần → spec này.

### Dữ liệu nguồn — đã kiểm, không phỏng đoán

| File | Quy mô | Cấu trúc |
|---|---|---|
| `csv/lessons.csv` | 292 bài, 33 chủ đề | `topic_en/vi, lesson_order, lesson_name_en/vi, content_en_html, content_vi_html` — HTML có span ngữ nghĩa (`.adjective`, `.verb`, `.subject`…), bảng ví dụ, 25 bài nhúng `<img>` |
| `csv/grammar_questions.csv` | 10.000 câu | `id, level (1/2), category_en/vi (~25 nhóm), question_en/vi, choices_en/vi ("##"-separated), answer_index (1-based), answer_en/vi, explanation_en/vi` |
| `csv/tests.csv` | 9.380 câu | `id, topic_en/vi (khớp đúng 33 chủ đề lessons), question_en/vi, a..d_en/vi, answer_index (1-based), answer_en/vi` |
| `csv/confused_words.csv` | 833 cặp | `id, title_en/vi, body_en/vi` — body là JSON `[{w, m}]`, ví dụ nằm sau ký tự `#` trong `m` |
| `csv/common_mistakes.csv` | 687 mục | `id, category (chỉ mã số 1–22, KHÔNG có tên nhóm), title_en/vi, body_en/vi, note_en/vi` — body dạng Incorrect:/Correct: |

**Sự thật về chất lượng, quyết định design phải gánh:**

- Toàn bộ tiếng Việt là **máy dịch**, nhiều field hỏng nặng: đáp án "men" dịch thành "leaven"; `choices_vi` kiểu `"núi lửa ## núi lửa ## núi lửa"` (vô dụng); JSON tiếng Việt trong `confused_words.csv` **vỡ cấu trúc quote** (`""w"">Một vài""`) — parse thẳng sẽ fail.
- CSV có **BOM** (đọc bằng `utf-8-sig`). `answer_index` **1-based**.
- 25 bài lesson nhúng ảnh dạng `file:///android_asset/images/...`; thư mục `images/` có 30 file PNG nhưng **3 file được tham chiếu mà không tồn tại**: `ae.svg`, `be.svg`, `passiv_blank.png`.
- `lessons.csv` **không có cột id** — khóa tự nhiên là `(topic_en, lesson_order)`.
- `grammar_questions` chia theo ~25 category × 2 level, **không map 1:1** với 33 chủ đề của lessons/tests. Không ép map (đó là lý do chọn phương án hub lai, xem §2).
- Chủ đề ít câu nhất: `Other Grammar` chỉ có 30 câu test.

### Trạng thái codebase — đã kiểm, không phỏng đoán

- **Chưa có model grammar nào.** `prisma/schema.prisma` hiện có: User, Word, Card, ReviewLog, StudySession, DailyStat, Settings, PushSubscription, UserProgress, Achievement, LearnerProfile, WordMark.
- **XP có HAI sổ cái** trên cả `DailyStat` và `UserProgress`: `xp` (chỉ sinh từ ReviewLog — SRS, backfill dựng lại được) và `bonusXp` (non-SRS). Mọi nơi hiển thị dùng `totalXp = xp + bonusXp` (`src/lib/gamification-defs.ts:19`). Non-SRS award qua `awardForSessionEnd` (`src/lib/gamification.ts:119`): `min(correctCount, NONSRS_XP_CAP=30) × XP_PER_NONSRS_CORRECT=1`, ghi `bonusXp` trong một `$transaction` cho cả hai bảng. → **XP ngữ pháp phải vào sổ `bonusXp`**, không được đụng `xp`.
- **Streak đếm ngày có `DailyStat.totalCount > 0`** (`src/lib/gamification-checks.ts:20-32`, cửa sổ 400 ngày). `totalCount` chỉ tăng theo review SRS → grammar muốn tính streak thì phải thêm nguồn ngày hoạt động (xem §7).
- **Leaderboard xếp theo XP** → XP grammar vào `bonusXp` là tự động lên bảng, không sửa gì.
- **Badge catalog là bảng thuần** `ACHIEVEMENTS` (`src/lib/gamification-defs.ts:85`), title/desc nằm ở i18n (`achievements.<key>.title/.desc`), icon là TÊN lucide; family là union type `AchievementFamily` (`:69`) — thêm badge = thêm family + entry + i18n + điểm gọi check.
- **i18n toàn app** qua `useI18n()` (`src/components/i18n-provider.tsx`), `lang: "vi" | "en"` lưu localStorage — nội dung song ngữ của grammar bám theo state này, không tự chế toggle riêng.
- **Nav** (`src/components/nav.tsx:25-32`): mảng item có cờ `mobile` (tab bar hiện 5 mục mobile) và `locked` (cần đăng nhập).
- **Mốc "ngày" toàn app là UTC** (`todayStr()` dùng `toISOString()` — 07:00 sáng VN). Giữ nguyên.
- **Đồ nghề tái dụng được:** `buildCloze(example, word)` (`src/lib/cloze.ts:9`), `vibrate()` (`src/lib/haptics.ts:8`), tap-sound, `src/components/practice/` (practice-shell, feedback-strip, session-summary), progress-bar, skeletons, auth-gate.
- **Hợp đồng kiểm thử:** vitest, file `*.test.ts` đặt cạnh lib, **không file test nào chạm `prisma`** — logic cần test phải tách thuần/server (tiền lệ: `leaderboard/pace.ts` vs `pace-server.ts`).
- **Deploy:** `vercel --prod` từ worktree sạch, push `main` KHÔNG deploy. Schema thay đổi áp bằng `prisma db push` (tiền lệ các gói trước).

### Quyết định của người dùng (chốt trong brainstorm, ghi lại để không đoán lại)

1. **Full cả 5 loại nội dung trong v1** (lessons, practice, tests, confused words, common mistakes); spec một mối, implementation plan chia phase.
2. **Tích hợp gamification đầy đủ**: XP, streak, leaderboard, thêm badge riêng cho grammar.
3. **Nội dung lưu Prisma DB** (import từ CSV kiểu pipeline packs), không static JSON.
4. **Lọc VI có chọn lọc**: đáp án/choices chỉ dùng EN; VI giữ cho tiêu đề/giải thích/bài học; chỗ hỏng → NULL.
5. **Mọi field VI bị thiếu/bị loại phải ghi vết được** để sau này người dùng tự chạy batch translate rồi đổ ngược vào DB dễ dàng (yêu cầu bổ sung khi duyệt phương án).
6. **Tiến độ theo mastery từng chủ đề + sổ câu sai**, KHÔNG dùng FSRS cho câu hỏi ngữ pháp.
7. **Top-level nav mới "Ngữ pháp"** (`/grammar`), phương án **A — hub lai**: chủ đề làm xương sống (lessons + tests khớp 33 chủ đề), luyện nhanh/confused/mistakes là vệ tinh giữ nguyên phân loại gốc.

### Tiêu chí thành công

- Import một lệnh ra đủ: 33 topics, 292 lessons, 9.380 test questions, 10.000 practice questions, 833 confused pairs, 687 mistakes — lệch là fail.
- Vòng lặp học liền mạch: đọc lý thuyết (ảnh hiển thị, span màu) → làm test đúng chủ đề → mastery tăng thấy được → câu sai vào sổ → ôn sổ resolve được.
- XP grammar cộng đúng sổ `bonusXp`, ngày có hoạt động grammar nối được streak, badge grammar unlock được.
- `grammar:translate-export` dump được đúng danh sách field VI đang NULL; `grammar:translate-import` đổ ngược file đã dịch vào DB không cần sửa schema.

---

## 2. Kiến trúc tổng thể

Ba tầng, tách như các module hiện có:

1. **Pipeline import** (`scripts/grammar/`, chạy bằng tsx như packs:*): CSV → làm sạch → Prisma. Chạy lại được (idempotent, upsert theo khóa gốc). Kèm cặp script translate round-trip.
2. **Nội dung + tiến độ trong DB**: 6 bảng nội dung (bất biến sau import, chỉ UPDATE bởi translate-import) + 4 bảng tiến độ theo user. Mọi cột `*Vi` nullable — **`NULL` = "cần dịch"**, query trực tiếp, không cần bảng tracking phụ.
3. **UI dưới `/grammar`**: server components đọc thẳng Prisma; mutation (nộp đáp án, đánh dấu đã đọc, resolve câu sai) qua `/api/grammar/*` dùng chung auth/CSRF/rate-limit hiện có.

## 3. Data model

### 3.1 Nội dung (bất biến sau import)

```prisma
model GrammarTopic {
  id      Int     @id            // gán khi import, ổn định theo thứ tự xuất hiện
  slug    String  @unique        // kebab EN: "past-perfect", "reported-speech"…
  nameEn  String
  nameVi  String?
  cluster String                 // "tenses" | "word-classes" | "sentence" | "other"
  order   Int                    // thứ tự trong cluster
}

model GrammarLesson {
  id            Int     @id @default(autoincrement())
  topicId       Int
  order         Int                    // lesson_order gốc
  titleEn       String
  titleVi       String?
  contentEnHtml String  @db.Text       // ĐÃ sanitize + rewrite ảnh lúc import
  contentViHtml String? @db.Text
  @@unique([topicId, order])
}

model GrammarTestQuestion {
  id          Int     @id              // id gốc tests.csv
  topicId     Int
  questionEn  String
  questionVi  String?
  choicesEn   Json                     // string[] (từ a..d_en), 2–4 phần tử
  answerIndex Int                      // ĐÃ chuẩn hóa 0-based
  @@index([topicId])
}

model GrammarPracticeQuestion {
  id            Int     @id            // id gốc grammar_questions.csv
  level         Int                    // 1 | 2 (hiển thị "Cơ bản"/"Nâng cao")
  categoryEn    String
  categoryVi    String?
  questionEn    String
  questionVi    String?
  choicesEn     Json
  answerIndex   Int                    // 0-based
  explanationEn String? @db.Text
  explanationVi String? @db.Text
  @@index([level, categoryEn])
}

model GrammarConfusedPair {
  id        Int     @id                // id gốc
  titleEn   String                     // "a few, afew"
  titleVi   String?
  entriesEn Json                       // [{ w, m, examples: string[] }] — tách "#" khỏi m khi import
  entriesVi Json?                      // cùng shape; parse fail → null
}

model GrammarCommonMistake {
  id       Int     @id                 // id gốc
  category String                      // slug nhóm — tên 22 nhóm TỰ ĐẶT khi import (EN/VI), CSV chỉ có mã số
  titleEn  String
  titleVi  String?
  bodyEn   String  @db.Text
  bodyVi   String? @db.Text
  noteEn   String? @db.Text
  noteVi   String? @db.Text
  @@index([category])
}
```

Cố ý KHÔNG lưu: `choices_vi`, `answer_vi` (rác, và đáp án là nội dung học — luôn hiển thị EN; đây là **quyết định sản phẩm, không phải gap dịch**, translate-export không liệt kê chúng); `answer_en` (suy ra từ `choicesEn[answerIndex]`); `sub_category` của grammar_questions (không dùng ở UI nào).

### 3.2 Tiến độ theo user

```prisma
model GrammarLessonRead {
  userId   String
  lessonId Int
  readAt   DateTime @default(now())
  @@id([userId, lessonId])
}

model GrammarTopicProgress {
  userId   String
  topicId  Int
  answered Int    @default(0)
  correct  Int    @default(0)
  recent   Json   @default("[]")   // ring buffer ≤20 boolean, kết quả test gần nhất
  @@id([userId, topicId])
}

model GrammarCategoryStat {
  userId   String
  level    Int
  category String                  // categoryEn
  answered Int    @default(0)
  correct  Int    @default(0)
  @@id([userId, level, category])
}

model GrammarAnswerState {
  userId         String
  source         String            // "topic_test" | "practice" | "confused"
  questionId     Int               // id trong bảng nguồn tương ứng
  firstCorrectAt DateTime?         // sổ cái chống farm XP — set một lần duy nhất
  wrongCount     Int       @default(0)
  lastWrongAt    DateTime?
  resolvedAt     DateTime?         // đúng trong phiên ôn → set; sai lại → reset null
  @@id([userId, source, questionId])
  @@index([userId, resolvedAt])    // query sổ câu sai
}
```

**Khác một điểm so với phần 4 đã duyệt trong chat** (có chủ đích, mời người dùng xác nhận khi review spec): hai bảng `GrammarAnswered` + `GrammarWrongAnswer` được **gộp thành một** `GrammarAnswerState` — cùng khóa `(userId, source, questionId)`, hai vòng đời nằm gọn trong hai nhóm cột (`firstCorrectAt` vs `wrongCount/lastWrongAt/resolvedAt`), một upsert mỗi lần trả lời thay vì hai, không mất thông tin nào. Sổ câu sai = `wrongCount > 0 AND resolvedAt IS NULL`.

Không lưu event log từng lần trả lời (YAGNI — 20k câu × users phình nhanh); aggregate + ring buffer là đủ cho mastery và sổ sai.

`DailyStat` thêm một cột: `grammarCount Int @default(0)` — số câu grammar trả lời trong ngày (mọi lần trả lời, đúng lẫn sai). Dùng cho streak (§7), KHÔNG trộn vào `totalCount` để stats từ vựng (accuracy trend, heatmap) không nhiễu.

## 4. Pipeline import & vòng dịch

### 4.1 `npm run grammar:import` (`scripts/grammar/import.ts`, chạy tsx — nhớ bẫy `.env` như packs)

Thứ tự: topics (suy từ lessons.csv, gán cluster theo bảng map tĩnh trong script) → lessons → tests → practice → confused → mistakes → copy ảnh. Nguyên tắc: **một row hỏng không đánh sập run** — skip + ghi report; upsert theo khóa gốc nên chạy lại không nhân đôi.

Làm sạch từng bước:

- Đọc `utf-8-sig`; tách choices bằng `##`, trim; **`answer_index` − 1** thành 0-based, validate `0 ≤ index < choices.length`, lệch → skip + report.
- **Sanitize HTML lesson ngay lúc import** bằng `sanitize-html` (devDependency mới): whitelist tag (`h1–h4, p, table, thead, tbody, tr, th, td, ul, ol, li, b, strong, i, em, br, blockquote, span, img`), span chỉ giữ `class` trong danh sách ngữ nghĩa, gỡ mọi style/handler. DB chỉ chứa HTML sạch → client render `dangerouslySetInnerHTML` không cần sanitize runtime.
- **Ảnh**: copy `EnglishGrammar_extracted/images/*` → `public/grammar/images/`; rewrite `file:///android_asset/images/X` → `/grammar/images/X`; ảnh tham chiếu mà không có file (`ae.svg`, `be.svg`, `passiv_blank.png`) → gỡ thẻ `<img>` + report.
- **JSON confused_words**: parse EN thẳng; VI thử sửa quote (chuỗi `""w""`, `"">`, escape lạc) rồi parse — fail thì `entriesVi = null`. EN fail (hiếm) → skip row + report. Tách ví dụ (`# …`) ra `examples[]`.
- **Heuristic VI-rác → NULL**: field VI bị NULL khi (a) trống/chỉ whitespace, (b) giống hệt EN (case-insensitive — dấu hiệu máy dịch bỏ qua), (c) JSON parse fail như trên. Không cố phát hiện "dịch dở nhưng có nghĩa" bằng máy — để vòng dịch của người dùng xử lý dần.
- **Tên 22 nhóm common_mistakes**: bảng map tĩnh trong script `{ "1": {slug, nameEn, nameVi}, … }` — tự đặt bằng cách đọc mẫu nội dung từng nhóm khi implement (một lần, commit cùng script).

Cuối run in + ghi `EnglishGrammar_extracted/import-report.json` (nằm cạnh nguồn, không commit): số row import/skip theo bảng kèm lý do skip, số field VI = NULL theo (bảng, field), ảnh thiếu. Số tổng phải khớp Tiêu chí thành công.

### 4.2 Vòng dịch khép kín — không cần sửa schema

- `npm run grammar:translate-export [--table X]` → `grammar-translate-todo.json`: mọi row có field VI NULL, shape `[{ table, id, field, textEn, textVi: null }]`. (Với `entriesVi`: textEn là JSON string của `entriesEn`.)
- Người dùng tự chạy translate ngoài band, điền `textVi`.
- `npm run grammar:translate-import <file>` → validate (table/field trong whitelist, id tồn tại, textVi khác rỗng; `entriesVi` phải parse được đúng shape) → batch UPDATE → report số field đã điền / bị từ chối kèm lý do. Chạy nhiều lần, mỗi lần một phần cũng được.

## 5. Routes & điều hướng

| Route | Nội dung | Auth |
|---|---|---|
| `/grammar` | Hub: khối "Tiếp tục học" (bài dở gần nhất + mastery tổng + số câu chờ ôn) → lưới 33 chủ đề theo 4 cụm, card hiện % mastery → 3 lối vào vệ tinh: Luyện nhanh / Từ dễ nhầm / Lỗi thường gặp → lối vào Sổ câu sai | public, khối tiến độ chỉ hiện khi đăng nhập |
| `/grammar/[topic]` | Trang chủ đề: mastery, danh sách bài lý thuyết (tick đã đọc), nút "Làm bài kiểm tra" | public |
| `/grammar/[topic]/lesson/[order]` | Trình đọc lý thuyết (§6) | public; nút "Đã hiểu" cần đăng nhập |
| `/grammar/[topic]/test` | Phiên test 10 câu của chủ đề | đăng nhập |
| `/grammar/practice` | Picker level (Cơ bản/Nâng cao) + category (hiện độ chính xác của bạn từng nhóm) → phiên luyện | đăng nhập |
| `/grammar/confused` | Danh sách 833 cặp, search client-side theo title; chi tiết 2 card cạnh nhau; nút "Mini-quiz" | public; quiz cần đăng nhập |
| `/grammar/mistakes` | Duyệt theo 22 nhóm, search; thẻ Incorrect→Correct, note mở rộng khi bấm | public |
| `/grammar/review` | Sổ câu sai: phiên ôn dùng chung UI phiên test | đăng nhập |

- **Nav**: thêm `{ href: "/grammar", label: t("nav.grammar"), mobile: true, locked: false }`. Mobile tab bar lên 6 mục — kiểm tra fit thực tế khi implement; nếu chật, hạ `/notebook` xuống `mobile: false` (đã `locked`, vẫn vào được từ home). Trang chủ thêm card lối vào grammar cạnh các card hiện có.
- **API** (`/api/grammar/*`, POST, auth + CSRF + rate-limit như các API hiện có): `answer` (nộp một câu — nguồn + questionId + chosenIndex; cập nhật `GrammarAnswerState` + counters + cộng XP first-correct, trả về đúng/sai + xpDelta), `lesson-read` (đánh dấu đã đọc + XP lần đầu), `session-end` (bonus hoàn phiên + check badge/level-up, trả dữ liệu cho màn tổng kết). Đọc dữ liệu: server component query thẳng, không qua API.

## 6. Trải nghiệm tương tác (phần "đẹp, dễ dùng")

- **Trình đọc lý thuyết**: typography là trọng tâm — stylesheet riêng cho content HTML (heading, bảng ví dụ kẻ nhẹ, spacing đọc dài) theo theme sáng/tối. Span ngữ nghĩa map thành **bộ màu ngữ pháp** khai báo trong `globals.css` theo đúng quy ước token hiện hành (nhớ bẫy DEFAULT-key của Tailwind): tính từ/động từ/chủ ngữ… mỗi loại một màu nhất quán toàn module + biến thể dark; đầu bài có chú giải màu nhỏ. Ảnh timeline bấm phóng to (lightbox nhẹ, không thêm lib). Ngôn ngữ nội dung bám `lang` toàn app (`useI18n`), trang lesson thêm switch EN/VI inline (đổi chính state đó); `contentViHtml` NULL → khóa về EN + nhãn "bản dịch đang cập nhật". Cuối bài: nút "Đã hiểu" + CTA "Làm test chủ đề này".
- **Phiên test/luyện/ôn — MỘT component dùng chung** (khác nhau ở nguồn câu hỏi): một câu một màn, đáp án nút to; trả lời → phản hồi tức thì (đúng: highlight + `vibrate()` + tap-sound + XP nhảy; sai: hiện đáp án đúng + card giải thích song ngữ, fallback EN); thanh tiến độ phiên; desktop phím 1–4. Kết phiên: điểm, XP nhận (từ `session-end`), mastery delta, badge/level-up toast, danh sách câu sai + nút "Làm lại câu sai ngay". Tái dụng tối đa `src/components/practice/` (feedback-strip, session-summary) — mức tái dụng cụ thể quyết ở implementation plan sau khi đọc kỹ shape các component đó.
- **Chọn câu cho phiên**: ưu tiên câu CHƯA từng đúng (`GrammarAnswerState.firstCorrectAt IS NULL`), random trong pool đã lọc; thiếu 10 câu → phiên ngắn hơn; hết sạch câu mới → cho làm lại câu cũ (0 XP) — không bao giờ chết vì "không đủ câu" (Other Grammar chỉ có 30 câu).
- **Từ dễ nhầm**: chi tiết là 2 card đối xứng (từ — nghĩa — ví dụ). Mini-quiz: lấy ví dụ từ `entriesEn`, đục lỗ từ đích bằng `buildCloze`, user chọn 1 trong 2 từ của cặp; chỉ những cặp có ví dụ mới vào quiz.
- **Lỗi thường gặp**: thẻ hai dòng Incorrect (gạch, đỏ nhạt) / Correct (xanh), note expand. Chỉ browse + search, không quiz ở v1 (YAGNI).
- **Sổ câu sai**: đúng 1 lần trong phiên ôn → `resolvedAt` set, rời sổ; sai lại ở bất kỳ đâu → mở lại. Mỗi câu hiện nguồn (chủ đề nào / practice / confused) kèm link về lý thuyết liên quan (topic test → trang chủ đề).
- **Empty states có chủ đích**: sổ sai rỗng → chúc mừng + CTA luyện; chủ đề chưa học → CTA bài đầu tiên.
- Không thêm thư viện UI/animation mới; transition CSS + các pattern card/badge/skeleton hiện có.

## 7. Gamification & mastery

- **Mastery chủ đề** = `30% × (bài đã đọc / tổng bài) + 70% × accuracy(ring buffer ≤20 câu test gần nhất)`. Dưới 5 câu đã trả lời → card hiện "Mới bắt đầu" thay vì %. Hàm thuần trong `src/lib/grammar/mastery.ts` (test được, không chạm prisma).
- **XP — toàn bộ vào sổ `bonusXp`** (grammar là non-SRS; sổ `xp` giữ nguyên ReviewLog-derived để backfill an toàn), ghi qua `$transaction` DailyStat + UserProgress đúng pattern `awardForSessionEnd`. Điểm cộng bám vào đúng endpoint sở hữu sự kiện:
  - `+2`/câu **đúng lần đầu tiên**, cộng ngay trong `answer` — đúng khoảnh khắc `firstCorrectAt` chuyển NULL→timestamp trong cùng transaction, nên retry/double-submit không thể cộng hai lần; câu đã từng đúng: 0 XP (sổ cái chống farm 20k câu). Phiên 10 câu → trần tự nhiên 20 XP, không cần cap riêng;
  - `+5` hoàn thành phiên đủ 10 câu, cộng trong `session-end` (idempotency key phiên, xem §8);
  - `+5` đọc xong một bài lý thuyết, chỉ lần đầu (unique `GrammarLessonRead`), cộng trong `lesson-read`.
  - Hằng số đặt trong `gamification-defs.ts` cạnh XP economy hiện có; check badge chạy ở `session-end`/`lesson-read`, race-safe nhờ unique constraint như hiện tại.
- **Streak**: mỗi lần trả lời tăng `DailyStat.grammarCount`; `computeStreakFromDb` mở rộng where thành `OR: [{ totalCount: { gt: 0 } }, { grammarCount: { gt: 0 } }]` — ngày chỉ học ngữ pháp vẫn nối streak (đúng lựa chọn "tích hợp đầy đủ"; nới định nghĩa hiện hành "streak chỉ SRS" một cách có chủ đích). XP grammar vốn đã tính vào daily goal (`totalXp`).
- **Leaderboard**: không sửa — xếp theo XP, `bonusXp` đã nằm trong đó.
- **Badges** — thêm family `"grammar"` vào `AchievementFamily` + 5 entry (title/desc vào i18n như quy ước):

| key | điều kiện | check ở |
|---|---|---|
| `grammar_first_lesson` | đọc bài lý thuyết đầu tiên | lesson-read |
| `grammar_lessons_50` | đọc 50 bài | lesson-read |
| `grammar_topic_master` | một chủ đề mastery ≥ 90% (đủ ≥5 câu) | session-end |
| `grammar_review_25` | resolve 25 câu trong sổ sai | session-end (phiên ôn) |
| `grammar_correct_500` | 500 câu đúng lần đầu (count `firstCorrectAt IS NOT NULL`) | session-end |

## 8. Error handling & edge cases

- **Import**: row hỏng → skip + report (không fail run); tổng cuối run lệch kỳ vọng → exit khác 0.
- **Nộp đáp án idempotent** theo khóa `(userId, source, questionId)`: double-submit/retry sau mất mạng không nhân đôi XP (`firstCorrectAt` chỉ set một lần, các increment là upsert nguyên tử). Nộp **từng câu một** — rớt mạng giữa phiên mất nhiều nhất một câu, state phiên giữ client-side.
- **`session-end` gọi lại lần hai** (reload màn tổng kết): payload mang idempotency key phiên (uuid sinh client) — server bỏ qua nếu đã xử lý (lưu key trong `StudySession.mode = "grammar_*"` hoặc bảng nhẹ — chốt ở plan).
- **Nội dung thiếu VI** ở bất kỳ đâu → fallback EN + nhãn nhỏ, không bao giờ ô trống.
- **Câu hỏi bị skip lúc import** (index lệch…) → đơn giản là không tồn tại trong DB, UI không cần biết.
- **User chưa đăng nhập** bấm hành động ghi → auth-gate hiện có.

## 9. Testing

Theo hợp đồng hiện hành: test thuần, không chạm prisma, `*.test.ts` cạnh file.

- **Parser/cleaner** (tách thuần khỏi script import): fixtures trích từ dữ liệu thật — JSON VI vỡ + sửa quote, choices `##`, answer_index 1-based/lệch range, BOM, img thiếu file, heuristic VI-rác (trống/giống-EN/parse-fail), tách `examples` khỏi `m`.
- **`mastery.ts`**: công thức, ring buffer đẩy/cắt 20, ngưỡng <5 câu.
- **XP first-correct**: hàm thuần quyết định `(answerState, đúng/sai) → xpDelta` — farm câu cũ = 0.
- **Cloze confused-quiz**: cặp có/không ví dụ, từ xuất hiện nhiều lần trong câu.
- **Translate round-trip**: export shape → import validate (từ chối field ngoài whitelist, textVi rỗng, entriesVi sai shape).
- **Sau import thật** (smoke, chạy tay): report khớp 33/292/9380/10000/833/687.

## 10. Phasing gợi ý cho implementation plan

1. Schema + pipeline import + translate export/import (nền dữ liệu — mọi thứ sau phụ thuộc).
2. Hub `/grammar` + trang chủ đề + trình đọc lý thuyết + nav + đánh dấu đã đọc.
3. Phiên test chủ đề + mastery + XP/streak (cột `grammarCount`) + màn tổng kết.
4. Luyện nhanh (picker level/category + `GrammarCategoryStat`).
5. Từ dễ nhầm (browse + mini-quiz) + Lỗi thường gặp (browse).
6. Sổ câu sai + badges + polish (empty states, lightbox, phím tắt).

Mỗi phase merge được độc lập; phase 2 trở đi đều ship giá trị dùng được.

## 11. Ngoài phạm vi v1

- Chạy dịch lại nội dung VI (người dùng tự làm ngoài band bằng vòng translate §4.2).
- FSRS/lập lịch ôn cho câu ngữ pháp; grammar trong reminder cron; offline/PWA cho grammar; grammar trong trang `/stats` và heatmap (mastery chỉ hiện trong module); placement test ngữ pháp; quiz cho common mistakes; map grammar_questions vào 33 chủ đề.
