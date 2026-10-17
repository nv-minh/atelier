// Merge reviewed per-slice answers into data/topics/classification.json (committed).
// Usage: npx tsx scripts/topics/classify-merge.ts [slicesDir]   (default data/llm-runs/topics/slices)
// Only words with at least one topic are stored; a word absent from the file has no keyword topic.
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseAnswers, validateAnswers } from "../../src/lib/topic-classification";

const dir = resolve(process.argv[2] ?? "data/llm-runs/topics/slices");
const allowed = new Set(readFileSync(resolve(dir, "guide.txt"), "utf8").split("\n").filter(Boolean).map((l) => l.split("\t")[0]));
const out: Record<string, string[]> = {};
let total = 0;
let bad = 0;
for (const f of readdirSync(dir).filter((n) => /^c-s\d+\.txt$/.test(n)).sort()) {
  const ans = resolve(dir, f.replace("c-", "ans-").replace(".txt", ".tsv"));
  const words = readFileSync(resolve(dir, f), "utf8").split("\n").filter(Boolean).map((l) => l.split("\t")[0]);
  const answers = parseAnswers(readFileSync(ans, "utf8"));
  const problems = validateAnswers(words, answers, allowed);
  if (problems.length) {
    bad += problems.length;
    console.log(`${f}: ${problems.length} problem(s), first: ${problems[0]}`);
    continue;
  }
  total += words.length;
  for (const [w, slugs] of answers) if (slugs.length) out[w] = slugs;
}
if (bad) {
  console.error("refusing to write: fix the problems above");
  process.exit(1);
}
mkdirSync(resolve("data", "topics"), { recursive: true });
const sorted = Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)));
writeFileSync(resolve("data", "topics", "classification.json"), JSON.stringify(sorted, null, 1) + "\n");
console.log(`words: ${total}, with a topic: ${Object.keys(out).length}`);
