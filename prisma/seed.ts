/* eslint-disable */
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "fs";
import { resolve } from "path";

const prisma = new PrismaClient();

type VocabFile = {
  vocabulary: Array<{
    word: string;
    cefr: string;
    type_en?: string;
    type_vi?: string;
    ipa_uk?: string;
    ipa_us?: string;
    definition_en?: string;
    extra_definitions?: string[];
    example?: string;
    synonyms?: string[];
    antonyms?: string[];
    images?: { google_images?: string };
    audio?: { uk?: string; us?: string };
  }>;
};

async function main() {
  console.log("📖 Reading vocabulary.json...");
  const raw = readFileSync(resolve(process.cwd(), "data/vocabulary.json"), "utf-8");
  const data: VocabFile = JSON.parse(raw);

  console.log(`   Found ${data.vocabulary.length} words`);

  // Settings are per-user now (created on first login), nothing to seed here.

  // Idempotent: if words already seeded, just report and exit
  const existing = await prisma.word.count();
  if (existing > 0) {
    console.log(`   ℹ️  Database already has ${existing} words. Skipping seed (delete dev.db to re-seed).`);
    return;
  }

  // Bulk insert in batches of 500
  const BATCH = 500;
  let inserted = 0;
  for (let i = 0; i < data.vocabulary.length; i += BATCH) {
    const batch = data.vocabulary.slice(i, i + BATCH);
    const rows = batch.map((v) => ({
      word: v.word.toLowerCase(),
      cefr: v.cefr,
      typeEn: v.type_en ?? null,
      typeVi: v.type_vi ?? null,
      ipaUk: v.ipa_uk ?? null,
      ipaUs: v.ipa_us ?? null,
      definitionEn: v.definition_en ?? null,
      extraDefs: JSON.stringify(v.extra_definitions ?? []),
      example: v.example ?? null,
      synonyms: JSON.stringify(v.synonyms ?? []),
      antonyms: JSON.stringify(v.antonyms ?? []),
      imageUrl: v.images?.google_images ?? null,
      audioUk: v.audio?.uk ?? null,
      audioUs: v.audio?.us ?? null,
    }));

    // createMany (idempotency handled by the existing-count check above)
    const result = await prisma.word.createMany({
      data: rows,
    });
    inserted += result.count;
    const pct = Math.min(100, Math.round(((i + BATCH) / data.vocabulary.length) * 100));
    process.stdout.write(`\r   Seeded ${inserted} words... (${pct}%)   `);
  }
  console.log("\n");

  const total = await prisma.word.count();
  const byLevel = await prisma.word.groupBy({
    by: ["cefr"],
    _count: true,
  });
  console.log("✅ Seed complete!");
  console.log(`   Total words in DB: ${total}`);
  for (const g of byLevel) {
    console.log(`   ${g.cefr}: ${g._count}`);
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
