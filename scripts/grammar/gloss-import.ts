// Import hand-written Vietnamese glosses ("EN - VI") produced from a gloss-export file.
// Every gloss passes checkGloss before it can be stored; dry-run by default,
// --apply writes with a snapshot of the previous values under data/backups/.
//
// Usage: npx tsx scripts/grammar/gloss-import.ts <export.json> <answers.tsv> [more.tsv ...] [--apply]
//   answers: one "<key><TAB><vietnamese>" per line, keys from the export file.
import "../../prisma/load-env";
import { Prisma, PrismaClient } from "@prisma/client";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { checkGloss, choiceGlossTargets, stemGlossTarget } from "../../src/lib/grammar/gloss";
import { lessonGlossBlocks } from "../../src/lib/grammar/lesson-gloss";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");
const ALLOW_REJECTS = process.argv.includes("--allow-rejects");
const norm = (t: string): string => t.replace(/\s+/g, " ").trim();
const files = process.argv.slice(2).filter((a) => !a.startsWith("--"));

type Exported = { items: Record<string, string>; targets: Record<string, Array<[string, number, string]>> };

/** The English text each target holds in the database right now, keyed "table:id:slot". */
async function currentEnglish(targets: Array<[string, number, string]>): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const ids = (table: string): number[] => [...new Set(targets.filter((t) => t[0] === table).map((t) => t[1]))];
  const lessonIds = ids("lessons");
  if (lessonIds.length) {
    const rows = await prisma.grammarLesson.findMany({ where: { id: { in: lessonIds } }, select: { id: true, contentEnHtml: true, contentViHtml: true } });
    for (const r of rows) for (const b of lessonGlossBlocks(r.contentEnHtml, r.contentViHtml ?? r.contentEnHtml)) out.set(`lessons:${r.id}:${b.blockId}`, b.text);
  }
  for (const table of ["testQuestions", "practiceQuestions"] as const) {
    const wanted = ids(table);
    if (!wanted.length) continue;
    const delegate = (table === "testQuestions" ? prisma.grammarTestQuestion : prisma.grammarPracticeQuestion) as unknown as {
      findMany(a: unknown): Promise<Array<{ id: number; questionEn: string; questionVi: string | null; choicesEn: unknown }>>;
    };
    const rows = await delegate.findMany({ where: { id: { in: wanted } }, select: { id: true, questionEn: true, questionVi: true, choicesEn: true } });
    for (const r of rows) {
      const stem = stemGlossTarget(r.questionEn, r.questionVi);
      if (stem) out.set(`${table}:${r.id}:stem`, stem);
      choiceGlossTargets(r.choicesEn as string[]).forEach((c, i) => {
        if (c) out.set(`${table}:${r.id}:c${i}`, c);
      });
    }
  }
  return out;
}

