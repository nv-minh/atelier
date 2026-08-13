/* eslint-disable */
// Convert an aggregated crawl file into per-pack data/packs/*.json in PackFile
// shape, applying the dedupe + quality filter agreed for the 2026-08-13 batch.
//
// The crawl file is one JSON array of { metadata, words } objects whose schema
// is close to PackFile but not identical: metadata carries part/word_count/
// cefr_distribution/sources/notes instead of topic_slugs/source/license/count,
// and words carry freq_rank/source_ref instead of rank.
//
// Output is the committed artifact; the input lives in gitignored data/raw/.
// Run packs:enrich and packs:translate afterwards — this stage writes no IPA,
// audio, or Vietnamese, so importing straight from here would leave the new
// rows without a Vietnamese definition.
//
// Usage: tsx scripts/packs/build-crawl-batch.ts [--in <file>] [--dry-run]
import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import { PackFile, PackWord, RAW_DIR, normalizeWord, writePack } from "./lib/formats";

const DRY_RUN = process.argv.includes("--dry-run");
function argValue(flag: string, fallback: string): string {
  const i = process.argv.indexOf(flag);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}
const IN_FILE = argValue("--in", resolve(RAW_DIR, "incoming/vocab-all-packs.json"));
const DROP_REPORT = resolve(process.cwd(), "data/crawl-batches/2026-08-13-dropped.json");

// ── Which taxonomy slug each pack's words get ───────────────────────────
// `logistics` folds into the existing curated `business` topic: 15 words is too
// thin to be its own chip — a learner tapping it would run dry immediately.
// `daily-communication` gets NO slug: despite the name it is not a domain, it
// is a general frequency band (rank ~2.5k–25k: abroad, achieve, acid, affair).
// Same treatment as oxford-c1, so db:topics assigns it real keyword topics.
const TOPIC_SLUGS: Record<string, string[]> = {
  medical: ["medical"],
  legal: ["legal"],
  finance: ["finance"],
  logistics: ["business"],
  "daily-life": ["daily-life"],
  social: ["social"],
  travel: ["travel"],
  "office-skills": ["office-skills"],
  "daily-communication": [],
};

// ── Spelling aliases: rename, never drop ────────────────────────────────
// Word.word is unique, but these normalize differently from the row already in
// the DB, so importing them as-is creates a second row for the same word.
// Renaming to the DB's spelling puts them on the merge path instead, where they
// contribute their topic to the existing row.
const ALIAS: Record<string, string> = {
  "road map": "roadmap",
  filmmaker: "film-maker",
  makeup: "make-up",
};

// ── Marginal-sense duplicates ───────────────────────────────────────────
// Each of these is a plural or participle whose WordNet synset carries an
// obscure sense of a word the DB already teaches: `boards` = "the stage of a
// theater", `roads` = "a partly sheltered anchorage", `hooks` = "large strong
// hand of a fighter", `eggs` = simply the plural of egg. Kept out so the app
// never teaches the odd sense of a word it already has.
//
// Deliberately NOT here: damages, customs, glasses, piles, aesthetics,
// humanities, savings, credits, channels, amenities, communications, morals,
// fundamentals, grounds, roots, riches, honours, blues, singles — all real
// lexemes whose plural genuinely means something else.
const DROP_MARGINAL_SENSE = [
  "eggs", "seats", "profits", "losses", "assets", "congratulations", "instructions",
  "scores", "tons", "colors", "boards", "bars", "rings", "roads", "hooks", "taps",
  "wings", "stocks", "findings", "folks",
  // `taxis` here is WordNet's surgical sense, but it is indistinguishable from
  // the plural of `taxi` (an A1 word already in the DB) on a flashcard.
  "taxis",
];

// Participial adjectives from the WordNet adjective cluster — thin study words
// whose base verb is already in the DB.
const DROP_PARTICIPLE = ["dated", "edged", "faced", "famed", "hired", "ruled", "tied", "timed"];

