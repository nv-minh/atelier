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

if (ONLY_TABLE && !(ONLY_TABLE in DELEGATES)) {
  console.error(`Invalid --table value "${ONLY_TABLE}". Valid tables: ${Object.keys(DELEGATES).join(", ")}`);
  process.exit(1);
}

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
        // A row with nothing to translate from must not appear in the export file.
        if (en == null || (typeof en === "string" && !en.trim())) continue;
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
