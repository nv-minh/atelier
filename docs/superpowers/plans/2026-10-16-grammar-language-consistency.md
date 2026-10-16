# Grammar Language Consistency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ở chế độ VI, mọi chỗ trong module ngữ pháp (lý thuyết, tiêu đề bài, đề bài tập) hoặc là tiếng Việt hoàn toàn, hoặc là tiếng Anh nguyên văn có chủ đích, không còn câu nửa Anh nửa Việt.

**Architecture:** Giữ nguyên thiết kế Tier-0 (glossary, spacing, repair xác định) rồi Tier-1 (Claude dịch prose trong phiên làm việc, không gọi API ngoài; vùng bảo vệ bị che bằng `{n}`), mọi bản ghi đi qua cổng kiểm trước khi ghi DB.
Phần lý thuyết dùng lại bộ máy segment đang làm dở trong working tree.
Phần bài tập thêm một chính sách riêng cho đề (`stem-policy.ts`) vì 95% đề là câu điền chỗ trống và phải giữ tiếng Anh.
Một script audit duy nhất đo cùng một bộ chỉ số trước và sau, là tiêu chí nghiệm thu.

**Tech Stack:** TypeScript, vitest, Prisma (Neon Postgres), tsx scripts, dịch tay bởi Claude qua file JSON trung gian (export segment, điền bản dịch, import qua cổng). Không dùng Z.AI hay API dịch nào.

**Spec:** `docs/superpowers/specs/2026-08-14-grammar-module-design.md` (§3.1 chỉ lưu field VI nullable, §4.2 vòng dịch, §6 trình đọc và phiên test), cùng kế hoạch đang làm dở `.opencode/plans/2026-08-18-grammar-lesson-vi-consistency.md` (Bước 1 đến 6 của kế hoạch đó được gộp vào Task 2 và 3 dưới đây).
Tài liệu gốc tiếng Anh `/Users/abc/Downloads/EnglishGrammar_extracted` đã được kiểm: nó giống hệt `EnglishGrammar_extracted/` trong repo và đã nằm trong DB ở các cột `*En`.
Không cần import lại gì, các cột `*En` là chuẩn để so khớp.

## Điều chỉnh: bỏ Z.AI (người dùng chốt trước khi thực thi)

Mọi chỗ trong các task dưới đây nhắc tới Z.AI, `chat`, `zai.ts` hay "nhờ LLM" được đọc lại như sau:
- Task 2 Step 5 đến 7: `translate-lessons.ts` thêm `--export <file>` (ghi segment cần dịch ra JSON, đã che `{n}`) và `--import <file>` (đọc bản dịch của Claude, ghép, chạy cổng, ghi DB). Claude điền bản dịch vào file trung gian theo từng chunk.
- Task 3: không tạo `zai.ts`. `translate-titles.ts` dùng cùng luồng export/import, Claude viết bản dịch.
- Task 5 Step 1: `build-stem-glossary.ts` chỉ liệt kê cue riêng biệt kèm bản VI phổ biến nhất trong DB; Claude điền chỗ còn thiếu trực tiếp vào `stem-glossary.json`.

## Global Constraints

- Quy tắc ngôn ngữ ở chế độ VI, áp cho mọi task:
  - Tiếng Việt: câu giải thích, heading không phải specimen, `titleVi`, phần chỉ dẫn của đề ("Chọn câu có trật tự từ đúng").
  - Tiếng Anh nguyên văn: câu ví dụ, bảng chia động từ, công thức (`will + infinitive`), danh sách từ, heading specimen ("afraid of", "Gerund + Noun"), từ trong dấu ngoặc kép của đề, mọi câu điền chỗ trống, mọi đáp án.
  - Một block không bao giờ nửa Anh nửa Việt, trừ phần tiếng Anh nằm trong span bảo vệ hoặc sau nhãn "Ví dụ:".
