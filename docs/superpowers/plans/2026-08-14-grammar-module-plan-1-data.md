# Grammar Module — Plan 1/3: Nền dữ liệu (schema + import + vòng dịch) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Đưa toàn bộ nội dung ngữ pháp từ `EnglishGrammar_extracted/` vào Postgres qua một pipeline import idempotent, kèm cặp script translate-export/import cho vòng dịch VI, và toàn bộ schema (nội dung + tiến độ) để Plan 2–3 không phải đụng schema nữa.

**Architecture:** Logic làm sạch là các hàm thuần trong `src/lib/grammar/` (vitest cover được, không chạm prisma); script `prisma/import-grammar.ts` chỉ là lớp wiring mỏng: đọc CSV → gọi hàm thuần → upsert. Cột `*Vi` NULL nghĩa là "cần dịch" — translate-export query thẳng NULL, translate-import UPDATE ngược, không cần bảng tracking.

**Tech Stack:** Prisma 5 (Postgres/Neon, `db push`), tsx, vitest, devDeps mới: `csv-parse`, `sanitize-html`, `@types/sanitize-html`.

**Spec:** `docs/superpowers/specs/2026-08-14-grammar-module-design.md` (§3 data model, §4 pipeline & vòng dịch). Plan này là phase 1 của §10; Plan 2 (hub/lessons/test/mastery) và Plan 3 (practice/confused/mistakes/review/badges) viết sau khi plan này chạy xong.

## Global Constraints

- Branch làm việc: tạo `feat/grammar-data` từ `docs/grammar-module` (spec đi cùng code).
- Repo **không có ESLint**; không thêm linter. Comment tiếng Anh trong `src/lib/` và `prisma/*.ts` (theo style `import-packs.ts`, `gamification-defs.ts`).
- Schema áp bằng `npm run db:push` (repo không dùng migration files). DATABASE_URL trong `.env` (script tsx PHẢI mở đầu bằng `import "./load-env";` — tsx không tự đọc `.env`).
- Test: vitest chỉ include `src/**/*.test.{ts,tsx}` (vitest.config.ts) — mọi logic cần test phải nằm trong `src/`, file test đặt cạnh, **không import prisma/server-only**.
- Nguồn `EnglishGrammar_extracted/` KHÔNG commit (đã untracked, giữ nguyên). `public/grammar/images/` (30 PNG script copy sang) PHẢI commit — runtime cần.
- CSV: có BOM (utf-8-sig), field quoted nhiều dòng, `answer_index` **1-based**, choices tách bằng `##`.
- Mọi cột `*Vi` nullable; **NULL = cần dịch**. Import KHÔNG bao giờ ghi đè cột `*Vi` khi update (bản dịch do translate-import điền phải sống sót qua lần import lại) — CSV VI chỉ áp lúc create.
- Số kỳ vọng sau import (lệch → exit code ≠ 0): 33 topics, 292 lessons, 9.380 test questions, 10.000 practice questions, 832 confused pairs, 687 mistakes.

---

### Task 1: Schema — toàn bộ bảng grammar + `DailyStat.grammarCount`

**Files:**
- Modify: `prisma/schema.prisma` (User model ~dòng 13–34; DailyStat ~dòng 174–190; append cuối file)

**Interfaces:**
- Consumes: —
- Produces: Prisma client có các delegate `grammarTopic`, `grammarLesson`, `grammarTestQuestion`, `grammarPracticeQuestion`, `grammarConfusedPair`, `grammarCommonMistake`, `grammarLessonRead`, `grammarTopicProgress`, `grammarCategoryStat`, `grammarAnswerState`; `DailyStat.grammarCount: Int`. Khóa compound: `grammarLesson` upsert qua `topicId_order`; `grammarAnswerState` qua `userId_source_questionId`.

- [ ] **Step 1: Thêm relation lists vào model User**

Trong `model User`, thêm 4 dòng ngay sau `pushSubscriptions PushSubscription[]`:

```prisma
  grammarLessonReads   GrammarLessonRead[]
  grammarTopicProgress GrammarTopicProgress[]
  grammarCategoryStats GrammarCategoryStat[]
  grammarAnswerStates  GrammarAnswerState[]
```

- [ ] **Step 2: Thêm `grammarCount` vào model DailyStat**

Ngay sau dòng `bonusXp Int @default(0) // …`:

```prisma
  // Grammar answers submitted this day (right or wrong). Feeds the streak
  // (computeStreakFromDb ORs on it — Plan 2); kept OUT of totalCount so vocab
  // accuracy/heatmap stats stay pure SRS.
  grammarCount Int @default(0)
```

- [ ] **Step 3: Append các model grammar vào cuối `prisma/schema.prisma`**

```prisma
// ── Grammar module: content ──────────────────────────────────────────
// Immutable after import (import-grammar.ts). Every *Vi column is nullable:
// NULL = "needs translation" — grammar-translate-export queries exactly that,
// grammar-translate-import fills it back. No side tracking table.

model GrammarTopic {
  id      Int     @id // stable catalog id (src/lib/grammar/catalog.ts)
  slug    String  @unique // kebab EN: "past-perfect", "reported-speech", …
  nameEn  String
  nameVi  String?
  cluster String // "tenses" | "word-classes" | "sentence" | "other"
  order   Int // position within its cluster

  lessons       GrammarLesson[]
  testQuestions GrammarTestQuestion[]
}

model GrammarLesson {
  id            Int     @id @default(autoincrement())
  topicId       Int
  order         Int // lesson_order from lessons.csv (natural key: topic+order)
  titleEn       String
  titleVi       String?
  contentEnHtml String  @db.Text // sanitized + image paths rewritten at import
  contentViHtml String? @db.Text

  topic GrammarTopic @relation(fields: [topicId], references: [id], onDelete: Cascade)

  @@unique([topicId, order])
}

model GrammarTestQuestion {
  id          Int     @id // source id from tests.csv
  topicId     Int
  questionEn  String
  questionVi  String?
  choicesEn   Json // string[], 2–4 items; answers are EN-only by design
  answerIndex Int // normalized 0-based

  topic GrammarTopic @relation(fields: [topicId], references: [id], onDelete: Cascade)

  @@index([topicId])
}

model GrammarPracticeQuestion {
  id            Int     @id // source id from grammar_questions.csv
  level         Int // 1 | 2
  categoryEn    String
  categoryVi    String?
  questionEn    String
  questionVi    String?
  choicesEn     Json // string[]
  answerIndex   Int // normalized 0-based
  explanationEn String? @db.Text
  explanationVi String? @db.Text

  @@index([level, categoryEn])
}

model GrammarConfusedPair {
  id        Int     @id // source id from confused_words.csv
  titleEn   String // "a few, afew"
  titleVi   String?
  entriesEn Json // ConfusedEntry[]: [{ w, m, examples: string[] }]
  entriesVi Json? // same shape; NULL when the mangled source JSON was unrepairable
}

model GrammarCommonMistake {
  id       Int     @id // source id from common_mistakes.csv
  category String // category slug (catalog.ts names the 22 numeric groups)
  titleEn  String
  titleVi  String?
  bodyEn   String  @db.Text
  bodyVi   String? @db.Text
  noteEn   String? @db.Text
  noteVi   String? @db.Text

  @@index([category])
}

// ── Grammar module: per-user progress ────────────────────────────────
// No FK to content tables on purpose: re-import must never cascade into user
// progress. questionId meaning depends on `source`.

model GrammarLessonRead {
  userId   String
  lessonId Int
  readAt   DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@id([userId, lessonId])
}

model GrammarTopicProgress {
  userId   String
  topicId  Int
  answered Int    @default(0)
  correct  Int    @default(0)
  recent   Json   @default("[]") // ring buffer, ≤20 booleans, newest last

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@id([userId, topicId])
}

model GrammarCategoryStat {
  userId   String
  level    Int
  category String // GrammarPracticeQuestion.categoryEn
  answered Int    @default(0)
  correct  Int    @default(0)

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@id([userId, level, category])
}

// source: "topic_test" | "practice" | "confused". One row per question a user
// ever answered. firstCorrectAt is the anti-farm XP ledger (set exactly once);
// wrongCount/lastWrongAt/resolvedAt drive the wrong-answer notebook
// (in the notebook ⇔ wrongCount > 0 AND resolvedAt IS NULL).
model GrammarAnswerState {
  userId         String
  source         String
  questionId     Int
  firstCorrectAt DateTime?
  wrongCount     Int       @default(0)
  lastWrongAt    DateTime?
  resolvedAt     DateTime?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@id([userId, source, questionId])
  @@index([userId, resolvedAt])
}
```

- [ ] **Step 4: Validate + đẩy schema**

