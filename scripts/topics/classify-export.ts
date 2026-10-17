// Export every word as one line for hand classification into the thematic topics.
// Usage: npx tsx scripts/topics/classify-export.ts [--out data/llm-runs/topics/slices] [--size 500]
// Output: <out>/c-sNN.txt lines "word<TAB>pos<TAB>definition<TAB>example", plus <out>/guide.txt.
import "../../prisma/load-env";
import { PrismaClient } from "@prisma/client";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { TOPICS } from "../../src/lib/topic-taxonomy";

const prisma = new PrismaClient();
const arg = (flag: string, dflt: string): string => {
  const i = process.argv.indexOf(flag);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : dflt;
};
const OUT = resolve(arg("--out", "data/llm-runs/topics/slices"));
const SIZE = Number(arg("--size", "500"));
const clean = (s: string | null, max: number): string => (s ?? "").replace(/\s+/g, " ").trim().slice(0, max);

async function main(): Promise<void> {
  const words = await prisma.word.findMany({ select: { word: true, typeEn: true, definitionEn: true, example: true }, orderBy: { word: "asc" } });
  mkdirSync(OUT, { recursive: true });
  const slices = Math.ceil(words.length / SIZE);
  for (let i = 0; i < slices; i++) {
    const lines = words.slice(i * SIZE, (i + 1) * SIZE).map((w) => [w.word, clean(w.typeEn, 20), clean(w.definitionEn, 180), clean(w.example, 120)].join("\t"));
    writeFileSync(resolve(OUT, `c-s${String(i + 1).padStart(2, "0")}.txt`), lines.join("\n") + "\n");
  }
  const guide = TOPICS.filter((t) => t.keywords.length > 0).map((t) => `${t.slug}\t${t.name}\t${t.blurb}`).join("\n");
  writeFileSync(resolve(OUT, "guide.txt"), guide + "\n");
  console.log(`${words.length} words -> ${slices} slice(s) in ${OUT}`);
}

main().finally(() => prisma.$disconnect());
