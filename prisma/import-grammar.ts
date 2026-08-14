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