Run: `npx prisma format && npm run db:push`
Expected: format không lỗi; db push báo "Your database is now in sync". (`postinstall` đã chạy generate; nếu client cũ: `npx prisma generate`.)

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(grammar): schema — 6 bảng nội dung, 4 bảng tiến độ, DailyStat.grammarCount"
```

---

### Task 2: devDeps + hàm làm sạch CSV thuần (`clean.ts`)

**Files:**
- Create: `src/lib/grammar/clean.ts`
- Test: `src/lib/grammar/clean.test.ts`
- Modify: `package.json` (devDependencies — qua npm install)

**Interfaces:**
- Consumes: —
- Produces: `parseCsvRecords(raw: string): Record<string, string>[]` · `normalizeChoices(cells: string[], answerIndex1: string): { choices: string[]; answerIndex: number } | null` · `viOrNull(vi: string | null | undefined, en: string): string | null` · `splitMeaningExamples(m: string): { meaning: string; examples: string[] }`

- [ ] **Step 1: Cài devDeps**

Run: `npm install -D csv-parse sanitize-html @types/sanitize-html`

- [ ] **Step 2: Viết test fail**

```ts
// src/lib/grammar/clean.test.ts
import { describe, expect, it } from "vitest";
import { normalizeChoices, parseCsvRecords, splitMeaningExamples, viOrNull } from "./clean";

describe("parseCsvRecords", () => {
  it("handles BOM, quoted multiline fields and embedded quotes", () => {
    const raw = '﻿"id","body"\n"1","line1\nline2 said ""hi"""\n';
    expect(parseCsvRecords(raw)).toEqual([{ id: "1", body: 'line1\nline2 said "hi"' }]);
  });
});

describe("normalizeChoices", () => {
  it("splits ##-cells, converts 1-based answer to 0-based", () => {
    expect(normalizeChoices("is ## are ## has".split("##"), "1")).toEqual({
      choices: ["is", "are", "has"],
      answerIndex: 0,
    });
  });
  it("keeps the answer aligned when empty cells are dropped", () => {
    // tests.csv row with only a/b/d filled, answer_index=4 (→ "d")
    expect(normalizeChoices(["man", "men", "", "mice"], "4")).toEqual({
      choices: ["man", "men", "mice"],
      answerIndex: 2,
    });
  });
  it("rejects out-of-range, empty-answer-cell and <2 choices", () => {
    expect(normalizeChoices(["a", "b"], "3")).toBeNull();
    expect(normalizeChoices(["a", "", "c"], "2")).toBeNull();
    expect(normalizeChoices(["only", ""], "1")).toBeNull();
    expect(normalizeChoices(["a", "b"], "x")).toBeNull();
  });
});

describe("viOrNull", () => {
  it("nulls empty and whitespace-only", () => {
    expect(viOrNull("", "text")).toBeNull();
    expect(viOrNull("   ", "text")).toBeNull();
    expect(viOrNull(undefined, "text")).toBeNull();
  });
  it("nulls VI identical to EN (machine translation skipped the string)", () => {
    expect(viOrNull("The  Girl", "the girl")).toBeNull();
  });
  it("keeps a real translation", () => {
    expect(viOrNull("danh từ", "Nouns")).toBe("danh từ");
  });
});

describe("splitMeaningExamples", () => {
  it("splits #-prefixed lines out of a confused-word meaning", () => {
    const m = '"A few" is a phrase meaning not many.\n# Hurry up if you want yellow.';
    expect(splitMeaningExamples(m)).toEqual({
      meaning: '"A few" is a phrase meaning not many.',
      examples: ["Hurry up if you want yellow."],
    });
  });
  it("returns no examples when there is no # line", () => {
    expect(splitMeaningExamples("Just a meaning.")).toEqual({ meaning: "Just a meaning.", examples: [] });
  });
});
```

- [ ] **Step 3: Chạy test, xác nhận fail**

Run: `npx vitest run src/lib/grammar/clean.test.ts`
Expected: FAIL — "Cannot find module './clean'" (hoặc tương đương).

- [ ] **Step 4: Viết `src/lib/grammar/clean.ts`**

```ts
// Pure CSV-field cleaners for the grammar import pipeline
// (prisma/import-grammar.ts). Prisma-free so vitest can cover them.
import { parse } from "csv-parse/sync";

// Raw CSV file → records keyed by header row. Source files carry a BOM and
// quoted multiline fields; csv-parse handles both.
export function parseCsvRecords(raw: string): Record<string, string>[] {
  return parse(raw, { columns: true, bom: true, skip_empty_lines: true });
}

// Normalize a choice list + its 1-based answer index from either source shape:
//   tests.csv            → cells = [a_en, b_en, c_en, d_en] (some empty)
//   grammar_questions.csv → cells = choices_en.split("##")
// Empty cells are dropped, but the answer must stay pointing at the same TEXT,
// so the 0-based index is recomputed as "non-empty cells before the answer".
// null = unusable row (importer skips + reports it).
export function normalizeChoices(
  cells: string[],
  answerIndex1: string
): { choices: string[]; answerIndex: number } | null {
  const trimmed = cells.map((s) => (s ?? "").trim());
  const n = Number.parseInt(answerIndex1, 10);
  if (!Number.isInteger(n) || n < 1 || n > trimmed.length || !trimmed[n - 1]) return null;
  const choices = trimmed.filter(Boolean);
  if (choices.length < 2) return null;
  const answerIndex = trimmed.slice(0, n - 1).filter(Boolean).length;
  return { choices, answerIndex };
}

// The machine translation left many VI fields empty or byte-identical to the
// EN text. Both mean "no usable translation" → NULL in the DB, which
// grammar-translate-export later picks up as "needs translation".
export function viOrNull(vi: string | null | undefined, en: string): string | null {
  const v = (vi ?? "").trim();
  if (!v) return null;
  const norm = (s: string) => s.replace(/\s+/g, " ").toLowerCase();
  if (norm(v) === norm(en)) return null;
  return v;
}

