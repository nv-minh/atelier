// Import EnglishGrammar_extracted/csv/* into the Grammar* tables.
// Idempotent: content rows are upserted by their source id (lessons by
// topicId+order). On update only EN fields are refreshed — *Vi columns are
// NEVER touched, so translations applied later by grammar-translate-import
// survive a re-run (CSV VI is only written at create) — with two carve-outs:
// topics' nameVi comes from the hand-written catalog (catalog.ts), not the
// CSV, and IS written on update (it can never be NULL, so the translate
// round-trip never targets it); and lessons under the explicit --refresh-vi
// flag (see below), which re-syncs titleVi/contentViHtml from the CSV too.
// A broken row never kills the run: it is skipped and listed in the report.
//
// Every *Vi value written here first goes through src/lib/grammar/vi-repair.ts:
// the source CSV was machine-translated wholesale, so conjugation tables,
// example sentences and question stems arrived in Vietnamese. The repair puts
// that English material back, and a re-import therefore cannot reintroduce it.
//
// Usage: npm run grammar:import -- [--dry-run] [--src <dir>] [--only <table>] [--refresh-vi]
import "./load-env";
import { Prisma, PrismaClient } from "@prisma/client";
import fs from "node:fs";
import path from "node:path";
import { parseCsvRecords, normalizeChoices, viOrNull } from "../src/lib/grammar/clean";
import { parseEntriesEn, parseEntriesVi } from "../src/lib/grammar/confused-json";
import { cleanLessonHtml } from "../src/lib/grammar/lesson-html";
import {
  isBlankStem, repairConfusedEntriesVi, repairExplanationVi, repairLessonViHtml, repairMistakeTitleVi,
} from "../src/lib/grammar/vi-repair";
import {
  EXPECTED_COUNTS, GRAMMAR_TOPICS, MISTAKE_CATEGORY_BY_CODE, TOPIC_BY_SOURCE_EN,
} from "../src/lib/grammar/catalog";

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes("--dry-run");
const srcIdx = process.argv.indexOf("--src");
const SRC = srcIdx !== -1 && process.argv[srcIdx + 1] ? process.argv[srcIdx + 1] : "EnglishGrammar_extracted";
const onlyIdx = process.argv.indexOf("--only");
const ONLY = onlyIdx !== -1 && process.argv[onlyIdx + 1] ? process.argv[onlyIdx + 1] : null;
if (ONLY && !(ONLY in EXPECTED_COUNTS)) {
  console.error(`Invalid --only value "${ONLY}". Valid tables: ${Object.keys(EXPECTED_COUNTS).join(", ")}`);
  process.exit(1);
}
// Lesson update normally never touches *Vi (see header) so translations survive
// a re-run. --refresh-vi is an explicit escape hatch to re-sync titleVi/
// contentViHtml from the source CSV on the update path too — safe ONLY before
// any grammar-translate-import has ever run (it would otherwise clobber
// applied translations).
const REFRESH_VI = process.argv.includes("--refresh-vi");
const PUBLIC_IMAGES = path.join("public", "grammar", "images");

type Skip = { table: string; id: string; reason: string };
const report = {
  imported: {} as Record<string, number>,
  skipped: [] as Skip[],
  viNull: {} as Record<string, number>,
  missingImages: new Set<string>(),
  imagesCopied: 0,
  dbCounts: {} as Record<string, number>,
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
  // lesson_order (the CSV's natural key alongside topic_en) has 2 duplicate
  // pairs in the source data ('Passive Voice'/5, 'Other Grammar'/9), which
  // silently collided into one DB row each via upsert. CSV rows are already
  // sorted by lesson_order within each topic, so order is instead assigned
  // as a 1-based sequence per topic, counted in CSV row order — deterministic
  // across re-runs (the CSV is static) and collision-free by construction.
  const nextOrder = new Map<number, number>(); // topicId → next order
  for (const r of rows) {
    const topic = TOPIC_BY_SOURCE_EN.get(r.topic_en);
    if (!topic) { report.skipped.push({ table: "lessons", id: `${r.topic_en}/${r.lesson_name_en}`, reason: "unknown topic_en" }); continue; }
    const order = nextOrder.get(topic.id) ?? 1;
    nextOrder.set(topic.id, order + 1);
    const en = cleanLessonHtml(r.content_en_html, availableImages);
    en.missingImages.forEach((m) => report.missingImages.add(m));
    let contentViHtml: string | null = null;
    if (viOrNull(r.content_vi_html, r.content_en_html)) {
      const vi = cleanLessonHtml(r.content_vi_html, availableImages);
      vi.missingImages.forEach((m) => report.missingImages.add(m));
      // The CSV translated the conjugation tables and example sentences too;
      // put that English material back before it ever reaches the DB (see
      // vi-repair.ts). Unalignable bodies fall back to English.
      contentViHtml = repairLessonViHtml(en.html, vi.html)?.html.trim() || null;
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
        update: REFRESH_VI
          ? { titleEn: data.titleEn, contentEnHtml: data.contentEnHtml, titleVi: data.titleVi, contentViHtml: data.contentViHtml }
          : { titleEn: data.titleEn, contentEnHtml: data.contentEnHtml }, // EN only by default — see header
        create: { topicId: topic.id, order, ...data },
      })) as never);
  }
  if (!DRY_RUN) await runBatched(ops as never);
  report.imported.lessons = ops.length;
}

