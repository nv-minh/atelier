/* eslint-disable */
// Download all raw sources for the pack pipeline into data/raw/.
// Idempotent: a file already on disk (and non-trivially sized) is skipped, so
// no upstream is ever re-hit. Raw files are gitignored; the committed artifacts
// are the derived data/packs/*.json.
//
// Sources & licenses are documented in data/SOURCES.md.
import { existsSync, mkdirSync, statSync, writeFileSync } from "fs";
import { resolve } from "path";
import { BROWSER_UA, UA, decodeSmart, fetchText, sleep } from "./lib/http";
import { RAW_DIR } from "./lib/formats";

type Source = { file: string; url: string; ua?: string; note: string };

const SOURCES: Source[] = [
  {
    file: "oxford_5000.json",
    url: "https://raw.githubusercontent.com/winterdl/oxford-5000-vocabulary-audio-definition/main/data/oxford_5000.json",
    note: "Oxford 5000 with CEFR (incl. C1), IPA, definitions, examples, audio filenames",
  },
  {
    file: "word_list_cefr.csv",
    url: "https://raw.githubusercontent.com/Maximax67/Words-CEFR-Dataset/main/datasets/word_list_cefr.csv",
    note: "CEFR level lookup for words outside Oxford 5000 (MIT, CEFR-J based)",
  },
  {
    // The GENERAL frequency list, and the top-priority source for Word.freqPct.
    // It is what makes a percentile comparable across the whole vocabulary
    // rather than only within one domain pack — see prisma/backfill-freq.ts.
    file: "NGSL_12_stats.csv",
    url: "https://www.newgeneralservicelist.com/s/NGSL_12_stats.csv",
    ua: BROWSER_UA,
    note: "NGSL 1.2 — general high-frequency English, with frequency ranks (CC BY 3.0)",
  },
  {
    file: "NGSL_Spoken_12_stats.csv",
    url: "https://www.newgeneralservicelist.com/s/NGSL-Spoken_12_stats.csv",
    ua: BROWSER_UA, // Squarespace 404s non-browser UAs on /s/ static links
    note: "NGSL-Spoken 1.2 — high-frequency spoken English (CC BY 3.0)",
  },
  {
    file: "BSL_120_stats.csv",
    url: "https://www.newgeneralservicelist.com/s/BSL_120_stats.csv",
    ua: BROWSER_UA,
    note: "Business Service List 1.2 (CC BY 3.0)",
  },
  {
    file: "TSL_12_stats.csv",
    url: "https://www.newgeneralservicelist.com/s/TSL_12_stats.csv",
    ua: BROWSER_UA,
    note: "TOEIC Service List 1.2 (CC BY 3.0)",
  },
  {
    file: "anhviet.json",
    url: "https://raw.githubusercontent.com/iamstevendao/superfast-dictionary/master/app/src/main/assets/anhviet.json",
    note: "EN-VI dictionary (OVDP / Ho Ngoc Duc data, StarDict-derived; ~52MB)",
  },
];

async function main() {
  mkdirSync(RAW_DIR, { recursive: true });
  for (const s of SOURCES) {
    const dest = resolve(RAW_DIR, s.file);
    if (existsSync(dest) && statSync(dest).size > 1000) {
      console.log(`✓ ${s.file} (cached, ${(statSync(dest).size / 1024).toFixed(0)} KB)`);
      continue;
    }
    console.log(`↓ ${s.file} — ${s.note}`);
    const res = await fetch(s.url, {
      headers: { "User-Agent": s.ua ?? UA },
      signal: AbortSignal.timeout(120000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${s.url}`);
    const text = decodeSmart(new Uint8Array(await res.arrayBuffer()));
    // Squarespace serves an HTML error page with status 200 on some misses.
    if (text.trimStart().startsWith("<!doctype") || text.trimStart().startsWith("<html")) {
      throw new Error(`Got HTML instead of data for ${s.url} — link layout may have changed`);
    }
    writeFileSync(dest, text, "utf-8");
    console.log(`  saved ${(text.length / 1024).toFixed(0)} KB`);
    await sleep(500);
  }
  console.log("\n✅ All sources present in data/raw/");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
