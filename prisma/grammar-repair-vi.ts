// One-off Tier-0 pass: undo the machine translation of English study material
// across every Grammar* table. Pure mechanics — no translator, no API key.
// See src/lib/grammar/vi-repair.ts for the rules and why each one is safe.
//
// Idempotent: every repair is a fixed point, so a second run reports zero
// changes. Rows that cannot be repaired safely get their *Vi column NULLed,
// which makes the app fall back to English and makes grammar-translate-export
// pick them up as "needs translation".
//
// Every write is preceded by a snapshot of exactly the columns it touches,
// under data/backups/, restorable with --restore. That is not belt-and-braces:
// db:backup covers 13 of the schema's 25 models and no Grammar* table at all,
// so a full backup gives this operation no cover whatsoever.
//
// Usage: npm run grammar:repair-vi -- [--dry-run] [--only <table>]
//        npm run grammar:repair-vi -- --restore data/backups/grammar-vi-<ts>.json
import "./load-env";
import { Prisma, PrismaClient } from "@prisma/client";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { ConfusedEntry } from "../src/lib/grammar/confused-json";
import {
  isBlankStem,
  repairConfusedEntriesVi,
  repairExplanationVi,
  repairLessonViHtml,
  repairMistakeTitleVi,
} from "../src/lib/grammar/vi-repair";

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes("--dry-run");
const argOf = (flag: string): string | null => {
  const i = process.argv.indexOf(flag);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : null;
};
const RESTORE = argOf("--restore");
const onlyIdx = process.argv.indexOf("--only");
const ONLY = onlyIdx !== -1 && process.argv[onlyIdx + 1] ? process.argv[onlyIdx + 1] : null;

const TABLES = ["lessons", "testQuestions", "practiceQuestions", "confusedPairs", "commonMistakes"] as const;
type Table = (typeof TABLES)[number];

if (ONLY && !TABLES.includes(ONLY as Table)) {
  console.error(`Invalid --only value "${ONLY}". Valid tables: ${TABLES.join(", ")}`);
  process.exit(1);
}
const wants = (t: Table): boolean => !ONLY || ONLY === t;

const report: Record<string, Record<string, number>> = {};
const note = (table: string, key: string, n = 1): void => {
  report[table] ??= {};
  report[table][key] = (report[table][key] ?? 0) + n;
};

// Prisma has no multi-row UPDATE with per-row values, so writes go out as
// batched transactions of individual updates — same shape import-grammar uses.
async function flush(ops: Array<() => Promise<unknown>>): Promise<void> {
  if (DRY_RUN) return;
  for (let i = 0; i < ops.length; i += 200) {
    await prisma.$transaction(ops.slice(i, i + 200).map((f) => f() as never));
  }
}

async function repairLessons(): Promise<void> {
  const rows = await prisma.grammarLesson.findMany({
    where: { contentViHtml: { not: null } },
    select: { id: true, contentEnHtml: true, contentViHtml: true },
  });
  const ops: Array<() => Promise<unknown>> = [];
  for (const row of rows) {
    const out = repairLessonViHtml(row.contentEnHtml, row.contentViHtml as string);
    if (!out) {
      // Tag streams differ — nothing can be spliced without landing text in the
      // wrong slot, so drop to English until the LLM pass retranslates it.
      note("lessons", "nulled");
      ops.push(() => prisma.grammarLesson.update({ where: { id: row.id }, data: { contentViHtml: null } }));
      continue;
    }
    if (out.restored === 0) {
      note("lessons", "alreadyClean");
      continue;
    }
    note("lessons", "repaired");
    note("lessons", "nodesRestored", out.restored);
    ops.push(() => prisma.grammarLesson.update({ where: { id: row.id }, data: { contentViHtml: out.html } }));
  }
  await flush(ops);
}

// The two question delegates are structurally identical for this job, but
// their union is not callable — narrow to the two methods actually used, the
// same shape grammar-translate-export takes.
type StemDelegate = {
  findMany(args: unknown): Promise<Array<{ id: number; questionEn: string }>>;
  updateMany(args: unknown): Promise<unknown>;
};