// Obscure short entries: Latin anatomical stubs, informal abbreviations, and a
// botanical name. `jaw`, `paw`→(see zoology), `ham`, `hop`, `ma`, `rep`, `tic`
// are left in — they are ordinary words.
const DROP_SHORT = ["os", "dug", "ala", "cos", "gen", "mac"];

// Non-human biology pulled in by walking WordNet hyponym trees. These are
// zoology and botany, not the clinical English a medical-pack learner wants.
// Reviewed by hand against the glosses: terms whose gloss merely *mentions* an
// animal or plant (elbow, membrane, organ, cortex, placenta, vagina, pore,
// limb, root canal, primary tooth, respiratory/skeletal/vascular system,
// cocaine, castor oil, botanical, poison ivy/oak, blackwater, milk sickness,
// hippocampus, parity) are kept.
const DROP_ZOOLOGY = [
  "air bladder", "air sac", "beak", "beard", "book lung", "claw", "comb",
  "compound eye", "costa", "dorsal fin", "external gill", "fang", "haw",
  "hind leg", "hind limb", "hoof", "horse's foot", "kat", "keel",
  "lateral line", "muzzle", "paw", "pelvic fin", "siphon", "snout", "stifle",
  "talon", "trotter", "tusk", "withers", "yolk sac",
];

const DROP_REASON = new Map<string, string>();
for (const [reason, list] of [
  ["marginal-sense duplicate of a word already in the DB", DROP_MARGINAL_SENSE],
  ["participial adjective, base verb already in the DB", DROP_PARTICIPLE],
  ["obscure abbreviation or Latin stub", DROP_SHORT],
  ["zoology/botany, not clinical vocabulary", DROP_ZOOLOGY],
] as const) {
  for (const w of list) DROP_REASON.set(w, reason);
}

type CrawlWord = {
  word: string;
  cefr: string;
  cefr_source: string;
  type_en?: string | null;
  definition_en?: string | null;
  extra_definitions?: string[];
  example?: string | null;
  synonyms?: string[];
  antonyms?: string[];
  topics?: string[];
  freq_rank?: number | null;
  source_ref?: string | null;
};
type CrawlPack = {
  metadata: {
    pack: string;
    title?: string;
    part?: number;
    created?: string;
    word_count?: number;
    sources?: Array<{ name?: string; url?: string; license?: string; accessed?: string }>;
    notes?: string;
  };
  words: CrawlWord[];
};

function toPackWord(w: CrawlWord, topics: string[]): PackWord {
  const out: PackWord = {
    word: normalizeWord(ALIAS[normalizeWord(w.word)] ?? w.word),
    cefr: w.cefr.toUpperCase(),
    // Corpus-frequency-derived, not from a published CEFR list. Import never
    // overwrites an existing cefr, so a curated value always beats this.
    cefr_source: "inferred",
    type_en: w.type_en ?? null,
    definition_en: w.definition_en ?? null,
    extra_definitions: w.extra_definitions ?? [],
    synonyms: w.synonyms ?? [],
    antonyms: w.antonyms ?? [],
    topics,
  };
  // Omit rather than write null: enrich fills these in later, and `example`
  // absent means "WordNet had none", not "the crawl failed".
  if (w.example) out.example = w.example;
  if (w.source_ref) out.source_ref = w.source_ref;
  if (typeof w.freq_rank === "number" && Number.isFinite(w.freq_rank)) out.rank = w.freq_rank;
  return out;
}

