// Export the English sentences that still need a Vietnamese gloss ("EN - VI").
// Distinct strings get one key each, so a sentence repeated across questions is
// translated once; `targets` maps a key back to every place it applies.
//
// Usage: npx tsx scripts/grammar/gloss-export.ts --table lessons|testQuestions|practiceQuestions --out data/llm-runs/gloss/<name>.json [--limit N]
// Output: { items: { "<key>": "<english>" }, targets: { "<key>": [[table, id, slot], ...] } }
//   slot: lessons = block id, questions = "stem" or "c<index>".
import "../../prisma/load-env";
import { PrismaClient } from "@prisma/client";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { choiceGlossTargets, stemGlossTarget } from "../../src/lib/grammar/gloss";
import { lessonGlossBlocks } from "../../src/lib/grammar/lesson-gloss";

const prisma = new PrismaClient();
const argOf = (flag: string): string | null => {
  const i = process.argv.indexOf(flag);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : null;
};
const TABLE = argOf("--table");
const OUT = argOf("--out");
const LIMIT = Number(argOf("--limit") ?? "0") || Infinity;

type Target = [string, number, string];
const keyOf = new Map<string, string>();
const items: Record<string, string> = {};
const targets: Record<string, Target[]> = {};
function add(en: string, target: Target): void {
  let key = keyOf.get(en);
  if (!key) {
    key = `g${keyOf.size + 1}`;
    keyOf.set(en, key);
    items[key] = en;
    targets[key] = [];
  }
  targets[key].push(target);
}

async function main(): Promise<void> {
  if (!OUT || !TABLE || !["lessons", "testQuestions", "practiceQuestions"].includes(TABLE)) {
    console.error("usage: gloss-export.ts --table lessons|testQuestions|practiceQuestions --out <file> [--limit N]");
    process.exitCode = 1;
    return;
  }
  if (TABLE === "lessons") {
    const rows = await prisma.grammarLesson.findMany({ select: { id: true, contentEnHtml: true, contentViHtml: true, glossVi: true }, orderBy: { id: "asc" } });
    for (const r of rows) {
      const have = (r.glossVi ?? {}) as Record<string, string>;
      for (const b of lessonGlossBlocks(r.contentEnHtml, r.contentViHtml ?? r.contentEnHtml)) if (!have[String(b.blockId)]) add(b.text, ["lessons", r.id, String(b.blockId)]);
    }
  } else {
    const delegate = (TABLE === "testQuestions" ? prisma.grammarTestQuestion : prisma.grammarPracticeQuestion) as unknown as {
      findMany(a: unknown): Promise<Array<{ id: number; questionEn: string; questionVi: string | null; choicesEn: unknown; stemGlossVi: string | null; choicesGlossVi: unknown }>>;
    };
    const rows = await delegate.findMany({
      select: { id: true, questionEn: true, questionVi: true, choicesEn: true, stemGlossVi: true, choicesGlossVi: true },
      orderBy: { id: "asc" },
    });
    for (const r of rows) {
      const stem = stemGlossTarget(r.questionEn, r.questionVi);
      if (stem && !r.stemGlossVi) add(stem, [TABLE, r.id, "stem"]);
      const have = (Array.isArray(r.choicesGlossVi) ? r.choicesGlossVi : []) as Array<string | null>;
      choiceGlossTargets(r.choicesEn as string[]).forEach((c, i) => {
        if (c && !have[i]) add(c, [TABLE, r.id, `c${i}`]);
      });
    }
  }
  const keys = Object.keys(items).slice(0, LIMIT);
  const out = { items: Object.fromEntries(keys.map((k) => [k, items[k]])), targets: Object.fromEntries(keys.map((k) => [k, targets[k]])) };
  mkdirSync(dirname(resolve(OUT)), { recursive: true });
  writeFileSync(resolve(OUT), JSON.stringify(out), "utf-8");
  const chars = keys.reduce((n, k) => n + items[k].length, 0);
  console.log(`${TABLE}: ${keys.length} distinct sentence(s), ${chars} chars, ${keys.reduce((n, k) => n + targets[k].length, 0)} target slot(s) -> ${OUT}`);
}

main().finally(() => prisma.$disconnect());