async function main(): Promise<void> {
  const [exportFile, ...answerFiles] = files;
  if (!exportFile || answerFiles.length === 0) {
    console.error("usage: gloss-import.ts <export.json> <answers.tsv> [more.tsv ...] [--apply]");
    process.exitCode = 1;
    return;
  }
  const exp = JSON.parse(readFileSync(resolve(exportFile), "utf8")) as Exported;
  const answers = new Map<string, string>();
  for (const f of answerFiles) {
    for (const line of readFileSync(resolve(f), "utf8").split("\n")) {
      const tab = line.indexOf("\t");
      if (tab > 0) answers.set(line.slice(0, tab).trim(), line.slice(tab + 1).trim());
    }
  }

  // An export can go stale (lesson edited, rows reordered): a gloss is only stored
  // against English text that still matches what was translated.
  const answered = [...answers.keys()].filter((k) => exp.items[k] !== undefined);
  const current = await currentEnglish(answered.flatMap((k) => exp.targets[k] ?? []));
  let stale = 0;
  let rejected = 0;
  let unknown = 0;
  const lessonGloss = new Map<number, Record<string, string>>();
  const stem = new Map<string, Map<number, string>>(); // table -> id -> gloss
  const choice = new Map<string, Map<number, Record<number, string>>>();
  for (const [key, vi] of answers) {
    const en = exp.items[key];
    if (en === undefined) {
      unknown++;
      continue;
    }
    const check = checkGloss(en, vi);
    if (!check.ok) {
      rejected++;
      console.log(`  ${key}: rejected (${check.reason}) EN: ${en.slice(0, 60)} | VI: ${vi.slice(0, 60)}`);
      continue;
    }
    for (const [table, id, slot] of exp.targets[key] ?? []) {
      if (norm(current.get(`${table}:${id}:${slot}`) ?? "") !== norm(en)) {
        stale++;
        continue;
      }
      if (table === "lessons") {
        lessonGloss.set(id, { ...(lessonGloss.get(id) ?? {}), [slot]: vi });
      } else if (slot === "stem") {
        if (!stem.has(table)) stem.set(table, new Map());
        stem.get(table)!.set(id, vi);
      } else {
        if (!choice.has(table)) choice.set(table, new Map());
        const m = choice.get(table)!;
        m.set(id, { ...(m.get(id) ?? {}), [Number(slot.slice(1))]: vi });
      }
    }
  }
  const covered = [...answers.keys()].filter((k) => exp.items[k] !== undefined).length;
  console.log(`answers: ${answers.size}, accepted: ${covered - rejected}, rejected: ${rejected}, unknown keys: ${unknown}, still unanswered: ${Object.keys(exp.items).length - covered}, stale targets skipped: ${stale}`);
  console.log(`would write: lessons ${lessonGloss.size}, stems ${[...stem.values()].reduce((n, m) => n + m.size, 0)}, choice rows ${[...choice.values()].reduce((n, m) => n + m.size, 0)}`);
  if (!APPLY) return;
  if (rejected > 0 && !ALLOW_REJECTS) {
    console.error(`refusing to apply: ${rejected} gloss(es) rejected. Fix or drop them (or pass --allow-rejects).`);
    process.exitCode = 1;
    return;
  }

  const snap: Record<string, unknown[]> = {};
  const ops: Array<() => Promise<unknown>> = [];
  const flush = async (): Promise<void> => {
    for (let i = 0; i < ops.length; i += 100) await prisma.$transaction(ops.slice(i, i + 100).map((f) => f() as never));
  };

  if (lessonGloss.size) {
    const rows = await prisma.grammarLesson.findMany({ where: { id: { in: [...lessonGloss.keys()] } }, select: { id: true, glossVi: true } });
    snap.lessons = rows;
    for (const r of rows) {
      const merged = { ...((r.glossVi ?? {}) as Record<string, string>), ...lessonGloss.get(r.id)! };
      ops.push(() => prisma.grammarLesson.update({ where: { id: r.id }, data: { glossVi: merged } }));
    }
  }
  for (const table of ["testQuestions", "practiceQuestions"] as const) {
    const ids = new Set<number>([...(stem.get(table)?.keys() ?? []), ...(choice.get(table)?.keys() ?? [])]);
    if (!ids.size) continue;
    const delegate = (table === "testQuestions" ? prisma.grammarTestQuestion : prisma.grammarPracticeQuestion) as unknown as {
      findMany(a: unknown): Promise<Array<{ id: number; choicesEn: unknown; stemGlossVi: string | null; choicesGlossVi: unknown }>>;
      update(a: unknown): Promise<unknown>;
    };
    const rows = await delegate.findMany({ where: { id: { in: [...ids] } }, select: { id: true, choicesEn: true, stemGlossVi: true, choicesGlossVi: true } });
    snap[table] = rows.map((r) => ({ id: r.id, stemGlossVi: r.stemGlossVi, choicesGlossVi: r.choicesGlossVi }));
    for (const r of rows) {
      const data: { stemGlossVi?: string; choicesGlossVi?: unknown } = {};
      const s = stem.get(table)?.get(r.id);
      if (s) data.stemGlossVi = s;
      const c = choice.get(table)?.get(r.id);
      if (c) {
        const len = (r.choicesEn as string[]).length;
        const cur = (Array.isArray(r.choicesGlossVi) ? (r.choicesGlossVi as Array<string | null>) : []).slice(0, len);
        while (cur.length < len) cur.push(null);
        for (const [i, vi] of Object.entries(c)) cur[Number(i)] = vi;
        data.choicesGlossVi = cur.some((x) => x !== null) ? cur : Prisma.DbNull;
      }
      ops.push(() => delegate.update({ where: { id: r.id }, data }));
    }
  }
  mkdirSync(resolve("data", "backups"), { recursive: true });
  const file = resolve("data", "backups", `grammar-gloss-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  writeFileSync(file, JSON.stringify(snap));
  console.log(`snapshot -> ${file}`);
  await flush();
  console.log("written");
}

main().finally(() => prisma.$disconnect());