function main() {
  const packs: CrawlPack[] = JSON.parse(readFileSync(IN_FILE, "utf-8"));
  console.log(`${DRY_RUN ? "🔍 DRY RUN — " : ""}Converting ${IN_FILE}\n`);

  const dropped: Array<{ word: string; pack: string; cefr: string; reason: string; definition_en: string | null }> = [];
  const aliased: Array<{ from: string; to: string; pack: string }> = [];
  const seen = new Set<string>();
  let totalIn = 0;
  let totalOut = 0;

  for (const cp of packs) {
    const name = cp.metadata.pack;
    const topics = TOPIC_SLUGS[name];
    if (!topics) throw new Error(`No TOPIC_SLUGS entry for pack "${name}" — add one before importing it.`);

    const words: PackWord[] = [];
    for (const w of cp.words) {
      totalIn++;
      const key = normalizeWord(w.word);
      const reason = DROP_REASON.get(key);
      if (reason) {
        dropped.push({ word: key, pack: name, cefr: w.cefr, reason, definition_en: w.definition_en ?? null });
        continue;
      }
      if (ALIAS[key]) aliased.push({ from: key, to: ALIAS[key], pack: name });
      const pw = toPackWord(w, topics);
      // An alias can collide with a word the same batch already emitted.
      if (seen.has(pw.word)) {
        dropped.push({
          word: pw.word,
          pack: name,
          cefr: w.cefr,
          reason: "duplicate within the batch after aliasing",
          definition_en: w.definition_en ?? null,
        });
        continue;
      }
      seen.add(pw.word);
      words.push(pw);
    }

    const sources = cp.metadata.sources ?? [];
    const pack: PackFile = {
      metadata: {
        pack: name,
        topic_slugs: topics,
        source: sources.map((s) => s.name).filter(Boolean).join(" + ") || "2026-08-13 crawl batch",
        license: sources.map((s) => s.license).filter(Boolean).join(" | ") || "see data/SOURCES.md",
        generated: new Date().toISOString(),
        count: words.length,
      },
      words,
    };

    totalOut += words.length;
    const slugLabel = topics.length ? topics.join(",") : "(none — keyword topics via db:topics)";
    console.log(`  ${name.padEnd(20)} ${String(cp.words.length).padStart(5)} in → ${String(words.length).padStart(5)} out   topics: ${slugLabel}`);
    if (!DRY_RUN) writePack(pack);
  }

  console.log(`\n  total ${totalIn} in → ${totalOut} out (${totalIn - totalOut} dropped, ${aliased.length} aliased)`);

  if (aliased.length) {
    console.log("\nAliased to the spelling already in the DB (these now merge instead of creating a twin row):");
    for (const a of aliased) console.log(`  ${a.from} → ${a.to}  [${a.pack}]`);
  }

  const byReason: Record<string, number> = {};
  for (const d of dropped) byReason[d.reason] = (byReason[d.reason] ?? 0) + 1;
  console.log("\nDropped by reason:");
  for (const [r, n] of Object.entries(byReason)) console.log(`  ${String(n).padStart(3)}  ${r}`);

  // Committed so a later reader can see exactly what was filtered and undo it.
  if (!DRY_RUN) {
    mkdirSync(resolve(process.cwd(), "data/crawl-batches"), { recursive: true });
    writeFileSync(
      DROP_REPORT,
      JSON.stringify(
        {
          batch: "2026-08-13",
          input: IN_FILE.replace(process.cwd() + "/", ""),
          generated: new Date().toISOString(),
          totals: { in: totalIn, out: totalOut, dropped: dropped.length, aliased: aliased.length },
          aliased,
          dropped: dropped.sort((a, b) => a.word.localeCompare(b.word)),
        },
        null,
        2
      ) + "\n",
      "utf-8"
    );
    console.log(`\n📝 Drop report → ${DROP_REPORT.replace(process.cwd() + "/", "")}`);
  }

  const unusedDrops = [...DROP_REASON.keys()].filter((w) => !dropped.some((d) => d.word === w));
  if (unusedDrops.length) {
    console.log(`\n⚠ ${unusedDrops.length} drop-list entries matched nothing (stale list?): ${unusedDrops.join(", ")}`);
  }
  const unusedAlias = Object.keys(ALIAS).filter((w) => !aliased.some((a) => a.from === w));
  if (unusedAlias.length) console.log(`⚠ alias entries that matched nothing: ${unusedAlias.join(", ")}`);
}

main();
