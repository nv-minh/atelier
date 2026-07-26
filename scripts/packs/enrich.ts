/* eslint-disable */
// Fill missing IPA / definitions / examples / synonyms on pack skeletons via
// dictionaryapi.dev (the same source the app's runtime audio fallback uses),
// with kaikki.org (Wiktionary extract) as fallback for jargon the API lacks.
// Every response — including 404s — is cached under data/cache/, so re-runs
// only hit the network for words never seen before.
import { cacheGet, cacheSet } from "./lib/cache";
import { fetchJson, fetchText, isNotFound, sleep } from "./lib/http";
import { PackWord, packExists, packsFromArgv, readPack, writePack } from "./lib/formats";

const CONCURRENCY = 2;
const DELAY_MS = 450;
const COMPUTING = /comput|software|program|network|data|internet|digital|code|web|server|electronic/i;

process.on("unhandledRejection", (e) => console.error("unhandledRejection:", e));

type DictApiEntry = {
  word: string;
  phonetic?: string;
  phonetics?: Array<{ text?: string; audio?: string }>;
  meanings?: Array<{
    partOfSpeech?: string;
    definitions?: Array<{ definition?: string; example?: string; synonyms?: string[]; antonyms?: string[] }>;
    synonyms?: string[];
    antonyms?: string[];
  }>;
};

