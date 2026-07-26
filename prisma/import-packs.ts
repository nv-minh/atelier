/* eslint-disable */
// Import pack files (data/packs/*.json) into the Word table with merge
// semantics — unlike seed.ts (which only bootstraps an empty DB), this upserts:
//   • new words       → full create (createMany, batches of 500)
//   • existing words  → topics = union(existing, pack); cefr NEVER overwritten;
//                       other fields filled only when null/empty; no-op updates skipped
// Idempotent: re-running with the same packs changes nothing.
//
// Usage: tsx prisma/import-packs.ts [--pack <name>] [--dry-run]
import { PrismaClient } from "@prisma/client";
import { packsFromArgv, packExists, readPack, PackWord } from "../scripts/packs/lib/formats";

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes("--dry-run");

type ExistingWord = {
  id: string;
  word: string;
  cefr: string;
  typeEn: string | null;
  typeVi: string | null;
  ipaUk: string | null;
  ipaUs: string | null;
  definitionEn: string | null;
  definitionVi: string | null;
  extraDefs: string;
  example: string | null;
  exampleVi: string | null;
  synonyms: string;
  antonyms: string;
  topics: string;
  audioUk: string | null;
  audioUs: string | null;
};

function parseArr(s: string): string[] {
  try {
    const v = JSON.parse(s || "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function toCreateRow(w: PackWord) {
  return {
    word: w.word,
    cefr: w.cefr,
    typeEn: w.type_en ?? null,
    typeVi: w.type_vi ?? null,
    ipaUk: w.ipa_uk ?? null,
    ipaUs: w.ipa_us ?? null,
    definitionEn: w.definition_en ?? null,
    definitionVi: w.definition_vi ?? null,
    extraDefs: JSON.stringify(w.extra_definitions ?? []),
    example: w.example ?? null,
    exampleVi: w.example_vi ?? null,
    synonyms: JSON.stringify(w.synonyms ?? []),
    antonyms: JSON.stringify(w.antonyms ?? []),
    topics: JSON.stringify(w.topics ?? []),
    imageUrl: null as string | null,
    audioUk: w.audio?.uk ?? null,
    audioUs: w.audio?.us ?? null,
  };
}

// Build the update payload for an existing row: fill-only-if-empty for scalar
// fields, union for topics. Returns null when nothing would change.
function buildUpdate(ex: ExistingWord, w: PackWord): Record<string, unknown> | null {
  const data: Record<string, unknown> = {};

  const packTopics = w.topics ?? [];
  if (packTopics.length) {
    const existing = parseArr(ex.topics);
    const merged = [...existing, ...packTopics.filter((t) => !existing.includes(t))];
    if (merged.length !== existing.length) data.topics = JSON.stringify(merged);
  }

  const fill = (col: keyof ExistingWord, val: string | null | undefined) => {
    if (val && !ex[col]) data[col] = val;
  };
  fill("typeEn", w.type_en);
  fill("typeVi", w.type_vi);
  fill("ipaUk", w.ipa_uk);
  fill("ipaUs", w.ipa_us);
  fill("definitionEn", w.definition_en);
  fill("definitionVi", w.definition_vi);
  fill("example", w.example);
  fill("exampleVi", w.example_vi);
  fill("audioUk", w.audio?.uk);
  fill("audioUs", w.audio?.us);
  if (w.extra_definitions?.length && parseArr(ex.extraDefs).length === 0) {
    data.extraDefs = JSON.stringify(w.extra_definitions);
  }
  if (w.synonyms?.length && parseArr(ex.synonyms).length === 0) {
    data.synonyms = JSON.stringify(w.synonyms);
  }
  if (w.antonyms?.length && parseArr(ex.antonyms).length === 0) {
    data.antonyms = JSON.stringify(w.antonyms);
  }

  return Object.keys(data).length ? data : null;
}

async function main() {
  const packNames = packsFromArgv().filter(packExists);
  if (!packNames.length) {
    console.log("No pack files found — run packs:build/enrich/translate first.");
    return;
  }
  console.log(`${DRY_RUN ? "🔍 DRY RUN — " : ""}Importing packs: ${packNames.join(", ")}\n`);

  const rows = await prisma.word.findMany({
    select: {
      id: true, word: true, cefr: true, typeEn: true, typeVi: true, ipaUk: true, ipaUs: true,
      definitionEn: true, definitionVi: true, extraDefs: true, example: true, exampleVi: true,
      synonyms: true, antonyms: true, topics: true, audioUk: true, audioUs: true,
    },
  });
  const byWord = new Map<string, ExistingWord>(rows.map((r) => [r.word, r]));
  console.log(`DB currently has ${rows.length} words.\n`);

  for (const name of packNames) {
    const pack = readPack(name);
    let created = 0;
    let updated = 0;
    let unchanged = 0;
    const creates: ReturnType<typeof toCreateRow>[] = [];
    // Update by the unique `word` column, not id — words created by an earlier
    // pack in this same run exist in the DB but their generated id isn't known
    // locally (updating by a stale/empty id was a P2025).
    const updates: Array<{ word: string; data: Record<string, unknown> }> = [];

    for (const w of pack.words) {
      const ex = byWord.get(w.word);
      if (!ex) {
        creates.push(toCreateRow(w));
        created++;
      } else {
        const data = buildUpdate(ex, w);
        if (data) {
          updates.push({ word: w.word, data });
          updated++;
          // Reflect the merge locally so later packs union against fresh state.
          if (data.topics) ex.topics = data.topics as string;
        } else {
          unchanged++;
        }
      }
    }

    console.log(
      `${name}: ${pack.words.length} words → create ${created}, update ${updated}, unchanged ${unchanged}`
    );

    if (!DRY_RUN) {
      const BATCH = 500;
      for (let i = 0; i < creates.length; i += BATCH) {
        await prisma.word.createMany({ data: creates.slice(i, i + BATCH) });
      }
      const TX = 50;
      for (let i = 0; i < updates.length; i += TX) {
        await prisma.$transaction(
          updates.slice(i, i + TX).map((u) => prisma.word.update({ where: { word: u.word }, data: u.data }))
        );
      }
    }

    // Register created words locally (id unused afterwards) for cross-pack merges.
    for (const c of creates) {
      byWord.set(c.word, { ...c, id: "" } as ExistingWord);
    }
  }

  const total = await prisma.word.count();
  console.log(`\n✅ Done. DB now has ${DRY_RUN ? `${rows.length} (dry run — unchanged)` : total} words.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