- `questionVi = NULL` cho đề điền chỗ trống là chủ đích (`isBlankStem`), không phải thiếu bản dịch.
- Người dùng chốt: không dùng Z.AI. Mọi bản dịch do Claude viết trực tiếp, theo luồng export JSON, dịch, import qua cổng kiểm; từ cần là tiếng Anh thì giữ nguyên.
- Không đổi schema Prisma. Cột `*Vi` nullable, NULL nghĩa là UI rơi về EN.
- Mọi lần ghi DB phải có `--dry-run` trước, có snapshot trong `data/backups/` trước khi ghi, và chạy lại lần hai phải báo 0 thay đổi.
- Lần ghi đầu tiên lên DB Neon (`.env` DATABASE_URL) cần người dùng đồng ý trực tiếp, vì đây là DB dùng chung và khó hoàn tác ngoài snapshot.
- Không dùng em dash trong code, comment, commit, tài liệu. Dùng dấu gạch ngang thường.
- Markdown dài: mỗi câu một dòng.
- Commit message không thêm co-author của agent (chỉ dẫn toàn cục của người dùng ghi đè nhắc nhở mặc định).
- Không sửa `CHANGELOG.md` hay file auto-generated.
- Lint, test fail hoặc flaky gặp trên đường đi phải sửa luôn dù không do mình gây ra.
- Kiểm thử đường đi người dùng thật trên trình duyệt, soi từng pixel; thấy gì lệch thì sửa luôn.
- Test thuần, không chạm prisma, file `*.test.ts` đặt cạnh file nguồn (hợp đồng hiện hành).
- Baseline hiện tại: `npx vitest run src/lib/grammar` là 9 file, 94 test, đều pass.

## File Structure

| File | Trạng thái | Trách nhiệm |
|---|---|---|
| `src/lib/grammar/lang-audit.ts` (+ `.test.ts`) | Create | Hàm thuần đo độ nhất quán ngôn ngữ cho một bài học, một tiêu đề, một đề |
| `scripts/grammar/audit-language.ts` | Create | Đọc DB, chạy `lang-audit`, in bảng số và ghi JSON baseline |
| `src/lib/grammar/vi-repair.ts`, `heading-glossary.ts`, `lesson-translate.ts` (+ tests), `scripts/grammar/*.ts`, `package.json` | Modify/Create (đã có trong working tree, chưa commit) | Bộ máy dịch lý thuyết, được kiểm và commit ở Task 2 |
| `scripts/grammar/zai.ts` | Create | `chat` và `parseJsonLoose` tách khỏi `translate-lessons.ts` để runner tiêu đề và đề dùng chung |
| `scripts/grammar/translate-titles.ts` | Create | Dịch lại `titleVi` bị cờ, qua cổng `flagTitleVi` |
| `src/lib/grammar/stem-policy.ts` (+ `.test.ts`) | Create | Phân loại và sửa `questionVi` theo chính sách, cổng `checkStemVi` |
| `src/lib/grammar/stem-glossary.json` + `stem-glossary.ts` (+ test) | Create | Bảng EN cue sang VI cue đã duyệt tay, tra cứu xác định |
| `scripts/grammar/build-stem-glossary.ts` | Create | Liệt kê cue riêng biệt và nhờ LLM dịch ra file để người duyệt |
| `prisma/grammar-repair-vi.ts` | Modify | Thêm pass `repairStemVi` cho `testQuestions` và `practiceQuestions` |
| `src/components/grammar/grammar-session.tsx:272-311` | Modify | Bỏ dòng lặp lại EN dưới đề VI |

---

## Review Focus

Năm điều spec không nói nhưng dễ làm hỏng nhất, mỗi dòng đã có test ở task chủ sở hữu.

1. Đề có hai dấu hai chấm hoặc dấu hai chấm trong câu mẫu ("Note: He said: go") phải tách ở dấu đầu tiên và vẫn giữ nguyên cả phần sau (Task 4).
2. Đề practice chứa HTML (`<b>Choose the correct answer</b><br>Which sentence is correct?`) không được làm hỏng thẻ khi sửa (Task 4).
3. Bài có `<img>` và bảng (25 bài) phải giữ nguyên chuỗi thẻ sau mọi lượt dịch, nếu không cổng từ chối cả bài (Task 2).
4. Chạy lại lần hai sau khi đã áp phải báo 0 thay đổi, và `--restore` từ snapshot trả lại đúng dữ liệu trước (Task 2 và Task 5).
5. Người dùng đang ở VI mà bài chỉ có `contentViHtml = NULL` vẫn thấy bản EN kèm nhãn "bản dịch đang cập nhật", không bao giờ trang trắng (Task 2, kiểm bằng E2E).

---

### Task 1: Baseline audit độ nhất quán ngôn ngữ

**Files:**
- Create: `src/lib/grammar/lang-audit.ts`
- Test: `src/lib/grammar/lang-audit.test.ts`
- Create: `scripts/grammar/audit-language.ts`
- Modify: `package.json` (thêm `"grammar:audit-language": "tsx scripts/grammar/audit-language.ts"`)