// Confused-word meaning strings embed example sentences as lines starting
// with "#": '"A few" is …\n# Hurry up …'.
export function splitMeaningExamples(m: string): { meaning: string; examples: string[] } {
  const meaning: string[] = [];
  const examples: string[] = [];
  for (const line of m.split("\n")) {
    const t = line.trim();
    if (t.startsWith("#")) examples.push(t.replace(/^#\s*/, ""));
    else if (t) meaning.push(t);
  }
  return { meaning: meaning.join(" "), examples };
}
```

- [ ] **Step 5: Chạy test, xác nhận pass**

Run: `npx vitest run src/lib/grammar/clean.test.ts`
Expected: PASS toàn bộ.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/lib/grammar/clean.ts src/lib/grammar/clean.test.ts
git commit -m "feat(grammar): CSV cleaners thuần + devDeps csv-parse/sanitize-html"
```

---

### Task 3: Parse + repair JSON confused_words (`confused-json.ts`)

**Files:**
- Create: `src/lib/grammar/confused-json.ts`
- Test: `src/lib/grammar/confused-json.test.ts`

**Interfaces:**
- Consumes: `splitMeaningExamples` từ `./clean` (Task 2)
- Produces: `type ConfusedEntry = { w: string; m: string; examples: string[] }` · `parseEntriesEn(bodyEn: string): ConfusedEntry[]` (throw khi hỏng — importer bắt để skip+report) · `parseEntriesVi(bodyVi: string): ConfusedEntry[] | null` (null = không cứu được → cần dịch)

Bối cảnh dữ liệu (đã đo trên toàn bộ 832 dòng): `body_en` parse JSON được **100%**; `body_vi` hỏng **832/832** nhưng theo vài pattern cơ khí — `":"` sau key `"w"`/`"m"` bị biến thành `>` hoặc biến mất. Fixture dưới đây là trích nguyên văn từ dòng id 1 và 2.

- [ ] **Step 1: Viết test fail**

```ts
// src/lib/grammar/confused-json.test.ts
import { describe, expect, it } from "vitest";
import { parseEntriesEn, parseEntriesVi } from "./confused-json";

describe("parseEntriesEn", () => {
  it("parses a well-formed body and splits examples out of m", () => {
    const body = JSON.stringify([
      { w: "A few", m: '"A few" is a phrase.\n# Hurry up if you want yellow.' },
      { w: "Afew", m: '"Afew" is an incorrect spelling.' },
    ]);
    const entries = parseEntriesEn(body);
    expect(entries).toHaveLength(2);
    expect(entries[0]).toEqual({
      w: "A few",
      m: '"A few" is a phrase.',
      examples: ["Hurry up if you want yellow."],
    });
    expect(entries[1].examples).toEqual([]);
  });
  it("throws on garbage so the importer can skip + report the row", () => {
    expect(() => parseEntriesEn("not json")).toThrow();
    expect(() => parseEntriesEn('{"w":"solo object"}')).toThrow();
  });
});

describe("parseEntriesVi", () => {
  it('repairs the `"w">value` mangling (real row id=1)', () => {
    const broken =
      '[{"w">Một vài","m":"\\"Một vài\\" là một cụm từ.\\n# Hãy nhanh lên nếu bạn muốn màu vàng."},' +
      '{"w"Afew","m":"Afew\\" là cách viết sai."}]';
    const entries = parseEntriesVi(broken);
    expect(entries).not.toBeNull();
    expect(entries![0].w).toBe("Một vài");
    expect(entries![0].examples).toEqual(["Hãy nhanh lên nếu bạn muốn màu vàng."]);
    expect(entries![1].w).toBe("Afew");
  });
  it('repairs the `"m">value` mangling (real row id=2)', () => {
    const broken = '[{"w"A hold","m">Ahold\\" là một cụm từ."}]';
    const entries = parseEntriesVi(broken);
    expect(entries).not.toBeNull();
    expect(entries![0].w).toBe("A hold");
  });
  it("returns null for empty or unrepairable input", () => {
    expect(parseEntriesVi("")).toBeNull();
    expect(parseEntriesVi("hoàn toàn không phải json {{{")).toBeNull();
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `npx vitest run src/lib/grammar/confused-json.test.ts`
Expected: FAIL — module chưa tồn tại.

- [ ] **Step 3: Viết `src/lib/grammar/confused-json.ts`**

```ts
// confused_words.csv body parsing. EN bodies are all valid JSON (measured on
// all 832 rows). VI bodies were mangled by whatever produced the CSV — the
// `":"` after a "w"/"m" key collapsed into `>` or vanished (832/832 rows) —
// but the damage is mechanical, so we attempt regex repairs before giving up.
import { splitMeaningExamples } from "./clean";

export type ConfusedEntry = { w: string; m: string; examples: string[] };

function toEntries(parsed: unknown): ConfusedEntry[] | null {
  if (!Array.isArray(parsed) || parsed.length === 0) return null;
  const out: ConfusedEntry[] = [];
  for (const item of parsed) {
    if (typeof item !== "object" || item === null) return null;
    const { w, m } = item as { w?: unknown; m?: unknown };
    if (typeof w !== "string" || typeof m !== "string" || !w.trim()) return null;
    const { meaning, examples } = splitMeaningExamples(m);
    out.push({ w: w.trim(), m: meaning, examples });
  }
  return out;
}

// Throws on failure — the importer catches, skips the row and reports it.
export function parseEntriesEn(bodyEn: string): ConfusedEntry[] {
  const entries = toEntries(JSON.parse(bodyEn));
  if (!entries) throw new Error("body_en is not a [{w,m}] array");
  return entries;
}

// Observed manglings, in application order. Repairs may misfire on exotic
// content — that's fine: the result then fails toEntries() and we return null.
const REPAIRS: Array<[RegExp, string]> = [
  [/"w">/g, '"w":"'], // {"w">Một vài"   → {"w":"Một vài"
  [/"m">/g, '"m":"'], // "m">Ahold …     → "m":"Ahold …
  [/\{"w"(?!\s*:)/g, '{"w":"'], // {"w"A hold"   → {"w":"A hold"
  [/,"m"(?!\s*:)"?/g, ',"m":"'], // ,"m""Along …  → ,"m":"Along …
];

// null = no usable VI (→ DB NULL → exported for translation later).
export function parseEntriesVi(bodyVi: string): ConfusedEntry[] | null {
  const raw = (bodyVi ?? "").trim();
  if (!raw) return null;
  const repaired = REPAIRS.reduce((s, [re, sub]) => s.replace(re, sub), raw);
  for (const attempt of [raw, repaired]) {
    try {
      const entries = toEntries(JSON.parse(attempt));
      if (entries) return entries;
    } catch {
      // try the next attempt / fall through to null
    }
  }
  return null;
}
```

- [ ] **Step 4: Chạy test, xác nhận pass**

Run: `npx vitest run src/lib/grammar/confused-json.test.ts`
Expected: PASS. Nếu fixture id=2 fail vì repair thứ 4 nuốt nhầm ký tự: sửa regex theo output thật, mục tiêu bất biến là "parse được hoặc trả null, không bao giờ trả entry sai shape".

- [ ] **Step 5: Commit**

```bash
git add src/lib/grammar/confused-json.ts src/lib/grammar/confused-json.test.ts
git commit -m "feat(grammar): parse + repair JSON song ngữ của confused_words"
```

---

### Task 4: Sanitize + rewrite ảnh cho HTML bài học (`lesson-html.ts`)

**Files:**
- Create: `src/lib/grammar/lesson-html.ts`
- Test: `src/lib/grammar/lesson-html.test.ts`

**Interfaces:**
- Consumes: devDep `sanitize-html` (Task 2)
- Produces: `LESSON_IMAGE_PREFIX = "/grammar/images/"` · `SEMANTIC_SPAN_CLASSES: readonly string[]` (Plan 2 dùng lại cho stylesheet) · `cleanLessonHtml(html: string, availableImages: Set<string>): { html: string; missingImages: string[] }`

Bối cảnh dữ liệu (đã đo trên cả 292 bài × 2 ngôn ngữ): HTML nguồn chứa cả `<script>`, `<style>`, `<font>`, `<div>`, `<center>`, `<a>`…; ~80 class trình bày rác (wp-block-\*, scrollbar\*, german, example1–10…) lẫn 16 class ngữ nghĩa thật. `content_vi_html` cũng nhúng ảnh (25 bài) — làm sạch CẢ HAI ngôn ngữ bằng cùng một hàm.

- [ ] **Step 1: Viết test fail**

```ts
// src/lib/grammar/lesson-html.test.ts
import { describe, expect, it } from "vitest";
import { cleanLessonHtml, LESSON_IMAGE_PREFIX } from "./lesson-html";

const IMGS = new Set(["tenses.png", "simple_past1e.png"]);

describe("cleanLessonHtml", () => {
  it("rewrites android_asset image paths", () => {
    const { html, missingImages } = cleanLessonHtml(
      '<p><img src="file:///android_asset/images/tenses.png" alt="t"></p>',
      IMGS
    );
    expect(html).toContain(`src="${LESSON_IMAGE_PREFIX}tenses.png"`);
    expect(missingImages).toEqual([]);
  });
  it("drops <img> whose file was never extracted and reports it", () => {
    const { html, missingImages } = cleanLessonHtml(
      '<p>x<img src="file:///android_asset/images/ae.svg">y</p>',
      IMGS
    );
    expect(html).not.toContain("<img");
    expect(html).toContain("xy");
    expect(missingImages).toEqual(["ae.svg"]);
  });
  it("keeps semantic span classes, strips junk classes", () => {
    const { html } = cleanLessonHtml(
      '<p><span class="verb">go</span><span class="wp-block-group has-vivid-cyan-blue-color">junk</span></p>',
      IMGS
    );
    expect(html).toContain('<span class="verb">go</span>');
    expect(html).toContain("<span>junk</span>");
  });
  it("removes script/style WITH their contents, unwraps font/div/center", () => {
    const { html } = cleanLessonHtml(
      "<div><script>alert(1)</script><style>.x{}</style><font color=\"red\">text</font><center>mid</center></div>",
      IMGS
    );
    expect(html).not.toContain("alert");
    expect(html).not.toContain(".x{}");
    expect(html).not.toContain("<font");
    expect(html).toContain("text");
    expect(html).toContain("mid");
  });
  it("keeps tables and their colspan", () => {
    const { html } = cleanLessonHtml(
      '<table><thead><tr><th colspan="2">h</th></tr></thead><tbody><tr><td>a</td><td>b</td></tr></tbody></table>',
      IMGS
    );
    expect(html).toContain('colspan="2"');
    expect(html).toContain("<tbody>");
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `npx vitest run src/lib/grammar/lesson-html.test.ts`
Expected: FAIL — module chưa tồn tại.

- [ ] **Step 3: Viết `src/lib/grammar/lesson-html.ts`**

```ts
// Lesson HTML is sanitized ONCE, at import time. The DB stores clean HTML and
// the client renders it with dangerouslySetInnerHTML and no runtime gate —
// this file is the only gate, so the whitelist errs on the side of dropping.
import sanitizeHtml from "sanitize-html";

export const LESSON_IMAGE_PREFIX = "/grammar/images/";
const ANDROID_ASSET_PREFIX = "file:///android_asset/images/";

// The 16 semantic classes actually present in the source lessons — the Plan-2
// lesson stylesheet colors exactly these. Everything else (wp-block-*,
// scrollbar4, german, example1–10, …) is layout junk from the source site:
// the class is stripped, the span and its text stay.
export const SEMANTIC_SPAN_CLASSES = [
  "adjective", "adverb", "verb", "subject", "object", "auxiliary",
  "infinitive", "negation", "signal-word", "ending", "irregular-past",
  "irregular-participle", "place", "mistake", "consonant", "vowel",
] as const;

export type CleanLessonResult = { html: string; missingImages: string[] };

export function cleanLessonHtml(html: string, availableImages: Set<string>): CleanLessonResult {
  const missingImages: string[] = [];
  const out = sanitizeHtml(html, {
    allowedTags: [
      "h1", "h2", "h3", "h4", "p", "table", "thead", "tbody", "tr", "th", "td",
      "ul", "ol", "li", "b", "strong", "i", "em", "u", "s", "del", "br", "hr",
      "blockquote", "span", "img", "sup", "cite",
    ],
    // Disallowed tags (font/div/figure/center/a/ins/g/…) are UNWRAPPED — text
    // survives. These must vanish WITH their contents instead:
    nonTextTags: ["script", "style", "aside", "textarea", "option"],
    allowedAttributes: {
      span: ["class"],
      img: ["src", "alt"],
      td: ["colspan", "rowspan"],
      th: ["colspan", "rowspan"],
    },
    allowedClasses: { span: [...SEMANTIC_SPAN_CLASSES] },
    transformTags: {
      strike: "s",
      img: (tagName, attribs) => ({
        tagName,
        attribs: { ...attribs, src: (attribs.src ?? "").replace(ANDROID_ASSET_PREFIX, LESSON_IMAGE_PREFIX) },
      }),
    },
    // Runs after transformTags: drop any <img> not resolving to an extracted file.
    exclusiveFilter: (frame) => {
      if (frame.tag !== "img") return false;
      const src = frame.attribs.src ?? "";
      if (!src.startsWith(LESSON_IMAGE_PREFIX)) {
        missingImages.push(src);
        return true;
      }
      const file = src.slice(LESSON_IMAGE_PREFIX.length);
      if (!availableImages.has(file)) {
        missingImages.push(file);
        return true;
      }
      return false;
    },
  });
  return { html: out, missingImages };
}
```

- [ ] **Step 4: Chạy test, xác nhận pass**

Run: `npx vitest run src/lib/grammar/lesson-html.test.ts`
Expected: PASS. Lưu ý hai điểm API dễ vấp của sanitize-html, nếu fail thì chỉnh theo hành vi thật thay vì đổi kỳ vọng test: (a) `exclusiveFilter` phải thấy `src` ĐÃ transform — nếu không, chuyển việc rewrite src ra một bước `String.replaceAll` trước khi gọi sanitize; (b) unwrap tag không thuộc allowedTags là hành vi mặc định (`disallowedTagsMode: "discard"` giữ text con).

- [ ] **Step 5: Commit**

```bash
git add src/lib/grammar/lesson-html.ts src/lib/grammar/lesson-html.test.ts
git commit -m "feat(grammar): sanitize + rewrite ảnh HTML bài học (whitelist theo dữ liệu thật)"
```

---

### Task 5: Catalog tĩnh — 33 chủ đề, 4 cụm, 22 nhóm lỗi, số kỳ vọng (`catalog.ts`)

**Files:**
- Create: `src/lib/grammar/catalog.ts`
- Test: `src/lib/grammar/catalog.test.ts`

**Interfaces:**
- Consumes: —
- Produces: `type GrammarCluster = "tenses" | "word-classes" | "sentence" | "other"` · `type TopicDef = { id: number; slug: string; sourceTopicEn: string; nameEn: string; nameVi: string; cluster: GrammarCluster; order: number }` · `GRAMMAR_TOPICS: TopicDef[]` (33) · `TOPIC_BY_SOURCE_EN: Map<string, TopicDef>` · `type MistakeCategoryDef = { code: number; slug: string; nameEn: string; nameVi: string }` · `MISTAKE_CATEGORIES: MistakeCategoryDef[]` (22) · `MISTAKE_CATEGORY_BY_CODE: Map<number, MistakeCategoryDef>` · `EXPECTED_COUNTS`. Plan 2–3 dùng lại toàn bộ (hub group theo cluster, trang mistakes group theo category).

`sourceTopicEn` phải khớp **nguyên văn** chuỗi trong CSV (importer match bằng equality). `nameVi` tự soạn sạch (CSV topic_vi có rác kiểu "Quá khứ hoàn thành tiếp diễn (Lũy tiến)"), nên GrammarTopic.nameVi không bao giờ NULL.

- [ ] **Step 1: Viết test fail**

```ts
// src/lib/grammar/catalog.test.ts
import { describe, expect, it } from "vitest";
import {
  EXPECTED_COUNTS, GRAMMAR_TOPICS, MISTAKE_CATEGORIES, MISTAKE_CATEGORY_BY_CODE, TOPIC_BY_SOURCE_EN,
} from "./catalog";

describe("GRAMMAR_TOPICS", () => {
  it("has 33 topics with unique ids, slugs and source names", () => {
    expect(GRAMMAR_TOPICS).toHaveLength(33);
    expect(new Set(GRAMMAR_TOPICS.map((t) => t.id)).size).toBe(33);
    expect(new Set(GRAMMAR_TOPICS.map((t) => t.slug)).size).toBe(33);
    expect(new Set(GRAMMAR_TOPICS.map((t) => t.sourceTopicEn)).size).toBe(33);
  });
  it("clusters split 15/12/5/1", () => {
    const by = (c: string) => GRAMMAR_TOPICS.filter((t) => t.cluster === c).length;
    expect(by("tenses")).toBe(15);
    expect(by("word-classes")).toBe(12);
    expect(by("sentence")).toBe(5);
    expect(by("other")).toBe(1);
  });
  it("kebab slugs only, and every topic has a hand-written nameVi", () => {
    for (const t of GRAMMAR_TOPICS) {
      expect(t.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(t.nameVi.length).toBeGreaterThan(0);
    }
  });
  it("looks up by exact CSV topic string", () => {
    expect(TOPIC_BY_SOURCE_EN.get("Future with 'going to'")?.slug).toBe("going-to-future");
    expect(TOPIC_BY_SOURCE_EN.get("Modals and Modal Auxiliaries")?.cluster).toBe("word-classes");
  });
});

describe("MISTAKE_CATEGORIES", () => {
  it("covers codes 1..22 exactly once", () => {
    expect(MISTAKE_CATEGORIES).toHaveLength(22);
    expect(new Set(MISTAKE_CATEGORIES.map((c) => c.code)).size).toBe(22);
    for (let code = 1; code <= 22; code++) expect(MISTAKE_CATEGORY_BY_CODE.get(code)).toBeDefined();
  });
});

describe("EXPECTED_COUNTS", () => {
  it("matches the spec success criteria", () => {
    expect(EXPECTED_COUNTS).toEqual({
      topics: 33, lessons: 292, testQuestions: 9380,
      practiceQuestions: 10000, confusedPairs: 832, commonMistakes: 687,
    });
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `npx vitest run src/lib/grammar/catalog.test.ts`
Expected: FAIL — module chưa tồn tại.

- [ ] **Step 3: Viết `src/lib/grammar/catalog.ts`**

```ts
// Static grammar catalog. sourceTopicEn MUST match the CSV topic_en strings
// verbatim (the importer joins on it). nameVi is hand-written here because the
// CSV's machine-translated topic names are unusable ("Lũy tiến", …).
export type GrammarCluster = "tenses" | "word-classes" | "sentence" | "other";

export type TopicDef = {
  id: number;
  slug: string;
  sourceTopicEn: string;
  nameEn: string;
  nameVi: string;
  cluster: GrammarCluster;
  order: number;
};

const t = (
  id: number, slug: string, sourceTopicEn: string, nameEn: string, nameVi: string,
  cluster: GrammarCluster, order: number
): TopicDef => ({ id, slug, sourceTopicEn, nameEn, nameVi, cluster, order });

export const GRAMMAR_TOPICS: TopicDef[] = [
  // ── tenses ──────────────────────────────────────────────────────────
  t(1, "simple-present", "Simple Present", "Simple Present", "Thì hiện tại đơn", "tenses", 1),
  t(2, "present-continuous", "Present Continuous (Progressive)", "Present Continuous", "Thì hiện tại tiếp diễn", "tenses", 2),
  t(3, "present-perfect", "Present Perfect", "Present Perfect", "Thì hiện tại hoàn thành", "tenses", 3),
  t(4, "present-perfect-continuous", "Present Perfect Continuous (Progressive)", "Present Perfect Continuous", "Thì hiện tại hoàn thành tiếp diễn", "tenses", 4),
  t(5, "simple-past", "Simple Past", "Simple Past", "Thì quá khứ đơn", "tenses", 5),
  t(6, "past-continuous", "Past Continuous (Progressive)", "Past Continuous", "Thì quá khứ tiếp diễn", "tenses", 6),
  t(7, "past-perfect", "Past Perfect", "Past Perfect", "Thì quá khứ hoàn thành", "tenses", 7),
  t(8, "past-perfect-continuous", "Past Perfect Continuous (Progressive)", "Past Perfect Continuous", "Thì quá khứ hoàn thành tiếp diễn", "tenses", 8),
  t(9, "simple-future", "Simple Future (will-future)", "Simple Future (will)", "Thì tương lai đơn (will)", "tenses", 9),
  t(10, "going-to-future", "Future with 'going to'", "Future with 'going to'", "Tương lai với 'going to'", "tenses", 10),
  t(11, "future-continuous", "Future Continuous (Progressive)", "Future Continuous", "Thì tương lai tiếp diễn", "tenses", 11),
  t(12, "future-perfect", "Future Perfect", "Future Perfect", "Thì tương lai hoàn thành", "tenses", 12),
  t(13, "future-perfect-continuous", "Future Perfect Continuous (Progressive)", "Future Perfect Continuous", "Thì tương lai hoàn thành tiếp diễn", "tenses", 13),
  t(14, "other-tenses", "Other Tenses", "Other Tenses", "Các thì khác", "tenses", 14),
  t(15, "comparison-of-tenses", "Comparison of Tenses", "Comparison of Tenses", "So sánh các thì", "tenses", 15),
  // ── word-classes ────────────────────────────────────────────────────
  t(16, "nouns", "Nouns", "Nouns", "Danh từ", "word-classes", 1),
  t(17, "articles", "Articles", "Articles", "Mạo từ", "word-classes", 2),
  t(18, "pronouns", "Pronouns", "Pronouns", "Đại từ", "word-classes", 3),
  t(19, "adjectives", "Adjective", "Adjectives", "Tính từ", "word-classes", 4),
  t(20, "adverbs", "Adverb", "Adverbs", "Trạng từ", "word-classes", 5),
  t(21, "quantifiers", "Quantifiers", "Quantifiers", "Từ chỉ lượng", "word-classes", 6),
  t(22, "prepositions", "Prepositions", "Prepositions", "Giới từ", "word-classes", 7),
  t(23, "verbs", "Verbs", "Verbs", "Động từ", "word-classes", 8),
  t(24, "modals", "Modals and Modal Auxiliaries", "Modal Verbs", "Động từ khuyết thiếu", "word-classes", 9),
  t(25, "phrasal-verbs", "Phrasal verbs", "Phrasal Verbs", "Cụm động từ", "word-classes", 10),
  t(26, "gerund-infinitive", "Gerund and Infinitive", "Gerund & Infinitive", "Danh động từ & động từ nguyên thể", "word-classes", 11),
  t(27, "participles", "Participles", "Participles", "Phân từ", "word-classes", 12),
  // ── sentence ────────────────────────────────────────────────────────
  t(28, "sentences", "Sentences", "Sentences", "Câu", "sentence", 1),
  t(29, "questions", "Questions", "Questions", "Câu hỏi", "sentence", 2),
  t(30, "conditional-sentences", "Conditional sentences", "Conditional Sentences", "Câu điều kiện", "sentence", 3),
  t(31, "passive-voice", "Passive Voice", "Passive Voice", "Câu bị động", "sentence", 4),
  t(32, "reported-speech", "Reported Speech", "Reported Speech", "Câu tường thuật", "sentence", 5),
  // ── other ───────────────────────────────────────────────────────────
  t(33, "other-grammar", "Other Grammar", "Other Grammar", "Ngữ pháp khác", "other", 1),
];

export const TOPIC_BY_SOURCE_EN: Map<string, TopicDef> = new Map(
  GRAMMAR_TOPICS.map((d) => [d.sourceTopicEn, d])
);

// common_mistakes.csv only carries a numeric category code. Names were
// authored by reading each group's titles (import-time curation, spec §4.1).
export type MistakeCategoryDef = { code: number; slug: string; nameEn: string; nameVi: string };

const c = (code: number, slug: string, nameEn: string, nameVi: string): MistakeCategoryDef =>
  ({ code, slug, nameEn, nameVi });

export const MISTAKE_CATEGORIES: MistakeCategoryDef[] = [
  c(1, "adj-verb-preposition", "Adjective/verb + preposition", "Giới từ sau tính từ/động từ"),
  c(2, "preposition-gerund", "Preposition + gerund", "Giới từ + danh động từ"),
  c(3, "auxiliary-infinitive", "Auxiliaries & infinitive forms", "Trợ động từ & dạng nguyên thể"),
  c(4, "pronouns-possessives", "Pronouns & possessives", "Đại từ & sở hữu"),
  c(5, "word-choice-verbs", "Everyday verb & phrase choice", "Chọn từ: động từ & cụm thông dụng"),
  c(6, "verb-object-patterns", "Verb patterns with objects", "Mẫu động từ với tân ngữ"),
  c(7, "agreement-verb-forms", "Agreement & verb forms", "Hòa hợp & dạng động từ"),
  c(8, "transitive-verbs", "Verbs taking a direct object", "Động từ đi thẳng với tân ngữ"),
  c(9, "articles-nouns", "Articles with nouns", "Mạo từ với danh từ"),
  c(10, "bare-infinitive", "Bare infinitive constructions", "Nguyên thể không 'to'"),
  c(11, "redundant-words", "Redundant words & double subjects", "Từ thừa & lặp chủ ngữ"),
  c(12, "adverbial-order", "Word order of adverbials", "Trật tự trạng ngữ"),
  c(13, "sentence-inversion", "Sentence structure & inversion", "Cấu trúc câu & đảo ngữ"),
  c(14, "preposition-pairs", "Preposition pairs (to/at, in/into…)", "Cặp giới từ dễ nhầm"),
  c(15, "modal-pairs", "Modal pairs (shall/will, can/may…)", "Cặp động từ khuyết thiếu dễ nhầm"),
  c(16, "degree-word-pairs", "Degree & time word pairs (very/too…)", "Cặp từ mức độ & thời gian"),
  c(17, "quantifier-pairs", "Quantifier pairs (many/much…)", "Cặp từ chỉ lượng dễ nhầm"),
  c(18, "noun-pairs", "Noun pairs (home/house…)", "Cặp danh từ dễ nhầm"),
  c(19, "uncountable-nouns", "Uncountable nouns", "Danh từ không đếm được"),
  c(20, "invariable-plurals", "Invariable plurals", "Số nhiều bất biến"),
  c(21, "tricky-agreement-nouns", "Nouns with tricky agreement", "Danh từ hòa hợp đặc biệt"),
  c(22, "adj-adverb-pairs", "Adjective/adverb pairs (bad/badly…)", "Cặp tính từ/trạng từ dễ nhầm"),
];

export const MISTAKE_CATEGORY_BY_CODE: Map<number, MistakeCategoryDef> = new Map(
  MISTAKE_CATEGORIES.map((d) => [d.code, d])
);

// Import must land exactly these totals (spec success criteria) or exit non-zero.
export const EXPECTED_COUNTS = {
  topics: 33,
  lessons: 292,
  testQuestions: 9380,
  practiceQuestions: 10000,
  confusedPairs: 832,
  commonMistakes: 687,
} as const;
```

- [ ] **Step 4: Chạy test, xác nhận pass**

Run: `npx vitest run src/lib/grammar/catalog.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/grammar/catalog.ts src/lib/grammar/catalog.test.ts
git commit -m "feat(grammar): catalog 33 chủ đề/4 cụm + tên 22 nhóm lỗi + số kỳ vọng"
```

---

### Task 6: Script import (`prisma/import-grammar.ts`) + copy ảnh + report

> Amendment (fix round 1): lessons.csv có 2 cặp (topic, lesson_order) trùng → order đánh theo tuần tự trong topic; import thêm --only <table> và verify dbCounts vs EXPECTED_COUNTS.
> Amendment (fix round 2–3): thêm --refresh-vi (chỉ update path, đồng bộ lại titleVi/contentViHtml từ CSV — an toàn trước khi grammar-translate-import chạy lần nào); phát hiện nguyên nhân thứ 3 — topic "Simple Future (will-future)" có lesson_order thiếu số 5 (gap, không trùng), khiến hàng cũ ở key 8 bị bỏ rơi (id=268, trùng nội dung với id=267) sau khi đánh lại order tuần tự; user đã tự tay xóa hàng id=268 (scoped delete, đã xác minh trùng lặp) để đưa lessons về đúng 292.

**Files:**
- Create: `prisma/import-grammar.ts`
- Create (script sinh ra, phải commit): `public/grammar/images/` (30 PNG)
- Modify: `package.json` (thêm npm script)

**Interfaces:**
- Consumes: Task 1 (delegates prisma), Task 2 (`parseCsvRecords`, `normalizeChoices`, `viOrNull`), Task 3 (`parseEntriesEn`, `parseEntriesVi`), Task 4 (`cleanLessonHtml`), Task 5 (`GRAMMAR_TOPICS`, `TOPIC_BY_SOURCE_EN`, `MISTAKE_CATEGORY_BY_CODE`, `EXPECTED_COUNTS`)
- Produces: DB đầy nội dung; `public/grammar/images/*`; `<src>/import-report.json`. Không unit test (chạm prisma — theo hợp đồng test của repo); toàn bộ logic rủi ro đã test ở Task 2–5, script này chỉ wiring.

- [ ] **Step 1: Viết `prisma/import-grammar.ts`**

```ts
// Import EnglishGrammar_extracted/csv/* into the Grammar* tables.
// Idempotent: content rows are upserted by their source id (lessons by
// topicId+order). On update only EN fields are refreshed — *Vi columns are
// NEVER touched, so translations applied later by grammar-translate-import
// survive a re-run (CSV VI is only written at create).
// A broken row never kills the run: it is skipped and listed in the report.
//
// Usage: npm run grammar:import -- [--dry-run] [--src <dir>]
import "./load-env";
import { PrismaClient } from "@prisma/client";
import fs from "node:fs";
import path from "node:path";
import { parseCsvRecords, normalizeChoices, viOrNull } from "../src/lib/grammar/clean";
import { parseEntriesEn, parseEntriesVi } from "../src/lib/grammar/confused-json";
import { cleanLessonHtml } from "../src/lib/grammar/lesson-html";
import {
  EXPECTED_COUNTS, GRAMMAR_TOPICS, MISTAKE_CATEGORY_BY_CODE, TOPIC_BY_SOURCE_EN,
} from "../src/lib/grammar/catalog";

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes("--dry-run");
const srcIdx = process.argv.indexOf("--src");
const SRC = srcIdx !== -1 && process.argv[srcIdx + 1] ? process.argv[srcIdx + 1] : "EnglishGrammar_extracted";
const PUBLIC_IMAGES = path.join("public", "grammar", "images");

type Skip = { table: string; id: string; reason: string };
const report = {
  imported: {} as Record<string, number>,
  skipped: [] as Skip[],
  viNull: {} as Record<string, number>,
  missingImages: new Set<string>(),
  imagesCopied: 0,
};

function readCsv(name: string): Record<string, string>[] {
  return parseCsvRecords(fs.readFileSync(path.join(SRC, "csv", name), "utf8"));
}

// Run prepared upsert thunks in transaction chunks — one-shot import, plain
// sequential chunks of 200 keep memory and connection use flat.
async function runBatched(ops: Array<() => ReturnType<typeof prisma.grammarTopic.upsert>>): Promise<void> {
  for (let i = 0; i < ops.length; i += 200) {
    await prisma.$transaction(ops.slice(i, i + 200).map((f) => f() as never));
  }
}

function copyImages(): Set<string> {
  const srcDir = path.join(SRC, "images");
  const files = fs.readdirSync(srcDir);
  if (!DRY_RUN) fs.mkdirSync(PUBLIC_IMAGES, { recursive: true });
  for (const f of files) {
    if (!DRY_RUN) fs.copyFileSync(path.join(srcDir, f), path.join(PUBLIC_IMAGES, f));
    report.imagesCopied++;
  }
  return new Set(files);
}

async function importTopics(): Promise<void> {
  const ops = GRAMMAR_TOPICS.map((d) => () =>
    prisma.grammarTopic.upsert({
      where: { id: d.id },
      update: { slug: d.slug, nameEn: d.nameEn, nameVi: d.nameVi, cluster: d.cluster, order: d.order },
      create: { id: d.id, slug: d.slug, nameEn: d.nameEn, nameVi: d.nameVi, cluster: d.cluster, order: d.order },
    })
  );
  if (!DRY_RUN) await runBatched(ops);
  report.imported.topics = ops.length;
}

async function importLessons(availableImages: Set<string>): Promise<void> {
  const rows = readCsv("lessons.csv");
  const ops: Array<() => never> = [];
  for (const r of rows) {
    const topic = TOPIC_BY_SOURCE_EN.get(r.topic_en);
    if (!topic) { report.skipped.push({ table: "lessons", id: `${r.topic_en}/${r.lesson_order}`, reason: "unknown topic_en" }); continue; }
    const order = Number.parseInt(r.lesson_order, 10);
    if (!Number.isInteger(order)) { report.skipped.push({ table: "lessons", id: `${r.topic_en}/${r.lesson_order}`, reason: "bad lesson_order" }); continue; }
    const en = cleanLessonHtml(r.content_en_html, availableImages);
    en.missingImages.forEach((m) => report.missingImages.add(m));
    let contentViHtml: string | null = null;
    if (viOrNull(r.content_vi_html, r.content_en_html)) {
      const vi = cleanLessonHtml(r.content_vi_html, availableImages);
      vi.missingImages.forEach((m) => report.missingImages.add(m));
      contentViHtml = vi.html.trim() || null;
    }
    const data = {
      titleEn: r.lesson_name_en.trim(),
      titleVi: viOrNull(r.lesson_name_vi, r.lesson_name_en),
      contentEnHtml: en.html,
      contentViHtml,
    };
    ops.push((() =>
      prisma.grammarLesson.upsert({
        where: { topicId_order: { topicId: topic.id, order } },
        update: { titleEn: data.titleEn, contentEnHtml: data.contentEnHtml }, // EN only — see header
        create: { topicId: topic.id, order, ...data },
      })) as never);
  }
  if (!DRY_RUN) await runBatched(ops as never);
  report.imported.lessons = ops.length;
}

async function importTestQuestions(): Promise<void> {
  const rows = readCsv("tests.csv");
  const ops: Array<() => never> = [];
  for (const r of rows) {
    const topic = TOPIC_BY_SOURCE_EN.get(r.topic_en);
    if (!topic) { report.skipped.push({ table: "testQuestions", id: r.id, reason: "unknown topic_en" }); continue; }
    const norm = normalizeChoices([r.a_en, r.b_en, r.c_en, r.d_en], r.answer_index);
    if (!norm) { report.skipped.push({ table: "testQuestions", id: r.id, reason: "bad choices/answer_index" }); continue; }
    const data = {
      topicId: topic.id,
      questionEn: r.question_en.trim(),
      questionVi: viOrNull(r.question_vi, r.question_en),
      choicesEn: norm.choices,
      answerIndex: norm.answerIndex,
    };
    ops.push((() =>
      prisma.grammarTestQuestion.upsert({
        where: { id: Number(r.id) },
        update: { topicId: data.topicId, questionEn: data.questionEn, choicesEn: data.choicesEn, answerIndex: data.answerIndex },
        create: { id: Number(r.id), ...data },
      })) as never);
  }
  if (!DRY_RUN) await runBatched(ops as never);
  report.imported.testQuestions = ops.length;
}

async function importPracticeQuestions(): Promise<void> {
  const rows = readCsv("grammar_questions.csv");
  const ops: Array<() => never> = [];
  for (const r of rows) {
    const norm = normalizeChoices(r.choices_en.split("##"), r.answer_index);
    if (!norm) { report.skipped.push({ table: "practiceQuestions", id: r.id, reason: "bad choices/answer_index" }); continue; }
    const level = Number.parseInt(r.level, 10);
    if (level !== 1 && level !== 2) { report.skipped.push({ table: "practiceQuestions", id: r.id, reason: `bad level ${r.level}` }); continue; }
    const data = {
      level,
      categoryEn: r.category_en.trim(),
      categoryVi: viOrNull(r.category_vi, r.category_en),
      questionEn: r.question_en.trim(),
      questionVi: viOrNull(r.question_vi, r.question_en),
      choicesEn: norm.choices,
      answerIndex: norm.answerIndex,
      explanationEn: r.explanation_en.trim() || null,
      explanationVi: viOrNull(r.explanation_vi, r.explanation_en),
    };
    ops.push((() =>
      prisma.grammarPracticeQuestion.upsert({
        where: { id: Number(r.id) },
        update: {
          level: data.level, categoryEn: data.categoryEn, questionEn: data.questionEn,
          choicesEn: data.choicesEn, answerIndex: data.answerIndex, explanationEn: data.explanationEn,
        },
        create: { id: Number(r.id), ...data },
      })) as never);
  }
  if (!DRY_RUN) await runBatched(ops as never);
  report.imported.practiceQuestions = ops.length;
}

async function importConfusedPairs(): Promise<void> {
  const rows = readCsv("confused_words.csv");
  const ops: Array<() => never> = [];
  for (const r of rows) {
    let entriesEn;
    try {
      entriesEn = parseEntriesEn(r.body_en);
    } catch (e) {
      report.skipped.push({ table: "confusedPairs", id: r.id, reason: `body_en: ${(e as Error).message}` });
      continue;
    }
    const entriesVi = parseEntriesVi(r.body_vi);
    const data = {
      titleEn: r.title_en.trim(),
      titleVi: viOrNull(r.title_vi, r.title_en),
      entriesEn: entriesEn as never,
      entriesVi: (entriesVi ?? undefined) as never, // undefined → Prisma leaves NULL
    };
    ops.push((() =>
      prisma.grammarConfusedPair.upsert({
        where: { id: Number(r.id) },
        update: { titleEn: data.titleEn, entriesEn: data.entriesEn },
        create: { id: Number(r.id), ...data },
      })) as never);
  }
  if (!DRY_RUN) await runBatched(ops as never);
  report.imported.confusedPairs = ops.length;
}

async function importCommonMistakes(): Promise<void> {
  const rows = readCsv("common_mistakes.csv");
  const ops: Array<() => never> = [];
  for (const r of rows) {
    const cat = MISTAKE_CATEGORY_BY_CODE.get(Number.parseInt(r.category, 10));
    if (!cat) { report.skipped.push({ table: "commonMistakes", id: r.id, reason: `unknown category ${r.category}` }); continue; }
    const data = {
      category: cat.slug,
      titleEn: r.title_en.trim(),
      titleVi: viOrNull(r.title_vi, r.title_en),
      bodyEn: r.body_en.trim(),
      bodyVi: viOrNull(r.body_vi, r.body_en),
      noteEn: r.note_en.trim() || null,
      noteVi: viOrNull(r.note_vi, r.note_en),
    };
    ops.push((() =>
      prisma.grammarCommonMistake.upsert({
        where: { id: Number(r.id) },
        update: { category: data.category, titleEn: data.titleEn, bodyEn: data.bodyEn, noteEn: data.noteEn },
        create: { id: Number(r.id), ...data },
      })) as never);
  }
  if (!DRY_RUN) await runBatched(ops as never);
  report.imported.commonMistakes = ops.length;
}

async function countViNulls(): Promise<void> {
  if (DRY_RUN) return;
  report.viNull = {
    "GrammarLesson.titleVi": await prisma.grammarLesson.count({ where: { titleVi: null } }),
    "GrammarLesson.contentViHtml": await prisma.grammarLesson.count({ where: { contentViHtml: null } }),
    "GrammarTestQuestion.questionVi": await prisma.grammarTestQuestion.count({ where: { questionVi: null } }),
    "GrammarPracticeQuestion.questionVi": await prisma.grammarPracticeQuestion.count({ where: { questionVi: null } }),
    "GrammarPracticeQuestion.explanationVi": await prisma.grammarPracticeQuestion.count({ where: { explanationVi: null } }),
    "GrammarConfusedPair.titleVi": await prisma.grammarConfusedPair.count({ where: { titleVi: null } }),
    "GrammarConfusedPair.entriesVi": await prisma.grammarConfusedPair.count({ where: { entriesVi: { equals: null as never } } }),
    "GrammarCommonMistake.bodyVi": await prisma.grammarCommonMistake.count({ where: { bodyVi: null } }),
  };
}

async function main(): Promise<void> {
  const availableImages = copyImages();
  await importTopics();
  await importLessons(availableImages);
  await importTestQuestions();
  await importPracticeQuestions();
  await importConfusedPairs();
  await importCommonMistakes();
  await countViNulls();

  const out = { ...report, missingImages: [...report.missingImages] };
  fs.writeFileSync(path.join(SRC, "import-report.json"), JSON.stringify(out, null, 2));
  console.log(`${DRY_RUN ? "[dry-run] " : ""}imported:`, report.imported);
  console.log("skipped:", report.skipped.length, "| missing images:", out.missingImages);
  console.log("vi=NULL:", report.viNull);

  const mismatches = Object.entries(EXPECTED_COUNTS).filter(([k, v]) => report.imported[k] !== v);
  if (mismatches.length > 0) {
    console.error("COUNT MISMATCH vs spec:", mismatches, "— see skipped[] in import-report.json");
    process.exitCode = 1;
  }
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
```

- [ ] **Step 2: Thêm npm script**

Trong `package.json`, sau dòng `"images:fetch-wikimedia": …`:

```json
    "grammar:import": "tsx prisma/import-grammar.ts",
```

- [ ] **Step 3: Dry-run**

Run: `npm run grammar:import -- --dry-run`
Expected: `imported: { topics: 33, lessons: 292, testQuestions: 9380, practiceQuestions: 10000, confusedPairs: 832, commonMistakes: 687 }`, `skipped: 0`, missing images đúng 3 file `["ae.svg", "be.svg", "passiv_blank.png"]` (thứ tự tùy run), exit 0. Nếu có skip: đọc `EnglishGrammar_extracted/import-report.json`, sửa cleaner tương ứng (Task 2–4) theo TDD rồi chạy lại — KHÔNG nới `EXPECTED_COUNTS`.

- [ ] **Step 4: Chạy import thật + kiểm DB**

Run: `npm run grammar:import`
Expected: như dry-run, exit 0.
Run tiếp: `npx tsx -e "import './prisma/load-env'; import { PrismaClient } from '@prisma/client'; const p = new PrismaClient(); p.grammarLesson.findFirst({ where: { contentEnHtml: { contains: '/grammar/images/' } }, select: { titleEn: true } }).then(r => { console.log(r); return p.\$disconnect(); });"`
Expected: in ra một lesson (ảnh đã rewrite vào DB).

- [ ] **Step 5: Chạy lại import lần 2 (kiểm idempotent)**

Run: `npm run grammar:import`
Expected: cùng số liệu, exit 0, không lỗi unique-constraint.

- [ ] **Step 6: Commit (kèm ảnh public)**

```bash
git add prisma/import-grammar.ts package.json public/grammar/images
git commit -m "feat(grammar): pipeline import CSV song ngữ + copy ảnh + report"
```

---

### Task 7: Vòng dịch — `translate-format.ts` + export/import scripts

**Files:**
- Create: `src/lib/grammar/translate-format.ts`
- Test: `src/lib/grammar/translate-format.test.ts`
- Create: `prisma/grammar-translate-export.ts`
- Create: `prisma/grammar-translate-import.ts`
- Modify: `package.json` (2 npm scripts)

**Interfaces:**
- Consumes: Task 1 (delegates), Task 6 (DB đã có dữ liệu để smoke)
- Produces: `type TranslateRow = { table: string; id: number; field: string; textEn: string; textVi: string | null }` · `TRANSLATABLE: Record<string, Record<string, string>>` (bảng → field VI → field EN nguồn) · `validateTranslatedRow(row: unknown): { ok: true; row: { table: string; id: number; field: string; textVi: string } } | { ok: false; reason: string }` · file `grammar-translate-todo.json` cho người dùng chạy dịch ngoài band.

- [ ] **Step 1: Viết test fail**

```ts
// src/lib/grammar/translate-format.test.ts
import { describe, expect, it } from "vitest";
import { TRANSLATABLE, validateTranslatedRow } from "./translate-format";

describe("TRANSLATABLE", () => {
  it("covers exactly the nullable *Vi columns of the 6 content tables", () => {
    expect(Object.keys(TRANSLATABLE).sort()).toEqual([
      "GrammarCommonMistake", "GrammarConfusedPair", "GrammarLesson",
      "GrammarPracticeQuestion", "GrammarTestQuestion", "GrammarTopic",
    ]);
    // choices/answer VI are an intentional product decision (EN-only), not a gap:
    expect(TRANSLATABLE.GrammarTestQuestion).toEqual({ questionVi: "questionEn" });
  });
});

describe("validateTranslatedRow", () => {
  const good = { table: "GrammarLesson", id: 5, field: "titleVi", textEn: "x", textVi: "Tiêu đề" };
  it("accepts a filled row", () => {
    expect(validateTranslatedRow(good)).toEqual({
      ok: true,
      row: { table: "GrammarLesson", id: 5, field: "titleVi", textVi: "Tiêu đề" },
    });
  });
  it("rejects unknown table/field, bad id, empty textVi", () => {
    expect(validateTranslatedRow({ ...good, table: "User" }).ok).toBe(false);
    expect(validateTranslatedRow({ ...good, field: "titleEn" }).ok).toBe(false);
    expect(validateTranslatedRow({ ...good, id: "5" }).ok).toBe(false);
    expect(validateTranslatedRow({ ...good, textVi: "  " }).ok).toBe(false);
    expect(validateTranslatedRow(null).ok).toBe(false);
  });
  it("requires entriesVi to be valid [{w,m}] JSON", () => {
    const row = { table: "GrammarConfusedPair", id: 1, field: "entriesVi", textEn: "", textVi: "" };
    expect(validateTranslatedRow({ ...row, textVi: "not json" }).ok).toBe(false);
    expect(validateTranslatedRow({ ...row, textVi: '[{"w":1,"m":"x"}]' }).ok).toBe(false);
    expect(
      validateTranslatedRow({ ...row, textVi: '[{"w":"Một vài","m":"nghĩa","examples":["ví dụ"]}]' }).ok
    ).toBe(true);
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `npx vitest run src/lib/grammar/translate-format.test.ts`
Expected: FAIL — module chưa tồn tại.

- [ ] **Step 3: Viết `src/lib/grammar/translate-format.ts`**

```ts
// The translation round-trip contract (spec §4.2). Export dumps every NULL
// *Vi field as a TranslateRow; the user fills textVi out-of-band; import
// validates against this whitelist and UPDATEs. Schema never changes.
export type TranslateRow = {
  table: string;
  id: number;
  field: string;
  textEn: string;
  textVi: string | null;
};

// table → { viField → the EN field its source text comes from }.
// GrammarTestQuestion/GrammarPracticeQuestion choices & answers are EN-only by
// design (product decision, spec §3.1) — deliberately absent here.
export const TRANSLATABLE: Record<string, Record<string, string>> = {
  GrammarTopic: { nameVi: "nameEn" },
  GrammarLesson: { titleVi: "titleEn", contentViHtml: "contentEnHtml" },
  GrammarTestQuestion: { questionVi: "questionEn" },
  GrammarPracticeQuestion: { categoryVi: "categoryEn", questionVi: "questionEn", explanationVi: "explanationEn" },
  GrammarConfusedPair: { titleVi: "titleEn", entriesVi: "entriesEn" },
  GrammarCommonMistake: { titleVi: "titleEn", bodyVi: "bodyEn", noteVi: "noteEn" },
};

type Valid = { ok: true; row: { table: string; id: number; field: string; textVi: string } };
type Invalid = { ok: false; reason: string };

export function validateTranslatedRow(row: unknown): Valid | Invalid {
  if (typeof row !== "object" || row === null) return { ok: false, reason: "not an object" };
  const { table, id, field, textVi } = row as Partial<TranslateRow>;
  if (typeof table !== "string" || !(table in TRANSLATABLE)) return { ok: false, reason: `unknown table "${String(table)}"` };
  if (typeof field !== "string" || !(field in TRANSLATABLE[table])) return { ok: false, reason: `"${String(field)}" is not translatable on ${table}` };
  if (typeof id !== "number" || !Number.isInteger(id)) return { ok: false, reason: "id must be an integer" };
  if (typeof textVi !== "string" || !textVi.trim()) return { ok: false, reason: "textVi is empty" };
  if (field === "entriesVi") {
    try {
      const parsed = JSON.parse(textVi) as unknown;
      const bad = !Array.isArray(parsed) || parsed.length === 0 ||
        parsed.some((e) => typeof (e as { w?: unknown }).w !== "string" || typeof (e as { m?: unknown }).m !== "string");
      if (bad) return { ok: false, reason: "entriesVi must be a non-empty [{w,m,examples?}] array" };
    } catch {
      return { ok: false, reason: "entriesVi is not valid JSON" };
    }
  }
  return { ok: true, row: { table, id, field, textVi } };
}
```

- [ ] **Step 4: Chạy test, xác nhận pass**

Run: `npx vitest run src/lib/grammar/translate-format.test.ts`
Expected: PASS.

- [ ] **Step 5: Viết `prisma/grammar-translate-export.ts`**

```ts
// Dump every NULL *Vi field as TranslateRow[] for out-of-band translation.
// Usage: npm run grammar:translate-export -- [--table GrammarLesson] [--out <file>]
import "./load-env";
import { PrismaClient } from "@prisma/client";
import fs from "node:fs";
import { TRANSLATABLE, type TranslateRow } from "../src/lib/grammar/translate-format";

const prisma = new PrismaClient();
const argOf = (flag: string): string | null => {
  const i = process.argv.indexOf(flag);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : null;
};
const ONLY_TABLE = argOf("--table");
const OUT = argOf("--out") ?? "grammar-translate-todo.json";

// One explicit delegate per table — keeps this file honest when models change.
const DELEGATES = {
  GrammarTopic: prisma.grammarTopic,
  GrammarLesson: prisma.grammarLesson,
  GrammarTestQuestion: prisma.grammarTestQuestion,
  GrammarPracticeQuestion: prisma.grammarPracticeQuestion,
  GrammarConfusedPair: prisma.grammarConfusedPair,
  GrammarCommonMistake: prisma.grammarCommonMistake,
} as const;

async function main(): Promise<void> {
  const rows: TranslateRow[] = [];
  for (const [table, fields] of Object.entries(TRANSLATABLE)) {
    if (ONLY_TABLE && table !== ONLY_TABLE) continue;
    const delegate = DELEGATES[table as keyof typeof DELEGATES] as {
      findMany: (q: unknown) => Promise<Array<Record<string, unknown>>>;
    };
    for (const [viField, enField] of Object.entries(fields)) {
      // Json null needs the { equals: null } form; scalar null is plain null.
      const where = viField === "entriesVi" ? { [viField]: { equals: null } } : { [viField]: null };
      const found = await delegate.findMany({ where, select: { id: true, [enField]: true }, orderBy: { id: "asc" } });
      for (const r of found) {
        const en = r[enField];
        rows.push({
          table, id: r.id as number, field: viField,
          textEn: typeof en === "string" ? en : JSON.stringify(en ?? ""),
          textVi: null,
        });
      }
    }
  }
  fs.writeFileSync(OUT, JSON.stringify(rows, null, 2));
  const byTable = rows.reduce<Record<string, number>>((acc, r) => ((acc[r.table] = (acc[r.table] ?? 0) + 1), acc), {});
  console.log(`wrote ${rows.length} rows to ${OUT}`, byTable);
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
```

- [ ] **Step 6: Viết `prisma/grammar-translate-import.ts`**

```ts
// Apply a filled grammar-translate-todo.json back into the DB.
// Rows failing validation are rejected (listed with reasons), the rest UPDATE.
// Safe to run many times / with partial files.
// Usage: npm run grammar:translate-import -- <file>
import "./load-env";
import { PrismaClient } from "@prisma/client";
import fs from "node:fs";
import { validateTranslatedRow } from "../src/lib/grammar/translate-format";

const prisma = new PrismaClient();
const FILE = process.argv[2];

const DELEGATES = {
  GrammarTopic: prisma.grammarTopic,
  GrammarLesson: prisma.grammarLesson,
  GrammarTestQuestion: prisma.grammarTestQuestion,
  GrammarPracticeQuestion: prisma.grammarPracticeQuestion,
  GrammarConfusedPair: prisma.grammarConfusedPair,
  GrammarCommonMistake: prisma.grammarCommonMistake,
} as const;

async function main(): Promise<void> {
  if (!FILE || !fs.existsSync(FILE)) {
    console.error("Usage: npm run grammar:translate-import -- <file.json>");
    process.exitCode = 1;
    return;
  }
  const parsed = JSON.parse(fs.readFileSync(FILE, "utf8")) as unknown[];
  const rejected: Array<{ index: number; reason: string }> = [];
  const updates: Array<() => Promise<unknown>> = [];
  parsed.forEach((raw, index) => {
    // Rows the user hasn't translated yet stay null — skip silently, not an error.
    if (typeof raw === "object" && raw !== null && (raw as { textVi?: unknown }).textVi === null) return;
    const v = validateTranslatedRow(raw);
    if (!v.ok) { rejected.push({ index, reason: v.reason }); return; }
    const { table, id, field, textVi } = v.row;
    const delegate = DELEGATES[table as keyof typeof DELEGATES] as {
      update: (q: unknown) => Promise<unknown>;
    };
    const value: unknown = field === "entriesVi" ? JSON.parse(textVi) : textVi;
    updates.push(() =>
      delegate.update({ where: { id }, data: { [field]: value } }).catch((e: Error) => {
        rejected.push({ index, reason: `update failed: ${e.message.split("\n").pop()}` });
      })
    );
  });
  for (let i = 0; i < updates.length; i += 100) {
    await Promise.all(updates.slice(i, i + 100).map((f) => f()));
  }
  console.log(`applied: ${updates.length - rejected.filter((r) => r.reason.startsWith("update failed")).length}, rejected: ${rejected.length}`);
  for (const r of rejected) console.error(`  [${r.index}] ${r.reason}`);
  if (rejected.length > 0) process.exitCode = 1;
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
```

- [ ] **Step 7: Thêm npm scripts**

Trong `package.json`, sau `"grammar:import"`:

```json
    "grammar:translate-export": "tsx prisma/grammar-translate-export.ts",
    "grammar:translate-import": "tsx prisma/grammar-translate-import.ts",
```

- [ ] **Step 8: Smoke round-trip trên DB thật**

```bash
npm run grammar:translate-export -- --table GrammarLesson --out /tmp/todo.json
# Expected: "wrote N rows" với N = số field VI NULL của GrammarLesson trong import-report.json
npx tsx -e "
import fs from 'node:fs';
const rows = JSON.parse(fs.readFileSync('/tmp/todo.json', 'utf8'));
const one = rows.find(r => r.field === 'titleVi');
fs.writeFileSync('/tmp/one.json', JSON.stringify([{ ...one, textVi: 'SMOKE TEST' }]));
console.log('target:', one.table, one.id);
"
npm run grammar:translate-import -- /tmp/one.json
# Expected: applied: 1, rejected: 0
npm run grammar:translate-export -- --table GrammarLesson --out /tmp/todo2.json
# Expected: số row titleVi giảm đúng 1 so với /tmp/todo.json
```

Rồi hoàn nguyên field smoke về NULL (giữ DB đúng trạng thái "chưa dịch") — thay `<ID>` bằng id đã in ở trên:

```bash
npx tsx -e "
import './prisma/load-env';
import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
p.grammarLesson.update({ where: { id: <ID> }, data: { titleVi: null } }).then(() => p.\$disconnect());
"
```

- [ ] **Step 9: Chạy toàn bộ test suite lần cuối**

Run: `npm test`
Expected: PASS toàn bộ (test cũ + 4 file test grammar mới).

- [ ] **Step 10: Commit**

```bash
git add src/lib/grammar/translate-format.ts src/lib/grammar/translate-format.test.ts \
  prisma/grammar-translate-export.ts prisma/grammar-translate-import.ts package.json
git commit -m "feat(grammar): vòng dịch translate-export/import khép kín (NULL = cần dịch)"
```

---

## Self-review đã chạy (kết quả)

- **Spec coverage (Plan 1 = spec §3 + §4):** schema §3.1/§3.2 → Task 1 (đủ 10 model + grammarCount + User relations); pipeline §4.1 → Task 2–6 (BOM, ##, 1-based, sanitize, ảnh, JSON vỡ, heuristic VI-rác, tên 22 nhóm, report, idempotent, exit-code); vòng dịch §4.2 → Task 7. Các phần §5–§9 của spec thuộc Plan 2–3 (đã ghi ở header).
- **Placeholder:** không còn TBD/TODO; điểm duy nhất executor phải tự xử là hành vi thật của `sanitize-html` (Task 4 Step 4 đã ghi rõ 2 bẫy và cách xử) và regex repair (Task 3 Step 4 ghi bất biến phải giữ).
- **Type consistency:** `normalizeChoices`/`viOrNull`/`parseEntriesEn`/`parseEntriesVi`/`cleanLessonHtml`/`TOPIC_BY_SOURCE_EN`/`MISTAKE_CATEGORY_BY_CODE`/`EXPECTED_COUNTS`/`TRANSLATABLE`/`validateTranslatedRow` — chữ ký ở Interfaces khớp code ở mọi task dùng chúng; khóa upsert `topicId_order` khớp `@@unique([topicId, order])` Task 1.
