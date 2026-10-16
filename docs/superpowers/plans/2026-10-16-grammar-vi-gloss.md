# Grammar VI Gloss ("EN - VI") Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ở chế độ VI, mỗi câu tiếng Anh trong ví dụ bài học, đề bài tập và đáp án dạng câu hiển thị thêm bản dịch tiếng Việt cùng dòng, theo dạng `câu tiếng Anh - bản dịch tiếng Việt`.

**Architecture:** Bản dịch lưu riêng trong các cột JSON/String nullable, không đụng `contentEnHtml`, `contentViHtml`, `choicesEn`, nên các cổng bảo vệ vùng tiếng Anh hiện có không bị ảnh hưởng.
Lớp hiển thị ghép `EN - VI` chỉ ở chế độ VI, chế độ EN giữ nguyên.
Bản dịch do Claude viết tay qua vòng export JSON, dịch, import có cổng kiểm, không dùng Z.AI.

**Tech Stack:** TypeScript, Prisma (Neon Postgres, `db push` cho cột mới), vitest, Next.js 14, tsx scripts.

**Spec:** `docs/superpowers/specs/2026-08-14-grammar-module-design.md` §3.1 và §6 (nội dung song ngữ bám `lang`, NULL là "chưa có bản dịch"); yêu cầu mới của người dùng ngày 2026-10-16 (phạm vi: lý thuyết và đề bài tập, định dạng cùng dòng, tự dịch không qua Z.AI).

## Global Constraints

- Định dạng hiển thị chính xác: `<câu tiếng Anh> - <bản dịch tiếng Việt>`, dấu gạch ngang thường có một khoảng trắng hai bên, không dùng em dash.
- Chỉ hiện ở chế độ VI. Chế độ EN giữ nguyên hoàn toàn.
- Quy tắc ngôn ngữ cũ vẫn giữ: ví dụ, đáp án, từ trong ngoặc kép là tiếng Anh nguyên văn; bản dịch là phần thêm vào, không thay thế.
- Cột mới đều nullable, NULL nghĩa là chưa có bản dịch, giao diện bỏ phần ` - ...`, không bao giờ để ô trống.
- Mọi lần ghi DB phải có `--dry-run` trước, snapshot trong `data/backups/`, idempotent khi chạy lại.
- Thay đổi schema (`prisma db push`) và mọi lần ghi lên DB Neon cần người dùng đồng ý trực tiếp.
- Bản dịch do Claude tự viết, không gọi API dịch.
- Không dùng em dash. Markdown dài: mỗi câu một dòng. Commit không kèm co-author của agent.
- Test thuần, không chạm prisma, `*.test.ts` cạnh file nguồn.

## Quy mô (đo ngày 2026-10-16)

- Lý thuyết: 4.672 khối tiếng Anh khác nhau từ 3 từ trở lên (~195 nghìn ký tự), gồm `<li>` 1.938, `<p>` 371, `<td>` 3.061.
- Đề bài tập: test 9.002 đề khác nhau (~387 nghìn ký tự), practice 9.642 đề (~588 nghìn ký tự).
- Đáp án dạng câu (từ 4 từ trở lên): test 3.899, practice 3.407 (~229 nghìn ký tự), đáp án một từ không dịch.
- Tổng khoảng 1,4 triệu ký tự, dịch theo lô ~15 nghìn ký tự mỗi lượt, tức khoảng 100 lượt dịch.
- Ô bảng `<td>` chỉ dịch khi giống câu (từ 4 từ trở lên), các dạng chia động từ ngắn như "I work" bỏ qua.

## Review Focus

