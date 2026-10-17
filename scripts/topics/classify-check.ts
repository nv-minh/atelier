// Validate a hand-written classification against its slice (no DB access).
// Usage: npx tsx scripts/topics/classify-check.ts <slice.txt> <answers.tsv>
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseAnswers, validateAnswers } from "../../src/lib/topic-classification";

const [slice, answers] = process.argv.slice(2);
if (!slice || !answers) {
  console.error("usage: classify-check.ts <slice.txt> <answers.tsv>");
  process.exit(1);
}
const dir = resolve(slice, "..");
const allowed = new Set(readFileSync(resolve(dir, "guide.txt"), "utf8").split("\n").filter(Boolean).map((l) => l.split("\t")[0]));
const words = readFileSync(resolve(slice), "utf8").split("\n").filter(Boolean).map((l) => l.split("\t")[0]);
const problems = validateAnswers(words, parseAnswers(readFileSync(resolve(answers), "utf8")), allowed);
for (const p of problems.slice(0, 40)) console.log("  " + p);
console.log(`words: ${words.length}, problems: ${problems.length}`);
process.exitCode = problems.length ? 1 : 0;