async function dictApi(word: string): Promise<DictApiEntry[] | null> {
  const cached = cacheGet<any>("dictapi", word);
  if (cached) return cached.miss ? null : cached.data;
  try {
    const data = await fetchJson(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`,
      { timeoutMs: 10000 }
    );
    cacheSet("dictapi", word, { data });
    return data;
  } catch (e) {
    if (isNotFound(e)) {
      cacheSet("dictapi", word, { miss: true });
      return null;
    }
    throw e;
  }
}

type KaikkiSense = { glosses?: string[]; categories?: Array<{ name?: string } | string>; tags?: string[] };
type KaikkiEntry = { word: string; pos?: string; senses?: KaikkiSense[]; sounds?: Array<{ ipa?: string }> };

async function kaikki(word: string): Promise<KaikkiEntry[] | null> {
  const cached = cacheGet<any>("kaikki", word);
  if (cached) return cached.miss ? null : cached.data;
  const a = word[0];
  const ab = word.length > 1 ? word.slice(0, 2) : word[0];
  const url = `https://kaikki.org/dictionary/English/meaning/${encodeURIComponent(a)}/${encodeURIComponent(
    ab
  )}/${encodeURIComponent(word)}.json`;
  try {
    // JSONL: one entry per line per part of speech.
    const text = await fetchText(url, { timeoutMs: 10000 });
    const data = text
      .split("\n")
      .filter((l) => l.trim())
      .map((l) => JSON.parse(l));
    cacheSet("kaikki", word, { data });
    return data;
  } catch (e) {
    if (isNotFound(e)) {
      cacheSet("kaikki", word, { miss: true });
      return null;
    }
    throw e;
  }
}

function senseText(s: KaikkiSense): string {
  return (s.glosses ?? []).join("; ");
}

function isComputingSense(s: KaikkiSense): boolean {
  const cats = (s.categories ?? [])
    .map((c) => (typeof c === "string" ? c : c?.name ?? ""))
    .join(" ");
  return COMPUTING.test(cats) || COMPUTING.test(senseText(s));
}

// Merge dictionaryapi.dev data into a skeleton, filling only missing fields.
function applyDictApi(w: PackWord, entries: DictApiEntry[], preferComputing: boolean): void {
  const entry = entries[0];
  if (!entry) return;

  const meanings = entry.meanings ?? [];
  let meaning = meanings[0];
  let def = meaning?.definitions?.[0];
  if (preferComputing) {
    outer: for (const m of meanings) {
      for (const d of m.definitions ?? []) {
        if (d.definition && COMPUTING.test(d.definition)) {
          meaning = m;
          def = d;
          break outer;
        }
      }
    }
  }

  if (!w.type_en && meaning?.partOfSpeech) w.type_en = meaning.partOfSpeech;
  if (!w.definition_en && def?.definition) w.definition_en = def.definition;

  if (!w.extra_definitions?.length) {
    const extras: string[] = [];
    for (const m of meanings) {
      for (const d of m.definitions ?? []) {
        if (d.definition && d.definition !== w.definition_en && extras.length < 3) {
          extras.push(`[${m.partOfSpeech ?? "?"}] ${d.definition}`);
        }
      }
    }
    w.extra_definitions = extras;
  }

  if (!w.example) {
    for (const m of meanings) {
      const ex = m.definitions?.find((d) => d.example)?.example;
      if (ex) {
        w.example = ex;
        break;
      }
    }
  }

  if (!w.synonyms?.length) {
    const syns = new Set<string>();
    for (const m of meanings) {
      for (const s of m.synonyms ?? []) syns.add(s);
      for (const d of m.definitions ?? []) for (const s of d.synonyms ?? []) syns.add(s);
    }
    w.synonyms = [...syns].slice(0, 6);
  }
  if (!w.antonyms?.length) {
    const ants = new Set<string>();
    for (const m of meanings) {
      for (const a of m.antonyms ?? []) ants.add(a);
      for (const d of m.definitions ?? []) for (const a of d.antonyms ?? []) ants.add(a);
    }
    w.antonyms = [...ants].slice(0, 6);
  }

  const phon = entry.phonetics?.filter((p) => p.text) ?? [];
  const uk = phon.find((p) => p.audio?.includes("-uk"))?.text ?? entry.phonetic ?? phon[0]?.text;
  const us = phon.find((p) => p.audio?.includes("-us"))?.text ?? entry.phonetic ?? phon[0]?.text;
  if (!w.ipa_uk && uk) w.ipa_uk = uk;
  if (!w.ipa_us && us) w.ipa_us = us;

  if (!w.audio?.uk && !w.audio?.us) {
    const audioUk = entry.phonetics?.find((p) => p.audio?.includes("-uk"))?.audio;
    const audioUs = entry.phonetics?.find((p) => p.audio?.includes("-us"))?.audio;
    if (audioUk || audioUs) w.audio = { uk: audioUk ?? null, us: audioUs ?? null };
  }
}

function applyKaikki(w: PackWord, entries: KaikkiEntry[], preferComputing: boolean): void {
  let pick: { entry: KaikkiEntry; sense: KaikkiSense } | null = null;
  if (preferComputing) {
    for (const e of entries) {
      const s = (e.senses ?? []).find(isComputingSense);
      if (s) {
        pick = { entry: e, sense: s };
        break;
      }
    }
  }
  if (!pick) {
    const e = entries.find((x) => x.senses?.length);
    const s = e?.senses?.[0];
    if (e && s) pick = { entry: e, sense: s };
  }
  if (!pick) return;

  if (!w.definition_en) {
    const g = senseText(pick.sense);
    if (g) w.definition_en = g;
  }
  if (!w.type_en && pick.entry.pos) w.type_en = pick.entry.pos;
  if (!w.ipa_uk && !w.ipa_us) {
    const ipa = entries.flatMap((e) => e.sounds ?? []).find((s) => s.ipa)?.ipa;
    if (ipa) {
      w.ipa_uk = ipa;
      w.ipa_us = ipa;
    }
  }
}

function needsEnrichment(w: PackWord): boolean {
  return !w.definition_en || !(w.ipa_uk || w.ipa_us) || !w.example;
}

async function enrichPack(name: string): Promise<void> {
  const pack = readPack(name);
  const preferComputing = name === "it-programming";
  const todo = pack.words.filter(needsEnrichment);
  console.log(`\n${name}: ${todo.length}/${pack.words.length} words need enrichment`);
  if (todo.length === 0) return;

  let idx = 0;
  let done = 0;
  let misses = 0;
  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (idx < todo.length) {
      const w = todo[idx++];
      try {
        const entries = await dictApi(w.word);
        if (entries) applyDictApi(w, entries, preferComputing);
        if (!w.definition_en) {
          const kk = await kaikki(w.word);
          if (kk) applyKaikki(w, kk, preferComputing);
        }
        if (!w.definition_en) misses++;
      } catch (e: any) {
        console.error(`\n  ! ${w.word}: ${e?.message ?? e}`);
      }
      done++;
      if (done % 25 === 0) {
        process.stdout.write(`\r  ${done}/${todo.length} · no-def: ${misses}   `);
        writePack(pack); // checkpoint so an abort loses at most 25 words of work
      }
      await sleep(DELAY_MS);
    }
  });
  await Promise.all(workers);
  writePack(pack);

  const stillMissing = pack.words.filter((w) => !w.definition_en).map((w) => w.word);
  console.log(`\r  done. ${stillMissing.length} words still lack a definition.`);
  if (stillMissing.length) console.log(`  missing: ${stillMissing.slice(0, 30).join(", ")}${stillMissing.length > 30 ? " …" : ""}`);
}

async function main() {
  for (const name of packsFromArgv()) {
    if (!packExists(name)) {
      console.log(`${name}: no pack file — run packs:build first (skipped)`);
      continue;
    }
    await enrichPack(name);
  }
  console.log("\n✅ Enrichment complete.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
