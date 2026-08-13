/* eslint-disable */
// Pack file format: the on-disk contract between pipeline stages and
// prisma/import-packs.ts. Field names are snake_case to mirror
// data/vocabulary.json so the importer mapping stays consistent with seed.ts.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

export type PackWord = {
  word: string; // lowercase; may contain spaces/apostrophes/hyphens
  cefr: string; // A1 | A2 | B1 | B2 | C1
  // "inferred" = derived from a corpus frequency measure (wordfreq Zipf) rather
  // than a published CEFR list. Treat it as the weakest signal: import never
  // overwrites an existing cefr, so a curated value always wins over this one.
  cefr_source: "oxford" | "cefr-dataset" | "rank-estimate" | "seed" | "default" | "inferred";
  rank?: number;
  /** provenance URL for a single entry (e.g. the WordNet synset page) */
  source_ref?: string | null;
  type_en?: string | null;
  type_vi?: string | null;
  ipa_uk?: string | null;
  ipa_us?: string | null;
  definition_en?: string | null;
  definition_vi?: string | null;
  extra_definitions?: string[];
  example?: string | null;
  example_vi?: string | null;
  synonyms?: string[];
  antonyms?: string[];
  topics: string[]; // curated topic slugs (may be empty, e.g. the C1 pack)
  audio?: { uk?: string | null; us?: string | null };
  vi_source?: "anhviet" | "gtx";
};

export type PackFile = {
  metadata: {
    pack: string;
    topic_slugs: string[];
    source: string;
    license: string;
    generated: string;
    count: number;
  };
  words: PackWord[];
};

export const PACKS_DIR = resolve(process.cwd(), "data/packs");
export const RAW_DIR = resolve(process.cwd(), "data/raw");

export const PACK_NAMES = [
  "oxford-c1",
  "conversation",
  "business",
  "toeic",
  "it-programming",
  // 2026-08-13 crawl batch (WordNet 3.0 senses + wordfreq Zipf → inferred CEFR).
  // `daily-communication` is a general frequency band (rank ~2.5k–25k), not a
  // domain, so it ships with topic_slugs: [] like oxford-c1 and gets its topics
  // from keyword matching in db:topics.
  "medical",
  "legal",
  "finance",
  "logistics",
  "daily-life",
  "social",
  "travel",
  "office-skills",
  "daily-communication",
] as const;
export type PackName = (typeof PACK_NAMES)[number];

export function packPath(name: string): string {
  return resolve(PACKS_DIR, `${name}.json`);
}

export function readPack(name: string): PackFile {
  return JSON.parse(readFileSync(packPath(name), "utf-8"));
}

export function packExists(name: string): boolean {
  return existsSync(packPath(name));
}

export function writePack(pack: PackFile): void {
  mkdirSync(PACKS_DIR, { recursive: true });
  pack.metadata.count = pack.words.length;
  writeFileSync(packPath(pack.metadata.pack), JSON.stringify(pack, null, 1), "utf-8");
}

export function normalizeWord(w: string): string {
  return w.trim().toLowerCase().replace(/\s+/g, " ");
}

// Which packs were requested on the CLI: `--pack business` limits a stage to
// one pack; default is all that exist on disk (or all, for the build stage).
export function packsFromArgv(): PackName[] {
  const i = process.argv.indexOf("--pack");
  if (i !== -1 && process.argv[i + 1]) {
    const name = process.argv[i + 1];
    if (!(PACK_NAMES as readonly string[]).includes(name)) {
      throw new Error(`Unknown pack "${name}". Known: ${PACK_NAMES.join(", ")}`);
    }
    return [name as PackName];
  }
  return [...PACK_NAMES];
}