// A stem with a blank IS the exercise, and only works in English: "The dog ___
// small." asks something, "Con chó ___ nhỏ." does not. NULL falls back to EN.
const stemVi = (vi: string, en: string): string | null => (isBlankStem(en) ? null : viOrNull(vi, en));

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
      questionVi: stemVi(r.question_vi, r.question_en),
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

// Explanations keep their Vietnamese prose but hand back the English specimens
// the machine translation ate: "Example: deer" had become "Ví dụ: hươu".
function explanationVi(vi: string, en: string): string | null {
  const kept = viOrNull(vi, en);
  if (!kept) return null;
  return repairExplanationVi(en, kept)?.text ?? kept;
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
      questionVi: stemVi(r.question_vi, r.question_en),
      choicesEn: norm.choices,
      answerIndex: norm.answerIndex,
      explanationEn: r.explanation_en.trim() || null,
      explanationVi: explanationVi(r.explanation_vi, r.explanation_en),
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
    // The headword and its examples are the pair being distinguished, so they
    // stay English ("bare, bear", not "trần, gấu") and only the gloss is
    // Vietnamese. The title is nothing but headwords → always fall back to EN.
    const entriesVi = repairConfusedEntriesVi(entriesEn, parseEntriesVi(r.body_vi));
    const data = {
      titleEn: r.title_en.trim(),
      titleVi: null,
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
      // "Absorbed ( = very much interested)" → keep the English headword in
      // front of the Vietnamese gloss instead of "Hấp thụ (= rất quan tâm)".
      titleVi: repairMistakeTitleVi(r.title_en.trim(), viOrNull(r.title_vi, r.title_en)),
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
    "GrammarPracticeQuestion.categoryVi": await prisma.grammarPracticeQuestion.count({ where: { categoryVi: null } }),
    "GrammarConfusedPair.titleVi": await prisma.grammarConfusedPair.count({ where: { titleVi: null } }),
    // Prisma.DbNull, not null: `{ equals: null }` matches neither of a Json
    // column's two nulls, so this counter used to report 0 unconditionally.
    "GrammarConfusedPair.entriesVi": await prisma.grammarConfusedPair.count({ where: { entriesVi: { equals: Prisma.DbNull } } }),
    "GrammarCommonMistake.bodyVi": await prisma.grammarCommonMistake.count({ where: { bodyVi: null } }),
    "GrammarCommonMistake.titleVi": await prisma.grammarCommonMistake.count({ where: { titleVi: null } }),
    "GrammarCommonMistake.noteVi": await prisma.grammarCommonMistake.count({ where: { noteVi: null } }),
  };
}

// Ground truth: distinct row counts per table, regardless of --only — this is
// what actually caught the lessons dedup bug that ops-counting (report.imported)
// missed (292 ops upserted onto only 290 distinct rows via 2 duplicate keys).
async function queryDbCounts(): Promise<Record<string, number>> {
  return {
    topics: await prisma.grammarTopic.count(),
    lessons: await prisma.grammarLesson.count(),
    testQuestions: await prisma.grammarTestQuestion.count(),
    practiceQuestions: await prisma.grammarPracticeQuestion.count(),
    confusedPairs: await prisma.grammarConfusedPair.count(),
    commonMistakes: await prisma.grammarCommonMistake.count(),
  };
}

async function main(): Promise<void> {
  const availableImages = copyImages();
  if (!ONLY || ONLY === "topics") await importTopics();
  if (!ONLY || ONLY === "lessons") await importLessons(availableImages);
  if (!ONLY || ONLY === "testQuestions") await importTestQuestions();
  if (!ONLY || ONLY === "practiceQuestions") await importPracticeQuestions();
  if (!ONLY || ONLY === "confusedPairs") await importConfusedPairs();
  if (!ONLY || ONLY === "commonMistakes") await importCommonMistakes();
  await countViNulls();
  if (!DRY_RUN) report.dbCounts = await queryDbCounts();

  const out = { ...report, missingImages: [...report.missingImages] };
  fs.writeFileSync(path.join(SRC, "import-report.json"), JSON.stringify(out, null, 2));
  console.log(`${DRY_RUN ? "[dry-run] " : ""}imported:`, report.imported);
  console.log("skipped:", report.skipped.length, "| missing images:", out.missingImages);
  console.log("vi=NULL:", report.viNull);
  console.log("dbCounts:", report.dbCounts);

  // Dry-run has no DB to query, so it falls back to ops-counting, where
  // report.imported genuinely only has keys for the table(s) --only ran —
  // narrowed there to avoid flagging untouched tables as "missing". A real
  // run always has dbCounts for all six tables regardless of --only (see
  // queryDbCounts above), so it is the ground-truth check for ALL six every
  // time — --only only controls which table gets re-imported, never which
  // tables get verified, so a real run can't silently miss a regression in
  // some other table just because this invocation didn't touch it.
  const counted = DRY_RUN ? report.imported : report.dbCounts;
  const expectedEntries = (DRY_RUN && ONLY)
    ? Object.entries(EXPECTED_COUNTS).filter(([k]) => k === ONLY)
    : Object.entries(EXPECTED_COUNTS);
  const mismatches = expectedEntries.filter(([k, v]) => counted[k] !== v);
  if (mismatches.length > 0) {
    console.error("COUNT MISMATCH vs spec:", mismatches, "— see skipped[] in import-report.json");
    process.exitCode = 1;
  }
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
