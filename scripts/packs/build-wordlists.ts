/* eslint-disable */
// Normalize each raw source into a skeleton pack file under data/packs/.
// Skeletons carry whatever the source already provides (Oxford entries arrive
// nearly complete); enrich.ts and translate-packs.ts fill the gaps.
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { decodeSmart } from "./lib/http";
import { PackFile, PackWord, RAW_DIR, normalizeWord, writePack, packsFromArgv } from "./lib/formats";

// Same audio host the app already uses at runtime (src/lib/utils.ts AUDIO_BASE).
const AUDIO_BASE =
  "https://raw.githubusercontent.com/winterdl/oxford-5000-vocabulary-audio-definition/main/audio/";

const LEVEL_ORDER = ["A1", "A2", "B1", "B2", "C1"] as const;

type OxfordEntry = {
  word: string;
  type: string;
  cefr: string; // lowercase a1..c1
  phon_br: string;
  phon_n_am: string;
  definition: string;
  example: string;
  uk: string;
  us: string;
};

function raw(file: string): string {
  return decodeSmart(readFileSync(resolve(RAW_DIR, file)));
}

// ── Oxford 5000: entry list + per-word lookup ────────────────────────
function loadOxford(): { entries: OxfordEntry[]; byWord: Map<string, OxfordEntry[]> } {
  const obj = JSON.parse(raw("oxford_5000.json")) as Record<string, OxfordEntry>;
  const entries = Object.values(obj).filter((e) => e.word && e.cefr);
  const byWord = new Map<string, OxfordEntry[]>();
  for (const e of entries) {
    const w = normalizeWord(e.word);
    if (!byWord.has(w)) byWord.set(w, []);
    byWord.get(w)!.push(e);
  }
  return { entries, byWord };
}

// ── CEFR-J dataset: word -> easiest CEFR level seen ──────────────────
function loadCefrDataset(): Map<string, string> {
  const map = new Map<string, string>();
  for (const line of raw("word_list_cefr.csv").split("\n").slice(1)) {
    const [headword, , level] = line.split(";");
    if (!headword || !level) continue;
    const w = normalizeWord(headword);
    const lvl = level.trim().toUpperCase() === "C2" ? "C1" : level.trim().toUpperCase();
    if (!(LEVEL_ORDER as readonly string[]).includes(lvl)) continue;
    const prev = map.get(w);
    if (!prev || LEVEL_ORDER.indexOf(lvl as any) < LEVEL_ORDER.indexOf(prev as any)) {
      map.set(w, lvl);
    }
  }
  return map;
}

// Minimal CSV row parser — the NGSL family files have no quoted fields.
function csvRows(file: string): string[][] {
  return raw(file)
    .split(/\r?\n/)
    .slice(1)
    .map((l) => l.split(",").map((c) => c.trim()))
    .filter((r) => r[0]);
}

// Skeleton from an Oxford entry group (first entry = primary, extra POS
// entries become extra_definitions) — mirrors how data/vocabulary.json was built.
function fromOxford(group: OxfordEntry[], topics: string[]): PackWord {
  const p = group[0];
  return {
    word: normalizeWord(p.word),
    cefr: p.cefr.toUpperCase(),
    cefr_source: "oxford",
    type_en: p.type || null,
    ipa_uk: p.phon_br || null,
    ipa_us: p.phon_n_am || null,
    definition_en: p.definition || null,
    extra_definitions: group
      .slice(1)
      .filter((e) => e.definition)
      .map((e) => `[${e.type}] ${e.definition}`),
    example: p.example || null,
    synonyms: [],
    antonyms: [],
    topics,
    audio: {
      uk: p.uk ? AUDIO_BASE + p.uk : null,
      us: p.us ? AUDIO_BASE + p.us : null,
    },
  };
}

function estimateCefr(
  word: string,
  rank: number,
  listSize: number,
  oxford: Map<string, OxfordEntry[]>,
  cefrData: Map<string, string>,
  kind: "spoken" | "specialized"
): { cefr: string; source: PackWord["cefr_source"] } {
  const ox = oxford.get(word);
  if (ox) return { cefr: ox[0].cefr.toUpperCase(), source: "oxford" };
  const ds = cefrData.get(word);
  if (ds) return { cefr: ds, source: "cefr-dataset" };
  if (kind === "spoken") return { cefr: rank <= 400 ? "A2" : "B1", source: "rank-estimate" };
  return { cefr: rank <= listSize / 3 ? "B1" : "B2", source: "rank-estimate" };
}

// Rank-list packs (NGSL-Spoken / BSL / TSL) share one shape: word + rank CSV,
// skeleton pre-filled from Oxford when the word is in Oxford 5000.
function buildRankPack(
  meta: PackFile["metadata"],
  rows: Array<{ word: string; rank: number }>,
  oxford: Map<string, OxfordEntry[]>,
  cefrData: Map<string, string>,
  kind: "spoken" | "specialized"
): PackFile {
  const seen = new Set<string>();
  const words: PackWord[] = [];
  for (const { word, rank } of rows) {
    const w = normalizeWord(word);
    if (!w || seen.has(w)) continue;
    seen.add(w);
    const { cefr, source } = estimateCefr(w, rank, rows.length, oxford, cefrData, kind);
    const ox = oxford.get(w);
    const base: PackWord = ox
      ? fromOxford(ox, meta.topic_slugs)
      : {
          word: w,
          cefr,
          cefr_source: source,
          topics: meta.topic_slugs,
          synonyms: [],
          antonyms: [],
          extra_definitions: [],
        };
    base.cefr = cefr;
    base.cefr_source = source;
    base.rank = rank;
    words.push(base);
  }
  return { metadata: meta, words };
}