1. Câu điền chỗ trống: bản dịch phải giữ số chỗ trống (`_____`) bằng đề gốc, nếu không người học đếm sai.
2. Đề dạng `chỉ dẫn: câu` chỉ dịch phần câu, không dịch lại phần chỉ dẫn đã là tiếng Việt.
3. Khối ví dụ có thẻ `<b>`, `<em>`, span ngữ nghĩa: bản dịch chèn ở cuối khối, không phá cấu trúc thẻ.
4. Đề và đáp án trùng nội dung ở nhiều dòng (203 đề chỉ là `_____`): một bản dịch dùng chung, không dịch lại, đề không có chữ thì không có bản dịch.
5. Đề cũ đã có `questionVi` kiểu `cue: câu EN` (chính sách đề cũ): ghép thêm bản dịch của câu EN phía sau, không làm vỡ cue.

---

### Task 1: Schema, định dạng và công cụ vòng dịch

**Files:**
- Modify: `prisma/schema.prisma` (thêm cột)
- Create: `src/lib/grammar/gloss.ts`
- Test: `src/lib/grammar/gloss.test.ts`
- Create: `scripts/grammar/gloss-export.ts`, `scripts/grammar/gloss-import.ts`
- Modify: `package.json` (hai npm script)

**Interfaces:**
- Produces (các task sau dựa vào):
  - Cột `GrammarLesson.glossVi Json?` dạng `{ "<blockId>": "<bản dịch>" }`.
  - Cột `GrammarTestQuestion` và `GrammarPracticeQuestion`: `stemGlossVi String?`, `choicesGlossVi Json?` (mảng `(string | null)[]` cùng độ dài `choicesEn`).
  - `joinGloss(en: string, vi: string | null | undefined): string` trả `en` khi `vi` rỗng, ngược lại `` `${en} - ${vi}` ``.
  - `checkGloss(en: string, vi: string): CheckResult` ok khi `vi` có dấu tiếng Việt, không chứa thẻ HTML, số chỗ trống `_{2,}` bằng đề gốc, độ dài trong khoảng 0,3 đến 3 lần.
  - `glossTargets(table, row)`: danh sách chuỗi cần dịch của một dòng (bỏ đề toàn chỗ trống, đáp án dưới 4 từ, phần chỉ dẫn tiếng Việt của đề hybrid).

- [ ] **Step 1: Viết test thất bại trong `gloss.test.ts`**
  - `joinGloss("I never drink orange juice.", "Tôi không bao giờ uống nước cam.")` bằng `"I never drink orange juice. - Tôi không bao giờ uống nước cam."`.
  - `joinGloss("I never drink orange juice.", null)` bằng `"I never drink orange juice."`.
  - `checkGloss("I have _____ idea.", "Tôi có ___ ý tưởng.")` không ok vì số chỗ trống khác nhau về độ dài dấu gạch; `checkGloss("I have _____ idea.", "Tôi có _____ ý tưởng.")` ok.
  - `checkGloss("He goes home.", "He goes home.")` không ok (không có dấu tiếng Việt); chuỗi chứa `<b>` không ok.
  - `glossTargets` cho đề `_____` trả mảng rỗng; cho đề hybrid id 1731 trả chỉ phần câu sau dấu hai chấm; cho đáp án `["am", "is", "He is a doctor."]` trả chỉ câu thứ ba.
- [ ] **Step 2: Chạy `npx vitest run src/lib/grammar/gloss.test.ts`**, kỳ vọng FAIL vì module chưa có.
- [ ] **Step 3: Cài `gloss.ts`** theo chữ ký trên, tái dùng `splitHybridStem`, `isBlankStem`, `VI_DIACRITIC`.
- [ ] **Step 4: Chạy lại test**, kỳ vọng PASS.
- [ ] **Step 5: Thêm cột vào `schema.prisma`**, chạy `npx prisma generate`, `npx tsc --noEmit` sạch.
- [ ] **Step 6: Xin người dùng đồng ý rồi chạy `npx prisma db push`** (cột thêm mới, nullable, không mất dữ liệu).
- [ ] **Step 7: Viết `gloss-export.ts`** (ghi JSON các chuỗi chưa có bản dịch, loại trùng, kèm khóa tra ngược) và **`gloss-import.ts`** (đọc JSON bản dịch, chạy `checkGloss`, dry-run mặc định, `--apply` ghi DB có snapshot).
- [ ] **Step 8: Commit**
  ```bash
  git add prisma/schema.prisma src/lib/grammar/gloss.ts src/lib/grammar/gloss.test.ts scripts/grammar/gloss-export.ts scripts/grammar/gloss-import.ts package.json
  git commit -m "feat(grammar): cột glossVi và công cụ vòng dịch EN - VI"
  ```

