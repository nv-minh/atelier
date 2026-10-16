// Read-only VI/EN consistency audit over the grammar tables. The same numbers
// are the acceptance criteria before and after the language-consistency work.
//
// Usage: npm run grammar:audit-language -- --label baseline|after-lessons|final
import "../../prisma/load-env";
import { PrismaClient } from "@prisma/client";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { SEMANTIC_SPAN_CLASSES } from "../../src/lib/grammar/semantic-classes";
import { auditLessonLang, auditStem, flagTitleVi, type StemAudit } from "../../src/lib/grammar/lang-audit";
import { isBlankStem } from "../../src/lib/grammar/vi-repair";

const prisma = new PrismaClient();
const PC: ReadonlySet<string> = new Set(SEMANTIC_SPAN_CLASSES);
// Segments the translators marked "@keep" (deliberate English), per lesson id.
const keepFiles = existsSync(resolve("data", "llm-runs"))
  ? readdirSync(resolve("data", "llm-runs")).filter((f) => /^lesson-keeps-.*\.json$/.test(f)).sort()
  : [];
const KEEPS: Record<string, string[]> = {};
for (const f of keepFiles) {
  // keeps accumulate across daily files: a later run must not hide an earlier one's allowlist
  const day = JSON.parse(readFileSync(resolve("data", "llm-runs", f), "utf8")) as Record<string, string[]>;
  for (const [id, segs] of Object.entries(day)) KEEPS[id] = [...(KEEPS[id] ?? []), ...segs];
}
const labelIdx = process.argv.indexOf("--label");
const LABEL = labelIdx !== -1 && process.argv[labelIdx + 1] ? process.argv[labelIdx + 1] : "adhoc";

async function main(): Promise<void> {
  const lessons = await prisma.grammarLesson.findMany({
    select: { id: true, titleEn: true, titleVi: true, contentEnHtml: true, contentViHtml: true },
    orderBy: { id: "asc" },
  });
  const lesson = { total: lessons.length, viNull: 0, withProseGaps: 0, headingGaps: 0, gluedSpans: 0, emptiedInline: 0, lessonsWithEmptiedInline: 0, tagMismatch: 0, titleFlagged: 0 };
  const gapIds: number[] = [];
  const titleFlags: Array<{ id: number; titleEn: string; titleVi: string | null; reason: string }> = [];
  for (const l of lessons) {
    const reason = flagTitleVi(l.titleEn, l.titleVi);
    if (reason) {
      lesson.titleFlagged++;
      titleFlags.push({ id: l.id, titleEn: l.titleEn, titleVi: l.titleVi, reason });
    }
    if (!l.contentViHtml) {
      lesson.viNull++;
      continue;
    }
    const a = auditLessonLang(l.contentEnHtml, l.contentViHtml, PC, new Set(KEEPS[String(l.id)] ?? []));
    if (a.tagMismatch) lesson.tagMismatch++;
    if (a.proseGaps > 0) {
      lesson.withProseGaps++;
      gapIds.push(l.id);
    }
    lesson.headingGaps += a.headingGaps;
    lesson.gluedSpans += a.gluedSpans;
    lesson.emptiedInline += a.emptiedInline;
    if (a.emptiedInline > 0) lesson.lessonsWithEmptiedInline++;
  }

  const stems: Record<string, Record<string, number>> = {};
  for (const [name, rows] of [
    ["test", await prisma.grammarTestQuestion.findMany({ select: { questionEn: true, questionVi: true } })],
    ["practice", await prisma.grammarPracticeQuestion.findMany({ select: { questionEn: true, questionVi: true } })],
  ] as const) {
    const c: Record<string, number> = { total: rows.length, blank: 0, nonBlankNullVi: 0 };
    for (const r of rows) {
      const kind: StemAudit = auditStem(r.questionEn, r.questionVi);
      c[kind] = (c[kind] ?? 0) + 1;
      if (isBlankStem(r.questionEn)) c.blank++;
      else if (r.questionVi === null) c.nonBlankNullVi++;
    }
    stems[name] = c;
  }

  const report = { label: LABEL, at: new Date().toISOString(), lesson, stems, gapIds, titleFlags };
  const dir = resolve("data", "llm-runs");
  mkdirSync(dir, { recursive: true });
  const file = resolve(dir, `language-audit-${new Date().toISOString().slice(0, 10)}-${LABEL}.json`);
  writeFileSync(file, JSON.stringify(report, null, 2), "utf-8");
  console.log(JSON.stringify({ lesson, stems }, null, 2));
  console.log(`written ${file}`);
}

main().finally(() => prisma.$disconnect());
