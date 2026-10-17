/* eslint-disable */
import "./load-env";
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { TOPICS } from "../src/lib/topic-taxonomy";

const prisma = new PrismaClient();

// Keyword topics come from the reviewed classification (data/topics/classification.json,
// built by scripts/topics/classify-*.ts). Keyword substring matching was retired: its
// precision measured ~20% (scripts/topics/audit-topics.ts). A word absent from the file
// simply gets no keyword topic.
const CLASSIFICATION = JSON.parse(readFileSync(resolve("data", "topics", "classification.json"), "utf8")) as Record<string, string[]>;

// Pack-only slugs (tagged by import-packs.ts, no keywords) must survive re-runs.
// `travel` is curated AND classified; its old pack tags were noisy ("house"), so the
// classification is its only source now.
const CURATED = new Set(TOPICS.filter((t) => t.curated && t.keywords.length === 0).map((t) => t.slug));

async function main() {
  console.log("🏷️  Categorizing all words into topics...\n");
  const words = await prisma.word.findMany({
    select: { id: true, word: true, topics: true },
  });
  console.log(`   Found ${words.length} words`);

  let assigned = 0;
  const topicCounts: Record<string, number> = {};
  const BATCH = 400;

  for (let i = 0; i < words.length; i += BATCH) {
    const batch = words.slice(i, i + BATCH);
    const updates = [];
    for (const w of batch) {
      let existing: string[] = [];
      try {
        const v = JSON.parse(w.topics || "[]");
        if (Array.isArray(v)) existing = v;
      } catch {}
      const keywordTopics = CLASSIFICATION[w.word] ?? [];
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
