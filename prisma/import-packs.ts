/* eslint-disable */
// Import pack files (data/packs/*.json) into the Word table with merge
// semantics — unlike seed.ts (which only bootstraps an empty DB), this upserts:
//   • new words       → full create (createMany, batches of 500)
//   • existing words  → topics = union(existing, pack); cefr NEVER overwritten;
//                       other fields filled only when null/empty; no-op updates skipped
// Idempotent: re-running with the same packs changes nothing.
//
// --refresh <fields> (e.g. --refresh definitionVi,typeVi) additionally OVERWRITES
// those columns — but only on rows where the DB value still equals what a prior
// import wrote (the baseline pack value). Equality-as-provenance: if the DB value
// no longer matches the baseline, it was edited elsewhere and is left untouched.
// Baseline = the committed pack at --refresh-baseline <ref> (default HEAD). Pin
// it (e.g. to the commit that first imported the packs) when the re-translated
// packs have already been committed and HEAD no longer holds the old values.
//
// Usage: tsx prisma/import-packs.ts [--pack <name>] [--dry-run]
//                                   [--refresh <fields>] [--refresh-baseline <ref>]
import { PrismaClient } from "@prisma/client";
import { execFileSync } from "child_process";
import { packsFromArgv, packExists, readPack, packPath, PackWord, PackFile } from "../scripts/packs/lib/formats";

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes("--dry-run");

// Columns the --refresh flag may overwrite, mapped to the PackWord field they
// come from. Restricting the set keeps refresh from ever touching cefr/topics.
const REFRESHABLE: Record<string, keyof PackWord> = {
  definitionVi: "definition_vi",
  typeVi: "type_vi",
  exampleVi: "example_vi",
  definitionEn: "definition_en",
};
function parseRefreshArg(): Array<keyof typeof REFRESHABLE> {
  const i = process.argv.indexOf("--refresh");
  if (i === -1 || !process.argv[i + 1]) return [];
  return process.argv[i + 1].split(",").map((s) => s.trim()).filter((s) => {
    if (!(s in REFRESHABLE)) throw new Error(`--refresh: unknown field "${s}". Known: ${Object.keys(REFRESHABLE).join(", ")}`);
    return true;
  }) as Array<keyof typeof REFRESHABLE>;
}
const REFRESH_FIELDS = parseRefreshArg();

// Baseline pack value from git HEAD — what the last import wrote. A DB value
// that still equals this came from the import (safe to overwrite); anything else
// was edited and must be preserved. The ref defaults to HEAD but can be pinned
// with --refresh-baseline <ref> so the baseline stays stable even after the
// re-translated packs are committed (HEAD would then be the NEW values).
function refreshBaselineRef(): string {
  const i = process.argv.indexOf("--refresh-baseline");
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : "HEAD";
}
const BASELINE_REF = refreshBaselineRef();

function loadBaseline(name: string): Map<string, PackWord> {
  const map = new Map<string, PackWord>();
  try {
    const rel = packPath(name).replace(process.cwd() + "/", "");
    const json = execFileSync("git", ["show", `${BASELINE_REF}:${rel}`], {
      encoding: "utf-8",
      maxBuffer: 64 * 1024 * 1024,
    });
    const pack = JSON.parse(json) as PackFile;
    for (const w of pack.words) map.set(w.word, w);
  } catch {
    // No committed baseline (first import, or file untracked) — refresh nothing.
  }
  return map;
}

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

// Column ↔ PackWord-field pairing for the refreshable fields (DB column name on
// the left, matching ExistingWord key).
const REFRESH_COLUMN: Record<keyof typeof REFRESHABLE, keyof ExistingWord> = {
  definitionVi: "definitionVi",
  typeVi: "typeVi",
  exampleVi: "exampleVi",
  definitionEn: "definitionEn",
};

// Build the update payload for an existing row: fill-only-if-empty for scalar
// fields, union for topics. With --refresh, also overwrite the named fields when
// the DB still holds the baseline (import-written) value. Returns null when
// nothing would change.
function buildUpdate(ex: ExistingWord, w: PackWord, base?: PackWord): Record<string, unknown> | null {
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

  // --refresh: overwrite named fields when the new pack value differs AND the DB
  // still equals the baseline (proving it was import-written, not hand-edited).
  for (const field of REFRESH_FIELDS) {
    const col = REFRESH_COLUMN[field];
    const packField = REFRESHABLE[field];
    const newVal = (w[packField] ?? null) as string | null;
    const dbVal = ex[col] as string | null;
    const baseVal = (base?.[packField] ?? null) as string | null;
    if (newVal !== null && newVal !== dbVal && dbVal === baseVal) {
      data[col] = newVal;
    }
  }

  return Object.keys(data).length ? data : null;
}

async function main() {
  const packNames = packsFromArgv().filter(packExists);
  if (!packNames.length) {
    console.log("No pack files found — run packs:build/enrich/translate first.");
    return;
  }
  console.log(
    `${DRY_RUN ? "🔍 DRY RUN — " : ""}Importing packs: ${packNames.join(", ")}` +
      (REFRESH_FIELDS.length ? ` (refresh: ${REFRESH_FIELDS.join(", ")})` : "") +
      "\n"
  );

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
    const baseline = REFRESH_FIELDS.length ? loadBaseline(name) : undefined;
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
        const data = buildUpdate(ex, w, baseline?.get(w.word));
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
        // skipDuplicates: a concurrent import or a word created by an earlier
        // pack in this run must not abort the batch on the unique-word index.
        await prisma.word.createMany({ data: creates.slice(i, i + BATCH), skipDuplicates: true });
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
