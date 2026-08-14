/* eslint-disable */
// Emit a Zipf frequency for every word in the DB, into data/raw/wordfreq_zipf.csv.
//
// Why this is a separate fetch step rather than part of a crawl batch: the
// 2026-08-13 crawl carried no frequency at all (`freq_rank` was null on all 2,996
// rows), so waiting for "the next batch to emit Zipf" left 2,813 words unranked
// indefinitely. Reading the word list from the DB instead means this reaches every
// word however it arrived — seed data, a pack, or a future crawl.
//
// Zipf = log10(occurrences per billion words), roughly 0–8. It is an ABSOLUTE
// scale, unlike the per-list ranks the other sources carry; freqPctFromZipf is
// where that difference is reconciled before anything reaches the database.
//
// Requires Python 3 with the `wordfreq` package (MIT):
//   pip3 install wordfreq
// Not a Node dependency because no JS port carries the same corpora. The CSV it
// writes is a plain artifact — db:backfill-freq simply skips the tier if absent.
//
// Usage: tsx scripts/packs/fetch-wordfreq.ts
import "../../prisma/load-env";
import { PrismaClient } from "@prisma/client";
import { spawnSync } from "child_process";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import { resolve } from "path";
import { RAW_DIR, normalizeWord } from "./lib/formats";

const OUT = resolve(RAW_DIR, "wordfreq_zipf.csv");

// Reads one word per line on stdin, prints "word\tzipf" per line. Kept inline so
// the whole step is one file and there is no second script to keep in sync.
const PY = `
import sys
from wordfreq import zipf_frequency
for line in sys.stdin:
    w = line.rstrip("\\n")
    if not w:
        continue
    print(f"{w}\\t{zipf_frequency(w, 'en'):.2f}")
`;

async function main() {
  const prisma = new PrismaClient();
  let words: string[];
  try {
    const rows = await prisma.word.findMany({ select: { word: true }, orderBy: { word: "asc" } });
    words = rows.map((r) => normalizeWord(r.word));
  } finally {
    await prisma.$disconnect();
  }
  console.log(`${words.length} words from the DB → asking wordfreq for a Zipf value each`);

  const py = spawnSync("python3", ["-c", PY], { input: words.join("\n"), encoding: "utf-8", maxBuffer: 64 << 20 });
  if (py.error || py.status !== 0) {
    console.error("\n❌ python3 + wordfreq is required for this step.");
    console.error("   Install it with:  pip3 install wordfreq");
    if (py.stderr) console.error(py.stderr.split("\n").slice(-5).join("\n"));
    process.exit(1);
  }

  const lines = py.stdout.split("\n").filter(Boolean);
  let unknown = 0;
  const out = ["Word,Zipf"];
  for (const line of lines) {
    const [word, zipf] = line.split("\t");
    if (!word || zipf === undefined) continue;
    // 0.00 means the corpora have never seen the word. Kept in the file rather
    // than dropped so a re-run does not look like the word went missing; the
    // backfill turns it into "leave freqPct null" instead of "rarest possible".
    if (Number(zipf) <= 0) unknown++;
    out.push(`${word},${zipf}`);
  }

  if (!existsSync(RAW_DIR)) mkdirSync(RAW_DIR, { recursive: true });
  writeFileSync(OUT, out.join("\n") + "\n");
  console.log(`✅ ${out.length - 1} rows → ${OUT}`);
  console.log(`   ${unknown} word(s) unknown to wordfreq (zipf 0) — those stay freqPct = null`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