---

### Task 2: Hiển thị gloss trong trình đọc bài học

**Files:**
- Modify: `src/lib/grammar/lesson-translate.ts` hoặc Create `src/lib/grammar/lesson-gloss.ts`
- Test: `src/lib/grammar/lesson-gloss.test.ts`
- Modify: `src/lib/grammar/data.ts` (đọc `glossVi`), `src/app/grammar/[topic]/lesson/[order]/page.tsx` và `lesson-reader.tsx`

**Interfaces:**
- Consumes: `walkLesson`, `TAG_SPLIT` từ `lesson-translate.ts`/`vi-repair.ts`; cột `glossVi` từ Task 1.
- Produces: `applyBlockGloss(html: string, gloss: Record<string, string>, protectedClasses: ReadonlySet<string>): string` chèn ` - <bản dịch>` (đã escape HTML) ngay trước thẻ đóng của khối có id tương ứng; khối không có trong `gloss` giữ nguyên.

- [ ] **Step 1: Viết test thất bại** với `<ul><li>I never drink juice.</li></ul>` và `{ "0": "Tôi không bao giờ uống nước ép." }` cho kết quả `<ul><li>I never drink juice. - Tôi không bao giờ uống nước ép.</li></ul>`; khối có `<b>`/`<em>` giữ nguyên thẻ; bản dịch chứa `<` được escape; `gloss` rỗng trả nguyên html; chạy hai lần không nhân đôi (hàm nhận html gốc, không chạy trên kết quả).
- [ ] **Step 2: Chạy test**, kỳ vọng FAIL.
- [ ] **Step 3: Cài `applyBlockGloss`** bằng một lượt token walk, đánh số khối đúng như `scan()`.
- [ ] **Step 4: Chạy test**, kỳ vọng PASS.
- [ ] **Step 5: Nối vào trang bài học**: server tính `contentViHtml` đã ghép gloss, truyền thêm prop; `lesson-reader.tsx` dùng bản có gloss khi `lang === "vi"`.
- [ ] **Step 6: Commit**
  ```bash
  git add src/lib/grammar/lesson-gloss.ts src/lib/grammar/lesson-gloss.test.ts src/lib/grammar/data.ts "src/app/grammar/[topic]/lesson/[order]"
  git commit -m "feat(grammar): hiển thị bản dịch EN - VI cho câu ví dụ trong bài học"
  ```

---

### Task 3: Dịch gloss cho bài lý thuyết

**Files:**
- Data: ghi `GrammarLesson.glossVi` qua `gloss-import`.

**Interfaces:**
- Consumes: `gloss-export`/`gloss-import` từ Task 1; `checkGloss`.

- [ ] **Step 1: Export** các khối ví dụ chưa có bản dịch: `npx tsx scripts/grammar/gloss-export.ts --table lessons --out data/llm-runs/gloss/lessons-todo.json`.
  Expected: ~4.700 chuỗi khác nhau, kèm id bài và id khối.
- [ ] **Step 2: Dịch theo lô** ~15 nghìn ký tự mỗi lượt vào `data/llm-runs/gloss/lessons-vi-NN.tsv` (`khóa<TAB>bản dịch`), câu trùng dùng chung một bản dịch.
- [ ] **Step 3: Dry-run import** `npx tsx scripts/grammar/gloss-import.ts lessons-vi.json --dry-run`, kỳ vọng 0 bản bị cổng từ chối; sửa các bản bị từ chối rồi chạy lại.
- [ ] **Step 4: Xin người dùng đồng ý, áp** `--apply`, chạy lại dry-run kỳ vọng 0 thay đổi.
- [ ] **Step 5: Duyệt mẫu** vài bài (`/grammar/simple-present/lesson/2`) ở VI và EN.