// Both question tables share the stem rule: a blank makes the sentence itself
// the exercise, so only the English version poses the question at all.
async function nullBlankStems(table: "testQuestions" | "practiceQuestions"): Promise<void> {
  const delegate = (
    table === "testQuestions" ? prisma.grammarTestQuestion : prisma.grammarPracticeQuestion
  ) as unknown as StemDelegate;
  const rows = await delegate.findMany({
    where: { questionVi: { not: null } },
    select: { id: true, questionEn: true },
  });
  const ids = rows.filter((r) => isBlankStem(r.questionEn)).map((r) => r.id);
  note(table, "stemsNulled", ids.length);
  note(table, "stemsKept", rows.length - ids.length);
  if (DRY_RUN) return;
  for (let i = 0; i < ids.length; i += 500) {
    await delegate.updateMany({ where: { id: { in: ids.slice(i, i + 500) } }, data: { questionVi: null } });
  }
}

async function repairExplanations(): Promise<void> {
  const rows = await prisma.grammarPracticeQuestion.findMany({
    where: { explanationVi: { not: null }, explanationEn: { not: null } },
    select: { id: true, explanationEn: true, explanationVi: true },
  });
  const ops: Array<() => Promise<unknown>> = [];
  for (const row of rows) {
    const out = repairExplanationVi(row.explanationEn as string, row.explanationVi as string);
    if (!out) {
      note("practiceQuestions", "explanationsUnalignable");
      continue;
    }
    if (out.restored === 0) continue;
    note("practiceQuestions", "explanationsRepaired");
    note("practiceQuestions", "explanationLines", out.restored);
    ops.push(() =>
      prisma.grammarPracticeQuestion.update({ where: { id: row.id }, data: { explanationVi: out.text } })
    );
  }
  await flush(ops);
}

// entriesEn/entriesVi are Json columns; Prisma hands them back as unknown.
function asEntries(value: unknown): ConfusedEntry[] | null {
  if (!Array.isArray(value)) return null;
  const ok = value.every(
    (e) => typeof e === "object" && e !== null && typeof (e as ConfusedEntry).w === "string"
  );
  return ok ? (value as ConfusedEntry[]) : null;
}

async function repairConfusedPairs(): Promise<void> {
  const rows = await prisma.grammarConfusedPair.findMany({
    select: { id: true, titleEn: true, titleVi: true, entriesEn: true, entriesVi: true },
  });
  const ops: Array<() => Promise<unknown>> = [];
  for (const row of rows) {
    const en = asEntries(row.entriesEn);
    if (!en) {
      note("confusedPairs", "entriesEnUnusable");
      continue;
    }
    const merged = repairConfusedEntriesVi(en, asEntries(row.entriesVi));
    const data: { entriesVi?: unknown; titleVi?: null } = {};
    if (JSON.stringify(merged) !== JSON.stringify(row.entriesVi)) {
      // Prisma.DbNull writes SQL NULL; a bare null would store the JSON value
      // `null`, which grammar-translate-export does not treat as untranslated.
      data.entriesVi = merged ?? Prisma.DbNull;
      note("confusedPairs", merged ? "entriesRepaired" : "entriesNulled");
    }
    // The title IS the pair being distinguished ("bare, bear"); a translated
    // one names two unrelated Vietnamese words. NULL falls back to titleEn.
    if (row.titleVi !== null) {
      data.titleVi = null;
      note("confusedPairs", "titlesNulled");
    }
    if (Object.keys(data).length === 0) continue;
    ops.push(() => prisma.grammarConfusedPair.update({ where: { id: row.id }, data: data as never }));
  }
  await flush(ops);
}

async function repairCommonMistakes(): Promise<void> {
  const rows = await prisma.grammarCommonMistake.findMany({
    where: { titleVi: { not: null } },
    select: { id: true, titleEn: true, titleVi: true },
  });
  const ops: Array<() => Promise<unknown>> = [];
  for (const row of rows) {
    const titleVi = repairMistakeTitleVi(row.titleEn, row.titleVi);
    if (titleVi === row.titleVi) continue;
    note("commonMistakes", titleVi ? "titlesRepaired" : "titlesNulled");
    ops.push(() => prisma.grammarCommonMistake.update({ where: { id: row.id }, data: { titleVi } }));
  }
  await flush(ops);
}