**Interfaces:**
- Consumes: `walkLesson`, `toSegment`, `isTranslatableSegment`, `blockProseText` từ `lesson-translate.ts`; `scan`, `englishBlockIds`, `fixProtectedSpacing`, `VI_DIACRITIC`, `isBlankStem` từ `vi-repair.ts`; `SEMANTIC_SPAN_CLASSES`.
- Produces (Task 3, 4, 5, 7 dựa vào):
  - `type LessonLangAudit = { proseGaps: number; headingGaps: number; gluedSpans: number; tagMismatch: boolean }`
  - `auditLessonLang(enHtml: string, viHtml: string, protectedClasses: ReadonlySet<string>): LessonLangAudit`
  - `flagTitleVi(titleEn: string, titleVi: string | null): string | null` trả lý do bị cờ hoặc `null` nếu ổn.
  - `type StemAudit = "ok" | "blank-has-vi" | "vi-lacks-diacritic" | "quote-mangled" | "specimen-translated"`
  - `auditStem(en: string, vi: string | null): StemAudit` (cài đầy đủ ở Task 4 khi `stem-policy` có mặt, Task 1 chỉ khai báo kiểu và xử lý hai nhánh `blank-has-vi` và `vi-lacks-diacritic`).

- [ ] **Step 1: Viết test thất bại trong `lang-audit.test.ts`**
  - `auditLessonLang` trên cặp EN `<h2>Use of the Simple Present</h2><p>We use it for habits.</p>` và VI giữ nguyên EN: `proseGaps === 2`, `headingGaps === 1`.
  - Cặp VI `<h2>Cách dùng thì hiện tại đơn</h2><p>Dùng cho thói quen.</p>`: cả hai bằng 0.
  - Cặp có `<i>Present Continuous</i>` và VI `thì<i>Present Continuous</i>`: `gluedSpans === 1`.
  - `flagTitleVi("Simple Present", "Simple Present")` trả chuỗi không rỗng; `flagTitleVi("Simple Present", "Thì hiện tại đơn")` trả `null`; `flagTitleVi("Simple Present", null)` trả `null` (NULL là fallback hợp lệ).
- [ ] **Step 2: Chạy `npx vitest run src/lib/grammar/lang-audit.test.ts`**, kỳ vọng FAIL vì module chưa có.
- [ ] **Step 3: Cài `lang-audit.ts`** theo chữ ký trên.
  - `proseGaps` dùng đúng bộ lọc `isTranslatableSegment` và phép thử `VI_DIACRITIC` mà `checkLessonViProseVi` đang dùng, để audit và cổng không lệch nhau.
  - `gluedSpans` lấy từ `fixProtectedSpacing(en, vi)?.fixed ?? 0`.
- [ ] **Step 4: Chạy lại test**, kỳ vọng PASS.
- [ ] **Step 5: Viết `scripts/grammar/audit-language.ts`**.
  - Quét 292 bài, tất cả `titleVi`, tất cả `questionVi` của hai bảng đề.
  - In: số bài có `proseGaps > 0`, tổng `headingGaps`, tổng `gluedSpans`, số `titleVi` bị cờ, số đề theo từng `StemAudit`, số đề không-điền-chỗ-trống còn `questionVi = NULL`.
  - Ghi `data/llm-runs/language-audit-<ngày>-<nhãn>.json` với `--label baseline|after`.
- [ ] **Step 6: Ghi baseline.**
  Run: `npm run grammar:audit-language -- --label baseline`
  Expected: in bảng số, file JSON được tạo. Dán bảng vào mô tả commit của Task 7 để so sánh.
- [ ] **Step 7: Commit**
  ```bash
  git add src/lib/grammar/lang-audit.ts src/lib/grammar/lang-audit.test.ts scripts/grammar/audit-language.ts package.json
  git commit -m "feat(grammar): audit độ nhất quán ngôn ngữ VI/EN làm tiêu chí nghiệm thu"
  ```
  Lưu ý: `package.json` đang có sửa đổi chưa commit từ trước (hai script `grammar:audit-headings`, `grammar:translate-lessons`). Task 2 xử lý phần đó, nên ở bước này chỉ `git add -p package.json` lấy đúng dòng mới.

---

### Task 2: Kiểm và đưa lên phần dịch lý thuyết đang làm dở, chạy vòng dịch bài học