const GENERATED = new Date().toISOString();

function main() {
  const which = new Set(packsFromArgv());
  const { entries, byWord } = loadOxford();
  const cefrData = loadCefrDataset();

  // ── oxford-c1: the C1 slice of Oxford 5000 ─────────────────────────
  if (which.has("oxford-c1")) {
    const c1 = entries.filter((e) => e.cefr === "c1");
    const grouped = new Map<string, OxfordEntry[]>();
    for (const e of c1) {
      const w = normalizeWord(e.word);
      if (!grouped.has(w)) grouped.set(w, []);
      grouped.get(w)!.push(e);
    }
    writePack({
      metadata: {
        pack: "oxford-c1",
        topic_slugs: [], // level extension, not a topic pack
        source: "Oxford 5000 via winterdl/oxford-5000-vocabulary-audio-definition",
        license: "Oxford University Press word list; repo already used by the app for audio",
        generated: GENERATED,
        count: 0,
      },
      words: [...grouped.values()].map((g) => fromOxford(g, [])),
    });
    console.log(`oxford-c1: ${grouped.size} words`);
  }

  // ── conversation: NGSL-Spoken 1.2 ──────────────────────────────────
  if (which.has("conversation")) {
    const rows = csvRows("NGSL_Spoken_12_stats.csv").map((r) => ({
      word: r[0],
      rank: Number(r[1]) || 0,
    }));
    const pack = buildRankPack(
      {
        pack: "conversation",
        topic_slugs: ["conversation"],
        source: "NGSL-Spoken 1.2 (newgeneralservicelist.com)",
        license: "CC BY 3.0 — Browne, C., Culligan, B. & Phillips, J.",
        generated: GENERATED,
        count: 0,
      },
      rows,
      byWord,
      cefrData,
      "spoken"
    );
    writePack(pack);
    console.log(`conversation: ${pack.words.length} words`);
  }

  // ── business: BSL 1.2 ──────────────────────────────────────────────
  if (which.has("business")) {
    const rows = csvRows("BSL_120_stats.csv").map((r) => ({ word: r[0], rank: Number(r[1]) || 0 }));
    const pack = buildRankPack(
      {
        pack: "business",
        topic_slugs: ["business"],
        source: "Business Service List 1.2 (newgeneralservicelist.com)",
        license: "CC BY 3.0 — Browne, C. & Culligan, B.",
        generated: GENERATED,
        count: 0,
      },
      rows,
      byWord,
      cefrData,
      "specialized"
    );
    writePack(pack);
    console.log(`business: ${pack.words.length} words`);
  }

  // ── toeic: TSL 1.2 ─────────────────────────────────────────────────
  if (which.has("toeic")) {
    const rows = csvRows("TSL_12_stats.csv").map((r) => ({ word: r[0], rank: Number(r[1]) || 0 }));
    const pack = buildRankPack(
      {
        pack: "toeic",
        topic_slugs: ["toeic"],
        source: "TOEIC Service List 1.2 (newgeneralservicelist.com)",
        license: "CC BY 3.0 — Browne, C. & Culligan, B.",
        generated: GENERATED,
        count: 0,
      },
      rows,
      byWord,
      cefrData,
      "specialized"
    );
    writePack(pack);
    console.log(`toeic: ${pack.words.length} words`);
  }

  // ── it-programming: hand-curated seed list ─────────────────────────
  if (which.has("it-programming")) {
    const seedPath = resolve(process.cwd(), "data/sources/it-terms.json");
    if (!existsSync(seedPath)) {
      console.log("it-programming: data/sources/it-terms.json missing — skipped");
      return;
    }
    const seed = JSON.parse(readFileSync(seedPath, "utf-8")) as {
      terms: Array<{ term: string; category: string; cefr?: string; definition_en?: string }>;
    };
    const seen = new Set<string>();
    const words: PackWord[] = [];
    for (const t of seed.terms) {
      const w = normalizeWord(t.term);
      if (!w || seen.has(w)) continue;
      seen.add(w);
      const ox = byWord.get(w);
      const base: PackWord = ox
        ? fromOxford(ox, ["it-programming"])
        : {
            word: w,
            cefr: "B2",
            cefr_source: "default",
            topics: ["it-programming"],
            synonyms: [],
            antonyms: [],
            extra_definitions: [],
          };
      if (t.cefr) {
        base.cefr = t.cefr.toUpperCase();
        base.cefr_source = "seed";
      } else if (ox) {
        base.cefr = ox[0].cefr.toUpperCase();
        base.cefr_source = "oxford";
      }
      // Seed override wins: computing sense beats the general dictionary sense.
      if (t.definition_en) {
        if (base.definition_en && base.definition_en !== t.definition_en) {
          base.extra_definitions = [
            `[${base.type_en ?? "general"}] ${base.definition_en}`,
            ...(base.extra_definitions ?? []),
          ];
        }
        base.definition_en = t.definition_en;
      }
      words.push(base);
    }
    writePack({
      metadata: {
        pack: "it-programming",
        topic_slugs: ["it-programming"],
        source: "Curated in-repo list (data/sources/it-terms.json), informed by CSWL",
        license: "Project-authored; fallback definitions from Wiktionary (CC BY-SA)",
        generated: GENERATED,
        count: 0,
      },
      words,
    });
    console.log(`it-programming: ${words.length} words`);
  }
}

main();
