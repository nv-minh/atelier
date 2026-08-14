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
