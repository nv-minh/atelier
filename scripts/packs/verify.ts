/* eslint-disable */
// Post-import verification report — read-only. Checks counts per CEFR level
// and per curated topic, data-quality gates, and prints random samples per
// pack for a human spot-check of Vietnamese translation quality.
import { PrismaClient } from "@prisma/client";
import { TOPICS } from "../../src/lib/topic-taxonomy";
import { CEFR_LEVELS } from "../../src/lib/export-format";

const prisma = new PrismaClient();

function parseArr(s: string): string[] {
  try {
    const v = JSON.parse(s || "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

async function main() {
  const words = await prisma.word.findMany({
    select: {
      word: true, cefr: true, topics: true, definitionEn: true, definitionVi: true,
      ipaUk: true, ipaUs: true, example: true, typeVi: true,
    },
  });
  console.log(`Total words: ${words.length}\n`);

  console.log("Per CEFR level:");
  for (const lvl of CEFR_LEVELS) {
    console.log(`  ${lvl}: ${words.filter((w) => w.cefr === lvl).length}`);
  }
  const badCefr = words.filter((w) => !(CEFR_LEVELS as readonly string[]).includes(w.cefr));
  if (badCefr.length) {
    console.log(`  ⚠️  ${badCefr.length} words with unknown CEFR: ${badCefr.slice(0, 10).map((w) => `${w.word}(${w.cefr})`).join(", ")}`);
  }

  console.log("\nPer curated topic:");
  const curated = TOPICS.filter((t) => t.curated).map((t) => t.slug);
  for (const slug of curated) {
    console.log(`  ${slug}: ${words.filter((w) => parseArr(w.topics).includes(slug)).length}`);
  }

  const knownSlugs = new Set(TOPICS.map((t) => t.slug));
  const badTopics = new Set<string>();
  for (const w of words) for (const s of parseArr(w.topics)) if (!knownSlugs.has(s)) badTopics.add(s);
  console.log(`\nUnknown topic slugs: ${badTopics.size ? [...badTopics].join(", ") : "none ✓"}`);

  console.log("\nQuality gates:");
  const pct = (n: number) => `${((n / words.length) * 100).toFixed(1)}%`;
  const noDefEn = words.filter((w) => !w.definitionEn);
  const noDefVi = words.filter((w) => !w.definitionVi);
  const noIpa = words.filter((w) => !w.ipaUk && !w.ipaUs);
  const noExample = words.filter((w) => !w.example);
  console.log(`  definitionEn missing: ${noDefEn.length} (${pct(noDefEn.length)})${noDefEn.length ? " — " + noDefEn.slice(0, 15).map((w) => w.word).join(", ") : ""}`);
  console.log(`  definitionVi missing: ${noDefVi.length} (${pct(noDefVi.length)})`);
  console.log(`  IPA missing:          ${noIpa.length} (${pct(noIpa.length)})`);
  console.log(`  example missing:      ${noExample.length} (${pct(noExample.length)})`);

  const dupes = new Map<string, number>();
  for (const w of words) dupes.set(w.word, (dupes.get(w.word) ?? 0) + 1);
  const dupList = [...dupes.entries()].filter(([, n]) => n > 1);
  console.log(`  duplicate words:      ${dupList.length ? dupList.map(([w]) => w).join(", ") : "none ✓"}`);

  for (const slug of curated) {
    const inTopic = words.filter((w) => parseArr(w.topics).includes(slug));
    if (!inTopic.length) continue;
    console.log(`\nSamples — ${slug}:`);
    const shuffled = [...inTopic].sort(() => Math.random() - 0.5).slice(0, 10);
    for (const w of shuffled) {
      console.log(`  ${w.word} [${w.cefr}] (${w.typeVi ?? "?"})`);
      console.log(`    EN: ${(w.definitionEn ?? "—").slice(0, 90)}`);
      console.log(`    VI: ${(w.definitionVi ?? "—").slice(0, 90)}`);
    }
  }
  const c1 = words.filter((w) => w.cefr === "C1").sort(() => Math.random() - 0.5).slice(0, 5);
  if (c1.length) {
    console.log(`\nSamples — C1:`);
    for (const w of c1) {
      console.log(`  ${w.word}: VI: ${(w.definitionVi ?? "—").slice(0, 90)}`);
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
