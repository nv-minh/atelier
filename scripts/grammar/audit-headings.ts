// Harvest every lesson heading from the DB and classify it for the VI pass:
// which are translatable prose, which are English specimens (word lists,
// formulas) that must stay verbatim. Writes the classified inventory to
// data/llm-runs/heading-inventory.json for glossary curation and LLM batches.
//
// Usage: npx tsx scripts/grammar/audit-headings.ts [--min-count 2]
import "../../prisma/load-env";
import { PrismaClient } from "@prisma/client";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const prisma = new PrismaClient();
const MIN_COUNT = (() => {
  const i = process.argv.indexOf("--min-count");
  return i !== -1 ? Number.parseInt(process.argv[i + 1] ?? "2", 10) : 2;
})();

const TAG = /<[^>]+>/g;

async function main(): Promise<void> {
  const lessons = await prisma.grammarLesson.findMany({
    select: { id: true, contentEnHtml: true },
    orderBy: { id: "asc" },
  });

  // heading text (tags stripped) → where it appeared
  const inv = new Map<string, { count: number; lessons: number[] }>();
  for (const l of lessons) {
    const seen = new Set<string>();
    for (const m of l.contentEnHtml.matchAll(/<h([1-4])[^>]*>([\s\S]*?)<\/h\1>/g)) {
      const text = m[2].replace(TAG, " ").replace(/\s+/g, " ").trim();
      if (!text || seen.has(text)) continue; // count a heading once per lesson
      seen.add(text);
      const e = inv.get(text) ?? { count: 0, lessons: [] };
      e.count++;
      e.lessons.push(l.id);
      inv.set(text, e);
    }
  }

  const rows = [...inv.entries()]
    .map(([text, e]) => ({ text, count: e.count, lessons: e.lessons }))
    .sort((a, b) => b.count - a.count || a.text.localeCompare(b.text));

  const dir = resolve("data", "llm-runs");
  mkdirSync(dir, { recursive: true });
  const file = resolve(dir, "heading-inventory.json");
  writeFileSync(file, JSON.stringify(rows, null, 2), "utf-8");

  const total = rows.reduce((n, r) => n + r.count, 0);
  console.log(`unique headings: ${rows.length} (${total} occurrences over ${lessons.length} lessons)`);
  console.log(`repeated (>=${MIN_COUNT}×): ${rows.filter((r) => r.count >= MIN_COUNT).length}`);
  console.log(`→ ${file}`);
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
