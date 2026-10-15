// Tier-1 lesson translation runner: glossary + spacing (deterministic) plus a
// hand-translated round for the remaining prose/heading segments, gated so a
// partial or heading-skipping batch can never be applied - the failure mode of
// the 2026-08-16 round this replaces.
//
// No external translation API. The model-in-the-loop flow is file based:
//   1. --export <file>  writes every segment still needing Vietnamese, with
//      protected spans masked as {n} placeholders, and touches nothing else.
//   2. A translator fills <file>.vi.json ({ "<lessonId>": { "<blockId>": "<vi>" | "@keep" } }).
//   3. --import <file>.vi.json  splices the answers back, runs checkLessonVi and
//      checkLessonViProseVi, and writes only lessons that pass both.
// "@keep" marks a segment that is genuinely English study material; keeps are
// logged and feed the prose gate's allowlist.
//
// Usage:
//   npx tsx scripts/grammar/translate-lessons.ts --dry-run             # Tier-0 report only
//   npx tsx scripts/grammar/translate-lessons.ts                       # Tier-0 (glossary + spacing), writes DB
//   npx tsx scripts/grammar/translate-lessons.ts --export out.json [--only 245,246] [--limit 40]
//   npx tsx scripts/grammar/translate-lessons.ts --import out.vi.json [--dry-run] [--dump dir]
import "../../prisma/load-env";
import { PrismaClient } from "@prisma/client";
import { existsSync, mkdirSync, readFileSync, appendFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { SEMANTIC_SPAN_CLASSES } from "../../src/lib/grammar/semantic-classes";
import { translateHeadingGlossary } from "../../src/lib/grammar/heading-glossary";
import {
  assembleTranslated,
  blockIsTranslated,
  checkLessonViProseVi,
  isTranslatableSegment,
  toSegment,
  walkLesson,
  type SegBlock,
  type Segment,
} from "../../src/lib/grammar/lesson-translate";
import { VI_DIACRITIC, checkLessonVi, englishBlockIds, fixProtectedSpacing, repairLessonViHtml, scan } from "../../src/lib/grammar/vi-repair";

const prisma = new PrismaClient();
const PC: ReadonlySet<string> = new Set(SEMANTIC_SPAN_CLASSES);

const DRY = process.argv.includes("--dry-run") || process.argv.includes("--export");
const REDO = process.argv.includes("--redo");
const argOf = (flag: string): string | null => {
  const i = process.argv.indexOf(flag);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : null;
};
const ONLY = argOf("--only")?.split(",").map(Number).filter(Number.isInteger) ?? null;
const LIMIT = Number(argOf("--limit") ?? "0") || Infinity;
const EXPORT_FILE = argOf("--export");
const IMPORT_FILE = argOf("--import");
const DUMP_DIR = argOf("--dump"); // write each would-be lesson body here (works with --dry-run)
type Answers = Record<string, Record<string, string>>;
const answers: Answers = IMPORT_FILE ? (JSON.parse(readFileSync(resolve(IMPORT_FILE), "utf8")) as Answers) : {};
const exported: Record<string, { title: string; segments: Record<string, string> }> = {};

const STAMP = new Date().toISOString().slice(0, 10);
const RUN_DIR = resolve("data", "llm-runs");
const NDJSON = resolve(RUN_DIR, `lesson-segments-${STAMP}.ndjson`);
const KEEPS = resolve(RUN_DIR, `lesson-keeps-${STAMP}.json`);
const BACKUP = resolve("data", "backups", `grammar-lessons-vi-${STAMP}.json`);

type Row = { id: number; titleEn: string; contentEnHtml: string; contentViHtml: string | null };

const report = {
  lessons: 0, alreadyGood: 0, unaligned: 0, glossaryApplied: 0, translated: 0, exportedSegments: 0,
  keeps: 0, applied: 0, gateFailed: 0, noChange: 0,
};

// ── Per-lesson pipeline ────────────────────────────────────────────────────

type KeepMap = Record<string, string[]>; // lessonId → kept EN segment texts
const keepMap: KeepMap = existsSync(KEEPS) ? JSON.parse(readFileSync(KEEPS, "utf8")) : {};

function translatableSegments(enHtml: string): Array<{ block: SegBlock; segment: Segment }> {
  const en = scan(enHtml);
  const english = englishBlockIds(en);
  const walk = walkLesson(enHtml, PC);
  return [...walk.blocks.values()]
    .map((block) => ({ block, segment: toSegment(block) }))
    .filter(({ block, segment }) => isTranslatableSegment(block, english, segment));
}

async function processLesson(lesson: Row): Promise<void> {
  report.lessons++;
  const enHtml = lesson.contentEnHtml;
  const viHtml = lesson.contentViHtml ?? "";
  const enTags = scan(enHtml);
  const viTags = scan(viHtml);
  const aligned =
    viHtml !== "" &&
    enTags.tags.length === viTags.tags.length &&
    enTags.tags.every((t, i) => t === viTags.tags[i]);
  if (!aligned) report.unaligned++;
  // Restore protected zones from the English original before anything else, and
  // remember which prose blocks the machine round corrupted there: a block that
  // reads Vietnamese but lost or merged a protected node ("...với and:" with
  // "and" emptied) must be translated again, not skipped as "already good".
  const repaired = aligned ? repairLessonViHtml(enHtml, viHtml) : null;
  const base = repaired ? repaired.html : aligned ? viHtml : enHtml;
  const corrupt = new Set<number>();
  if (aligned) {
    for (let n = 0; n < enTags.nodes.length; n++) {
      if (enTags.nodes[n].protectedSpan && enTags.nodes[n].text !== viTags.nodes[n].text) corrupt.add(enTags.nodes[n].blockId);
    }
  }

  const candidates = translatableSegments(enHtml);
  const translations = new Map<number, string>();
  const allowedEnglish = new Set<string>(keepMap[String(lesson.id)] ?? []);
  const pending: Array<{ blockId: number; segment: Segment }> = [];

  for (const { block, segment } of candidates) {
    if (aligned && !corrupt.has(block.id) && blockIsTranslated(base, block.id, PC)) continue; // already Vietnamese
    const glossary = translateHeadingGlossary(segment.en);
    if (glossary !== null) {
      translations.set(block.id, glossary);
      report.glossaryApplied++;
      continue;
    }
    pending.push({ blockId: block.id, segment });
  }

  if (EXPORT_FILE && pending.length > 0) {
    exported[String(lesson.id)] = {
      title: lesson.titleEn,
      segments: Object.fromEntries(pending.map((p) => [String(p.blockId), p.segment.en])),
    };
    report.exportedSegments += pending.length;
    return;
  }
  const answer = answers[String(lesson.id)] ?? {};
  for (const p of pending) {
    const got = answer[String(p.blockId)];
    if (!got) continue; // stays base, the gate rejects if it mattered
    if (got === "@keep") {
      allowedEnglish.add(p.segment.en);
      keepMap[String(lesson.id)] = [...(keepMap[String(lesson.id)] ?? []), p.segment.en];
      translations.set(p.blockId, p.segment.en); // restore the English study material over any machine translation
      report.keeps++;
      continue;
    }
    if (!VI_DIACRITIC.test(got)) continue; // untranslated, the gate rejects the lesson
    translations.set(p.blockId, got);
    report.translated++;
  }

  let html = base;
  if (translations.size > 0) {
    const out = assembleTranslated(enHtml, base, translations, PC);
    if (!out) {
      console.log(`  #${lesson.id}: assembly failed (unaligned base)`);
      report.gateFailed++;
      return;
    }
    html = out.html;
  }
  const spaced = fixProtectedSpacing(enHtml, html);
  if (spaced) html = spaced.html;

  // Gates — both must pass before anything is written.
  const structural = checkLessonVi(enHtml, html);
  if (!structural.ok) {
    console.log(`  #${lesson.id}: structural gate — ${structural.reason}`);
    report.gateFailed++;
    return;
  }
  const prose = checkLessonViProseVi(enHtml, html, PC, allowedEnglish);
  if (!prose.ok) {
    console.log(`  #${lesson.id}: prose gate — ${prose.reason}`);
    report.gateFailed++;
    return;
  }

  if (DUMP_DIR) {
    mkdirSync(resolve(DUMP_DIR), { recursive: true });
    writeFileSync(resolve(DUMP_DIR, `${lesson.id}.after.html`), html, "utf-8");
    writeFileSync(resolve(DUMP_DIR, `${lesson.id}.before.html`), viHtml, "utf-8");
  }
  if (html === viHtml) {
    report.noChange++;
    return;
  }
  if (DRY) {
    report.applied++;
    return;
  }
  await prisma.grammarLesson.update({ where: { id: lesson.id }, data: { contentViHtml: html } });
  appendFileSync(NDJSON, `${JSON.stringify({ id: lesson.id, vi: html })}\n`);
  writeFileSync(KEEPS, JSON.stringify(keepMap, null, 2));
  report.applied++;
}

// ── Main ───────────────────────────────────────────────────────────────────

async function snapshot(rows: Row[]): Promise<void> {
  mkdirSync(resolve("data", "backups"), { recursive: true });
  if (existsSync(BACKUP)) return; // one snapshot per day-stamp is enough
  writeFileSync(BACKUP, JSON.stringify(rows.map((r) => ({ id: r.id, contentViHtml: r.contentViHtml }))));
  console.log(`snapshot → ${BACKUP}`);
}

const doneIds = new Set<number>();
async function loadResume(): Promise<void> {
  if (REDO || !existsSync(NDJSON)) return;
  for (const line of readFileSync(NDJSON, "utf8").split("\n")) {
    if (!line.trim()) continue;
    try {
      doneIds.add((JSON.parse(line) as { id: number }).id);
    } catch { /* truncated tail line — ignore */ }
  }
  console.log(`resume: ${doneIds.size} lesson(s) already processed`);
}

async function main(): Promise<void> {
  mkdirSync(RUN_DIR, { recursive: true });
  await loadResume();
  const rows = await prisma.grammarLesson.findMany({
    select: { id: true, titleEn: true, contentEnHtml: true, contentViHtml: true },
    orderBy: { id: "asc" },
  });
  const targets = rows.filter((r) => (!ONLY || ONLY.includes(r.id)) && !doneIds.has(r.id)).slice(0, LIMIT);
  if (!DRY && !EXPORT_FILE && targets.length > 0) await snapshot(rows);

  console.log(`lessons: ${targets.length}/${rows.length} (dry=${DRY}, export=${EXPORT_FILE ?? "-"}, import=${IMPORT_FILE ?? "-"})`);
  for (const row of targets) {
    try {
      await processLesson(row);
    } catch (e) {
      console.log(`  #${row.id}: ${(e as Error).message}`);
      report.gateFailed++;
    }
  }
  if (EXPORT_FILE) {
    writeFileSync(resolve(EXPORT_FILE), JSON.stringify(exported, null, 1), "utf-8");
    console.log(`exported ${Object.keys(exported).length} lesson(s) → ${EXPORT_FILE}`);
  }

  console.log("\n" + JSON.stringify(report, null, 2));
  if (!DRY && !EXPORT_FILE) console.log(`ndjson → ${NDJSON}\nkeeps  → ${KEEPS}`);
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
