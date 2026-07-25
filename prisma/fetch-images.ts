/* eslint-disable */
// Fetch a real thumbnail image URL per word from Wikipedia/Wikimedia Commons.
// Stores the URL in Word.imageUrl (overwriting the old Google-search link).
// Resumable: skips words that already have a real Wikimedia image.
import { PrismaClient } from "@prisma/client";
import https from "https";
import { readFileSync, writeFileSync, existsSync } from "fs";

const prisma = new PrismaClient();
const PROGRESS_FILE = "/tmp/img-progress.json";
const CONCURRENCY = 4;
const DELAY_MS = 250;
const WM = "https://upload.wikimedia.org";

process.on("unhandledRejection", (e) => console.error("unhandledRejection:", e));
process.on("uncaughtException", (e) => console.error("uncaughtException:", e));

function fetchJson(url: string, timeout = 8000): Promise<any> {
  return new Promise((res, rej) => {
    const req = https.get(
      url,
      { headers: { "User-Agent": "VocabMaster/1.0 (educational vocab app; contact@atelier.app)" }, timeout },
      (r) => {
        let d = "";
        r.on("data", (c) => (d += c));
        r.on("end", () => {
          try {
            res(JSON.parse(d));
          } catch (e) {
            rej(e);
          }
        });
      }
    );
    req.on("error", rej);
    req.on("timeout", () => req.destroy(new Error("timeout")));
  });
}

function titleCase(w: string): string {
  return w.charAt(0).toUpperCase() + w.slice(1);
}

async function fetchImage(word: string): Promise<string | null> {
  const url = `https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&prop=pageimages&piprop=thumbnail&pithumbsize=600&titles=${encodeURIComponent(
    titleCase(word)
  )}`;
  try {
    const data = await fetchJson(url);
    const pages = data?.query?.pages;
    if (pages) {
      for (const k of Object.keys(pages)) {
        const t = pages[k]?.thumbnail?.source;
        if (typeof t === "string" && t.startsWith(WM)) return t;
      }
    }
  } catch {}
  return null;
}

const done = new Set<string>();
if (existsSync(PROGRESS_FILE)) {
  try {
    for (const id of JSON.parse(readFileSync(PROGRESS_FILE, "utf-8"))) done.add(id);
  } catch {}
}
const save = () => writeFileSync(PROGRESS_FILE, JSON.stringify([...done]));

async function processWord(w: { id: string; word: string; imageUrl: string | null }) {
  const img = await fetchImage(w.word);
  await prisma.word.update({ where: { id: w.id }, data: { imageUrl: img } });
  done.add(w.id);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  console.log("🖼️  Fetching real image URLs from Wikipedia...\n");
  // Only words lacking a real Wikimedia image.
  const words = await prisma.word.findMany({
    where: { id: { notIn: [...done] }, OR: [{ imageUrl: null }, { imageUrl: { not: { startsWith: WM } } }] },
    select: { id: true, word: true, imageUrl: true },
    orderBy: { word: "asc" },
  });
  const total = words.length;
  console.log(`   ${total} words to process.`);
  if (!total) return console.log("✅ nothing to do");

  let processed = 0;
  let found = 0;
  const start = Date.now();
  let idx = 0;
  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (idx < words.length) {
      const w = words[idx++];
      try {
        await processWord(w);
        if (w.id in done) found++;
      } catch {}
      processed++;
      if (processed % 25 === 0) {
        const pct = ((processed / total) * 100).toFixed(1);
        const min = ((Date.now() - start) / 60000).toFixed(1);
        process.stdout.write(`\r   ${processed}/${total} (${pct}%) · ${min}min   `);
      }
      if (processed % 50 === 0) save();
      await sleep(DELAY_MS);
    }
  });
  await Promise.all(workers);
  save();

  const withImg = await prisma.word.count({ where: { imageUrl: { startsWith: WM } } });
  const all = await prisma.word.count();
  console.log(`\n\n✅ Done. Words with a real image: ${withImg}/${all} (${((withImg / all) * 100).toFixed(1)}%)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
