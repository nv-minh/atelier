/* eslint-disable */
import { PrismaClient } from "@prisma/client";
import { assignTopics, TOPICS } from "../src/lib/topic-taxonomy";

const prisma = new PrismaClient();

// Curated pack slugs (tagged by import-packs.ts) must survive re-runs; keyword
// topics are recomputed from scratch each time.
const CURATED = new Set(TOPICS.filter((t) => t.curated).map((t) => t.slug));

async function main() {
  console.log("🏷️  Categorizing all words into topics...\n");
  const words = await prisma.word.findMany({
    select: { id: true, word: true, definitionEn: true, example: true, synonyms: true, topics: true },
  });
  console.log(`   Found ${words.length} words`);

  let assigned = 0;
  const topicCounts: Record<string, number> = {};
  const BATCH = 400;

  for (let i = 0; i < words.length; i += BATCH) {
    const batch = words.slice(i, i + BATCH);
    const updates = [];
    for (const w of batch) {
      let syns: string[] = [];
      try {
        const v = JSON.parse(w.synonyms || "[]");
        if (Array.isArray(v)) syns = v;
      } catch {}
      let existing: string[] = [];
      try {
        const v = JSON.parse(w.topics || "[]");
        if (Array.isArray(v)) existing = v;
      } catch {}
      const keywordTopics = assignTopics({
        word: w.word,
        definitionEn: w.definitionEn,
        example: w.example,
        synonyms: syns,
      });
      const curated = existing.filter((s) => CURATED.has(s));
      const topics = [...curated, ...keywordTopics.filter((s) => !curated.includes(s))];
      for (const t of topics) topicCounts[t] = (topicCounts[t] ?? 0) + 1;
      if (topics.length > 0) assigned++;
      updates.push(prisma.word.update({ where: { id: w.id }, data: { topics: JSON.stringify(topics) } }));
    }
    await prisma.$transaction(updates);
    const pct = Math.min(100, Math.round(((i + BATCH) / words.length) * 100));
    process.stdout.write(`\r   Processed ${Math.min(i + BATCH, words.length)} (${pct}%)   `);
  }

  console.log("\n\n✅ Categorization complete!\n");
  console.log(`   Words with ≥1 topic: ${assigned} / ${words.length} (${((assigned / words.length) * 100).toFixed(1)}%)`);
  console.log("\n📊 Words per topic:");
  const sorted = Object.entries(topicCounts).sort((a, b) => b[1] - a[1]);
  for (const [t, c] of sorted) {
    console.log(`   ${t.padEnd(16)} ${String(c).padStart(4)}`);
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