**Files:**
- Modify (đã có trong working tree): `src/lib/grammar/vi-repair.ts`, `src/lib/grammar/vi-repair.test.ts`, `package.json`
- Create (đã có, chưa commit): `src/lib/grammar/heading-glossary.ts`, `src/lib/grammar/lesson-translate.ts`, cả hai `.test.ts`, `scripts/grammar/audit-headings.ts`, `scripts/grammar/translate-lessons.ts`
- Không đụng: `.opencode/` (artifact của agent khác, không commit)

**Interfaces:**
- Consumes: `auditLessonLang` từ Task 1.
- Produces: DB có `contentViHtml` mà `checkLessonVi` và `checkLessonViProseVi` đều ok trên cả 292 bài; `translateHeadingGlossary(segment: string): string | null`.

- [ ] **Step 1: Đọc `git diff` và 4 file mới**, xác nhận không còn `TODO`, import chết, hoặc code gỡ lỗi. Sửa nếu có.
- [ ] **Step 2: Chạy `npx vitest run src/lib/grammar` và `npx tsc --noEmit` và `npm run lint`**, kỳ vọng 0 lỗi (baseline 94 test pass, thêm test của Task 1).
- [ ] **Step 3: Commit phần dịch lý thuyết thành một commit riêng**
  ```bash
  git add src/lib/grammar/vi-repair.ts src/lib/grammar/vi-repair.test.ts src/lib/grammar/heading-glossary.ts src/lib/grammar/heading-glossary.test.ts src/lib/grammar/lesson-translate.ts src/lib/grammar/lesson-translate.test.ts scripts/grammar/audit-headings.ts scripts/grammar/translate-lessons.ts package.json
  git commit -m "feat(grammar): bộ máy dịch lý thuyết theo segment, glossary đề mục, cổng prose phải là tiếng Việt"
  ```
- [ ] **Step 4: Thêm test cho Review Focus 3 vào `lesson-translate.test.ts`**
  Test `assembleTranslated keeps the tag sequence of a lesson with <img> and <table>`: EN có `<img src="/grammar/images/x.png"><table><tr><td>I work</td></tr></table><p>Use it daily.</p>`, bản dịch cho `<p>` là `Dùng hằng ngày.`, kết quả không đổi `<img>` và `<td>`.
  Chạy test, nếu fail thì sửa `walkLesson` cho void tag `img`.
- [ ] **Step 5: Dry-run Tier-0 rồi LLM**
  Run: `npx tsx scripts/grammar/translate-lessons.ts --no-llm --dry-run`
  Run: `npx tsx scripts/grammar/translate-lessons.ts --dry-run --limit 10`
  Expected: báo số bài `applied`, `gateFailed`, `unaligned`; không ghi gì. Bài `gateFailed` được liệt kê kèm lý do.
- [ ] **Step 6: Xin người dùng đồng ý ghi lên DB Neon**, rồi chạy theo chunk để dừng sớm nếu tỉ lệ `gateFailed` cao
  Run: `npx tsx scripts/grammar/translate-lessons.ts --no-llm`
  Run: `npx tsx scripts/grammar/translate-lessons.ts --limit 50` (lặp tới hết, có resume qua `lesson-segments-<ngày>.ndjson`)
  Expected: snapshot `data/backups/grammar-lessons-vi-<ngày>.json` được tạo trước khi ghi.
- [ ] **Step 7: Xử lý phần dư**
  Với bài còn `gateFailed`, chạy `--only <id> --redo` từng bài; bài vẫn fail thì xem `lesson-keeps-<ngày>.json` và bổ sung glossary hoặc cho vào allowlist nếu là specimen hợp lệ.
- [ ] **Step 8: Kiểm tính idempotent và audit**
  Run: `npx tsx scripts/grammar/translate-lessons.ts --dry-run` (lần hai), kỳ vọng 0 thay đổi.
  Run: `npm run grammar:audit-language -- --label after-lessons`
  Expected: số bài có `proseGaps > 0` là 0, `headingGaps` là 0, `gluedSpans` là 0 (trừ các cặp morpheme `infinitive`+`ending` được miễn).