---

### Task 4: Hiển thị gloss trong phiên làm bài

**Files:**
- Modify: `src/lib/grammar/data.ts`, `src/lib/grammar/session-types.ts`, `src/app/grammar/[topic]/test/page.tsx`, `src/components/grammar/grammar-session.tsx`
- Test: `src/lib/grammar/gloss.test.ts` (thêm ca ghép đề hybrid)

**Interfaces:**
- Consumes: `joinGloss`, cột `stemGlossVi`, `choicesGlossVi` từ Task 1.
- Produces: `buildStemDisplay(questionEn: string, questionVi: string | null, stemGlossVi: string | null, lang: "vi" | "en"): string` và `buildChoiceDisplay(choice: string, gloss: string | null, lang): string`.

- [ ] **Step 1: Viết test thất bại**: ở `lang = "en"` luôn trả `questionEn`; ở `vi` với đề điền chỗ trống trả `joinGloss(questionEn, gloss)`; với đề hybrid có `questionVi = "Chuyển câu...: Britain kept..."` trả `questionVi` cộng ` - <gloss>`; không có gloss thì trả như hiện tại.
- [ ] **Step 2: Chạy test**, kỳ vọng FAIL.
- [ ] **Step 3: Cài hai hàm** trong `gloss.ts`.
- [ ] **Step 4: Nối vào `grammar-session.tsx`** (đề và từng nút đáp án), mở rộng `SessionQuestion` và truy vấn `select` để lấy hai cột mới.
- [ ] **Step 5: `npx tsc --noEmit` và `npx vitest run`**, kỳ vọng sạch.
- [ ] **Step 6: Commit**
  ```bash
  git add src/lib/grammar src/components/grammar "src/app/grammar/[topic]/test"
  git commit -m "feat(grammar): hiển thị bản dịch EN - VI cho đề và đáp án dạng câu"
  ```

---

### Task 5: Dịch gloss cho đề và đáp án

**Files:**
- Data: ghi `stemGlossVi`, `choicesGlossVi` qua `gloss-import`.

- [ ] **Step 1: Export** theo bảng: `--table testQuestions` rồi `--table practiceQuestions`, loại trùng (~18.600 đề khác nhau, ~7.300 đáp án dạng câu).
- [ ] **Step 2: Dịch theo lô**, đề điền chỗ trống giữ đúng số `_____`, đề hybrid chỉ dịch phần câu.
- [ ] **Step 3: Dry-run, rồi xin đồng ý và áp** từng bảng, chạy lại dry-run kỳ vọng 0 thay đổi.
- [ ] **Step 4: Duyệt phiên làm bài** ở VI và EN trên desktop và mobile 390px (cần Chrome và đăng nhập).

---

### Task 6: Nghiệm thu

- [ ] **Step 1: Thêm bộ đếm độ phủ** vào `audit-language`: số khối ví dụ, đề, đáp án dạng câu đã có gloss so với tổng.
- [ ] **Step 2: Chạy** `npx vitest run`, `npx tsc --noEmit`, `npm run grammar:audit-language -- --label gloss-final`.
  Expected: độ phủ 100% cho mục tiêu của Task 3 và Task 5, test sạch.
- [ ] **Step 3: Review độc lập** cả branch, sửa Critical và Important, rồi báo cáo.

## Ngoài phạm vi

- Dịch `confused`/`mistakes` (chưa có màn hình).
- Ô bảng dạng chia động từ ngắn và đáp án một từ.
- Chuyển đổi bật/tắt bản dịch trong giao diện (bản dịch luôn hiện ở chế độ VI).