// ── Snapshot / restore of the six columns this script can write ──────────
type Snapshot = {
  takenAt: string;
  lessons: Array<{ id: number; contentViHtml: string | null }>;
  testQuestions: Array<{ id: number; questionVi: string | null }>;
  practiceQuestions: Array<{ id: number; questionVi: string | null; explanationVi: string | null }>;
  confusedPairs: Array<{ id: number; titleVi: string | null; entriesVi: unknown }>;
  commonMistakes: Array<{ id: number; titleVi: string | null }>;
};

async function snapshot(takenAt: string): Promise<string> {
  const data: Snapshot = {
    takenAt,
    lessons: await prisma.grammarLesson.findMany({ select: { id: true, contentViHtml: true } }),
    testQuestions: await prisma.grammarTestQuestion.findMany({ select: { id: true, questionVi: true } }),
    practiceQuestions: await prisma.grammarPracticeQuestion.findMany({
      select: { id: true, questionVi: true, explanationVi: true },
    }),
    confusedPairs: await prisma.grammarConfusedPair.findMany({
      select: { id: true, titleVi: true, entriesVi: true },
    }),
    commonMistakes: await prisma.grammarCommonMistake.findMany({ select: { id: true, titleVi: true } }),
  };
  const dir = resolve("data", "backups");
  mkdirSync(dir, { recursive: true });
  const file = resolve(dir, `grammar-vi-${takenAt}.json`);
  writeFileSync(file, JSON.stringify(data), "utf-8");
  return file;
}

async function restore(file: string): Promise<void> {
  const data = JSON.parse(readFileSync(file, "utf-8")) as Snapshot;
  const ops: Array<() => Promise<unknown>> = [];
  for (const r of data.lessons) {
    ops.push(() => prisma.grammarLesson.update({ where: { id: r.id }, data: { contentViHtml: r.contentViHtml } }));
  }
  for (const r of data.testQuestions) {
    ops.push(() => prisma.grammarTestQuestion.update({ where: { id: r.id }, data: { questionVi: r.questionVi } }));
  }
  for (const r of data.practiceQuestions) {
    ops.push(() =>
      prisma.grammarPracticeQuestion.update({
        where: { id: r.id },
        data: { questionVi: r.questionVi, explanationVi: r.explanationVi },
      })
    );
  }
  for (const r of data.confusedPairs) {
    ops.push(() =>
      prisma.grammarConfusedPair.update({
        where: { id: r.id },
        data: { titleVi: r.titleVi, entriesVi: (r.entriesVi ?? Prisma.DbNull) as never },
      })
    );
  }
  for (const r of data.commonMistakes) {
    ops.push(() => prisma.grammarCommonMistake.update({ where: { id: r.id }, data: { titleVi: r.titleVi } }));
  }
  for (let i = 0; i < ops.length; i += 200) {
    await prisma.$transaction(ops.slice(i, i + 200).map((f) => f() as never));
  }
  console.log(`restored ${ops.length} rows from ${file} (snapshot taken ${data.takenAt})`);
}

async function main(): Promise<void> {
  if (RESTORE) {
    await restore(RESTORE);
    return;
  }
  if (!DRY_RUN) {
    const file = await snapshot(new Date().toISOString().replace(/[:.]/g, "-"));
    console.log(`snapshot → ${file}\n`);
  }
  if (wants("lessons")) await repairLessons();
  if (wants("testQuestions")) await nullBlankStems("testQuestions");
  if (wants("practiceQuestions")) {
    await nullBlankStems("practiceQuestions");
    await repairExplanations();
  }
  if (wants("confusedPairs")) await repairConfusedPairs();
  if (wants("commonMistakes")) await repairCommonMistakes();

  console.log(DRY_RUN ? "DRY RUN — nothing written\n" : "applied\n");
  console.log(JSON.stringify(report, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