- [ ] **Step 9: Duyệt trình duyệt** (`npm run dev`) các URL `/grammar/simple-present/lesson/1`, `/lesson/2` và các bài tệ cũ (#41, #138, #167, #191) ở VI, rồi chuyển EN.
  Expected: không còn heading tiếng Anh, chip chú giải màu vẫn đúng span, chuyển EN ra bản gốc nguyên vẹn.
  Mở thêm một bài mà `contentViHtml` được NULL tạm trong DB dev (hoặc mock): phải ra bản EN kèm nhãn "bản dịch đang cập nhật" (Review Focus 5).
- [ ] **Step 10: Commit** các điều chỉnh glossary hoặc allowlist phát sinh ở Step 7 (nếu có)
  ```bash
  git add src/lib/grammar scripts/grammar
  git commit -m "fix(grammar): bổ sung glossary và allowlist sau vòng dịch bài học"
  ```

---

### Task 3: Tiêu đề bài học (`titleVi`)

**Files:**
- Create: `scripts/grammar/zai.ts`
- Modify: `scripts/grammar/translate-lessons.ts` (import `chat`, `parseJsonLoose` từ `zai.ts` thay cho bản nội bộ)
- Create: `scripts/grammar/translate-titles.ts`
- Modify: `package.json` (thêm `"grammar:translate-titles": "tsx scripts/grammar/translate-titles.ts"`)
- Test: `src/lib/grammar/lang-audit.test.ts` (thêm ca cho `flagTitleVi`, đã khai báo ở Task 1)

**Interfaces:**
- Consumes: `flagTitleVi` từ Task 1; `nameVi` các chủ đề trong `catalog.ts` làm quy ước thuật ngữ.
- Produces: `chat(system: string, user: string): Promise<string>` và `parseJsonLoose(text: string): Record<string, string>` trong `scripts/grammar/zai.ts`.

- [ ] **Step 1: Mở rộng test `flagTitleVi`**
  Thêm ba ca: `"be, do, have"` với VI `"be, do, Have và các động từ khiếm khuyết"` (VI chứa chữ Anh thừa trong tiêu đề thuật ngữ) không bị cờ vì có dấu và không trùng EN; VI chỉ gồm ASCII và khác EN (`"Present Tense"` sang `"Present Tense Form"`) bị cờ vì không có dấu Việt; VI bằng EN không phân biệt hoa thường bị cờ.
  Chạy test và sửa `flagTitleVi` nếu ca nào fail.
- [ ] **Step 2: Tách `zai.ts`** chuyển nguyên `chat` và `parseJsonLoose` (kèm `SYSTEM_PROMPT` truyền vào tham số), cập nhật `translate-lessons.ts` dùng lại.
  Run: `npx tsc --noEmit` và `npx tsx scripts/grammar/translate-lessons.ts --dry-run --limit 1`, kỳ vọng chạy như trước.
- [ ] **Step 3: Viết `translate-titles.ts`**
  Chỉ chọn bài mà `flagTitleVi(titleEn, titleVi)` trả lý do; gửi theo lô 40 tiêu đề, prompt yêu cầu theo quy ước `nameVi` trong catalog và giữ nguyên thuật ngữ trong ngoặc; ghi ra `data/llm-runs/title-proposals-<ngày>.json` ở chế độ mặc định, chỉ ghi DB khi có `--apply`, kèm snapshot.
- [ ] **Step 4: Chạy ở chế độ đề xuất rồi duyệt tay**
  Run: `npm run grammar:translate-titles`
  Expected: file đề xuất được tạo, người dùng duyệt danh sách (3 tiêu đề không dấu Việt và các bản dịch gượng như "Sơ đồ hiện tại đơn giản" phải được xem lại kỹ).
- [ ] **Step 5: Sau khi người dùng đồng ý, áp**
  Run: `npm run grammar:translate-titles -- --apply`
  Run: `npm run grammar:audit-language -- --label after-titles`
  Expected: số `titleVi` bị cờ là 0.
- [ ] **Step 6: Commit**
  ```bash
  git add scripts/grammar/zai.ts scripts/grammar/translate-lessons.ts scripts/grammar/translate-titles.ts src/lib/grammar/lang-audit.ts src/lib/grammar/lang-audit.test.ts package.json
  git commit -m "feat(grammar): dịch lại titleVi bị cờ qua runner có duyệt tay"
  ```

---

### Task 4: Chính sách đề bài tập (`stem-policy`)

**Files:**
- Create: `src/lib/grammar/stem-policy.ts`
- Test: `src/lib/grammar/stem-policy.test.ts`
- Modify: `src/lib/grammar/lang-audit.ts` (cài đủ `auditStem` bằng `stem-policy`)

**Interfaces:**
- Consumes: `isBlankStem`, `VI_DIACRITIC`, `CheckResult` từ `vi-repair.ts`.
- Produces (Task 5 dựa vào):
  - `type StemParts = { cue: string; specimen: string }`
  - `splitHybridStem(en: string): StemParts | null` tách ở dấu `: ` đầu tiên khi cue có từ 2 từ trở lên và specimen có từ 3 từ trở lên, ngược lại `null`.
  - `quotedSpans(en: string): string[]` các đoạn trong `"..."` và `“...”`.
  - `repairStemVi(en: string, vi: string | null): string | null` trả giá trị `questionVi` nên lưu: `null` cho đề điền chỗ trống; với đề hybrid thì `<cue VI>: <specimen EN nguyên văn>` (cue VI lấy phần trước dấu `:` đầu tiên của `vi`, thiếu hoặc không có dấu Việt thì `null`); với đề chỉ có chỉ dẫn thì giữ `vi` nếu mọi `quotedSpans(en)` còn nguyên trong `vi`, ngược lại `null`.
  - `checkStemVi(en: string, vi: string): CheckResult`

- [ ] **Step 1: Viết test thất bại trong `stem-policy.test.ts`** với dữ liệu thật từ DB.
  - Đề điền chỗ trống `"There was a woman in the car with two _____."` và `"_____"`: `repairStemVi(en, "Có một người phụ nữ…")` là `null`.
  - Đề hybrid id 1731: EN `"Transfer this Active Voice sentence into the Passive one: Britain kept Napoleon on the island of Saint Helena."`, VI cũ `"Chuyển câu Chủ động này sang câu Bị động: Nước Anh giữ Napoléon trên đảo Saint Helena."`, kết quả `"Chuyển câu Chủ động này sang câu Bị động: Britain kept Napoleon on the island of Saint Helena."`.
  - Review Focus 1: EN `"Rewrite the sentence: He said: go home now please"`, VI cũ `"Viết lại câu: Anh ấy nói: về nhà ngay"`, kết quả giữ cue `"Viết lại câu"` và specimen `"He said: go home now please"` đủ cả hai dấu hai chấm.
  - Review Focus 2: EN `"<b>Choose the correct answer</b><br>Which sentence is correct?"`, VI cũ `"<b>Chọn đáp án đúng</b><br>Câu nào đúng?"`, kết quả trả đúng VI cũ, không đổi thẻ.
  - Đề chỉ có chỉ dẫn id 418 `"Place the adverb on the correct place in the sentence"` giữ `"Đặt trạng từ vào đúng vị trí trong câu"`.
  - Đề có ngoặc kép EN `What's the plural of "Aircraft"?` với VI `Số nhiều của "Aircraft" là gì?` được giữ; với VI `Số nhiều của "Máy bay" là gì?` thì `repairStemVi` trả `null` và `checkStemVi` trả `ok: false`.
  - `splitHybridStem("Choose the right answer")` là `null`.
- [ ] **Step 2: Chạy `npx vitest run src/lib/grammar/stem-policy.test.ts`**, kỳ vọng FAIL.
- [ ] **Step 3: Cài `stem-policy.ts`** theo chữ ký trên.
  Tách cue và specimen chỉ ở dấu `:` ngoài thẻ HTML (bỏ qua `:` trong thuộc tính thẻ nếu có).
- [ ] **Step 4: Chạy lại test**, kỳ vọng PASS toàn bộ.
- [ ] **Step 5: Cài `auditStem` trong `lang-audit.ts`** và thêm test: một đề điền chỗ trống có `vi` khác NULL thì `"blank-has-vi"`; hybrid mà specimen bị dịch thì `"specimen-translated"`.
- [ ] **Step 6: Commit**
  ```bash
  git add src/lib/grammar/stem-policy.ts src/lib/grammar/stem-policy.test.ts src/lib/grammar/lang-audit.ts src/lib/grammar/lang-audit.test.ts
  git commit -m "feat(grammar): chính sách đề bài tập - giữ nguyên specimen tiếng Anh, chỉ dịch phần chỉ dẫn"
  ```

---

### Task 5: Glossary cue của đề và pass dữ liệu

**Files:**
- Create: `scripts/grammar/build-stem-glossary.ts`
- Create: `src/lib/grammar/stem-glossary.json`
- Create: `src/lib/grammar/stem-glossary.ts`
- Test: `src/lib/grammar/stem-glossary.test.ts`
- Modify: `prisma/grammar-repair-vi.ts` (thêm pass cho `testQuestions` và `practiceQuestions`)
- Modify: `package.json` (thêm `"grammar:build-stem-glossary": "tsx scripts/grammar/build-stem-glossary.ts"`)

**Interfaces:**
- Consumes: `isBlankStem` (từ `vi-repair.ts`) và `splitHybridStem`, `repairStemVi`, `checkStemVi` từ Task 4; `chat`, `parseJsonLoose` từ Task 3.
- Produces: `translateStemCue(cueEn: string): string | null` tra `stem-glossary.json` theo khóa là cue EN đã chuẩn hóa khoảng trắng; bảng JSON dạng `{ "<cue EN>": "<cue VI>" }`.

Lý do dùng glossary thay vì dịch từng đề: số cue riêng biệt rất nhỏ so với 1664 đề không điền chỗ trống (ví dụ "Choose the sentence with the right word order" lặp 60 lần mỗi bảng), nên dịch một lần, người duyệt, rồi áp xác định.

- [ ] **Step 1: Viết `build-stem-glossary.ts`**
  Lấy các cue riêng biệt của mọi đề không phải điền chỗ trống mà `questionVi` đang NULL hoặc không qua `checkStemVi`; với mỗi cue lấy bản VI phổ biến nhất đang có trong DB làm gợi ý, cue chưa có thì nhờ LLM dịch theo lô; ghi `src/lib/grammar/stem-glossary.json` đã sắp xếp theo số lần gặp giảm dần, kèm in tổng số cue và phần trăm đề được phủ.
- [ ] **Step 2: Chạy và duyệt tay**
  Run: `npm run grammar:build-stem-glossary`
  Expected: file JSON được tạo. Người dùng duyệt file (mục lặp nhiều nhất đứng đầu). Nếu số cue riêng biệt vượt xa dự kiến thì dừng và hỏi lại phạm vi trước khi tiếp tục.
- [ ] **Step 3: Viết test thất bại `stem-glossary.test.ts`**
  `translateStemCue("Choose the sentence with the right word order")` trả chuỗi có dấu Việt; `translateStemCue("not a real cue")` trả `null`; mọi giá trị trong JSON đều qua `VI_DIACRITIC.test` (không có mục nào còn tiếng Anh).
  Chạy test, kỳ vọng FAIL.
- [ ] **Step 4: Cài `translateStemCue(cueEn: string): string | null`** trong `stem-glossary.ts`, đọc JSON tĩnh.
  Chạy lại test, kỳ vọng PASS.
- [ ] **Step 5: Nối vào `grammar-repair-vi.ts`**
  Thứ tự cho mỗi đề: bản VI hiện có đi qua `repairStemVi`; nếu kết quả `null` mà đề không phải điền chỗ trống thì thử `translateStemCue` cho cả đề (đề chỉ có chỉ dẫn) hoặc cho phần cue rồi ghép với specimen EN (đề hybrid); cuối cùng chạy `checkStemVi`, không qua thì giữ NULL.
  Giữ nguyên mẫu `--dry-run` / `--only` / `--restore` và snapshot hiện có của script.
- [ ] **Step 6: Dry-run**
  Run: `npm run grammar:repair-vi -- --dry-run --only testQuestions`
  Run: `npm run grammar:repair-vi -- --dry-run --only practiceQuestions`
  Expected: báo số đề đổi từ specimen bị dịch sang specimen EN nguyên văn, số đề được điền cue mới, số đề điền chỗ trống bị đưa về NULL (kỳ vọng 0 vì baseline `blank_with_vi = 0`).
- [ ] **Step 7: Xin người dùng đồng ý, áp, kiểm idempotent và restore**
  Run: `npm run grammar:repair-vi -- --only testQuestions` rồi `--only practiceQuestions`
  Run lần hai ở chế độ `--dry-run`, kỳ vọng 0 thay đổi.
  Kiểm `--restore` bằng cách khôi phục snapshot trên một bản sao DB (nhánh Neon) hoặc kiểm hash trong dry-run phục hồi, không thử trên DB chính.
- [ ] **Step 8: Audit**
  Run: `npm run grammar:audit-language -- --label after-stems`
  Expected: `specimen-translated` là 0, `quote-mangled` là 0, `blank-has-vi` là 0, số đề không điền chỗ trống còn NULL là 0 hoặc nằm trong danh sách lý do được ghi.
- [ ] **Step 9: Commit**
  ```bash
  git add scripts/grammar/build-stem-glossary.ts src/lib/grammar/stem-glossary.json src/lib/grammar/stem-glossary.ts src/lib/grammar/stem-glossary.test.ts prisma/grammar-repair-vi.ts package.json
  git commit -m "feat(grammar): glossary cue đề bài tập và pass sửa questionVi theo chính sách"
  ```

---

### Task 6: Phiên làm bài - bỏ dòng lặp EN dưới đề VI

**Files:**
- Modify: `src/components/grammar/grammar-session.tsx:272-311`

**Interfaces:**
- Consumes: dữ liệu `questionVi` đã sửa từ Task 5 (đề hybrid chứa sẵn specimen EN, nên dòng xám lặp lại `questionEn` dưới đề trở thành thừa và gây nhìn như hai ngôn ngữ chồng nhau).
- Produces: không có interface mới.

- [ ] **Step 1: Tái hiện trên trình duyệt trước khi sửa**
  Run: `npm run dev`, vào `/grammar/<topic có đề hybrid>/test` ở chế độ VI (đề id 1731 thuộc chủ đề câu bị động), chụp ảnh màn hình.
  Expected (lỗi hiện tại): dưới đề VI có thêm một dòng xám là toàn bộ đề EN.
- [ ] **Step 2: Sửa `grammar-session.tsx`**
  Bỏ khối `{lang === "vi" && current.questionVi && current.questionEn !== question && (...)}` quanh dòng 308 đến 310.
  Đề không có VI (điền chỗ trống) vẫn hiện EN và dòng `grammar.test.pickAnswer` ("Chọn đáp án đúng") bên dưới như cũ, nên người học vẫn có chỉ dẫn tiếng Việt.
- [ ] **Step 3: Chạy `npx tsc --noEmit` và `npm run lint`**, kỳ vọng sạch.
- [ ] **Step 4: Kiểm lại trên trình duyệt ở VI và EN**
  Chụp ảnh ba loại đề: điền chỗ trống, hybrid, chỉ có chỉ dẫn; trên cả desktop và mobile 390px.
  Expected: mỗi đề đúng một ngôn ngữ cho phần chỉ dẫn, specimen và đáp án luôn EN, không còn dòng lặp, không lệch căn lề hay xuống dòng xấu.
- [ ] **Step 5: Commit**
  ```bash
  git add src/components/grammar/grammar-session.tsx
  git commit -m "fix(grammar): bỏ dòng lặp đề tiếng Anh dưới đề tiếng Việt trong phiên làm bài"
  ```

---

### Task 7: Nghiệm thu cuối

**Files:**
- Không sửa code, trừ các lỗi lint hoặc test phát sinh.

**Interfaces:**
- Consumes: `grammar:audit-language` từ Task 1, mọi dữ liệu từ Task 2, 3, 5.

- [ ] **Step 1: Chạy toàn bộ kiểm tra**
  Run: `npm run lint`, `npx tsc --noEmit`, `npx vitest run`
  Expected: sạch hoàn toàn. Mọi lỗi hay test flaky, kể cả không do công việc này, phải sửa trong task này.
- [ ] **Step 2: Audit lần cuối và so với baseline**
  Run: `npm run grammar:audit-language -- --label final`
  Expected: so với file `baseline`: `proseGaps`, `headingGaps`, `gluedSpans`, `titleVi` bị cờ, `specimen-translated`, `blank-has-vi` đều bằng 0.
- [ ] **Step 3: Duyệt trình duyệt toàn tuyến ở VI và EN**
  Hub `/grammar`, trang một chủ đề, hai bài lý thuyết, một phiên test hoàn chỉnh (10 câu mỗi loại), màn tổng kết; desktop và mobile.
  Expected: không chỗ nào nửa Anh nửa Việt ngoài specimen có chủ đích; chuyển ngôn ngữ giữa chừng không làm vỡ bố cục.
- [ ] **Step 4: Báo cáo cho người dùng**
  Gồm bảng số trước và sau, danh sách bài hoặc đề còn giữ NULL kèm lý do, và nhắc rõ phạm vi chưa làm (xem dưới).

## Ngoài phạm vi

- `GrammarConfusedPair` và `GrammarCommonMistake`: đã có repair riêng trong `vi-repair.ts` và chưa có màn hình nào dùng, sẽ áp cùng chính sách khi dựng UI cho chúng.
- `explanationVi` và `categoryVi` của `GrammarPracticeQuestion`: DB đã có gần đủ (9992 và 9848 trên 10000) và đã qua `repairExplanationVi`; UI hiện chưa hiển thị. Audit của Task 1 chỉ đếm, không sửa.
- Đáp án (`choicesEn`) luôn là tiếng Anh, đây là quyết định sản phẩm đã chốt ở spec §3.1.
