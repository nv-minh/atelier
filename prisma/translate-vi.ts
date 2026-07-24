/* eslint-disable */
// Batch-translate definitionEn + example to Vietnamese via Google Translate (free gtx endpoint).
// Resumable: progress saved to /tmp/vi-progress.json. Rate-limited with concurrency + delay.
import { PrismaClient } from "@prisma/client";
import { readFileSync, writeFileSync, existsSync } from "fs";
import https from "https";

const prisma = new PrismaClient();
const PROGRESS_FILE = "/tmp/vi-progress.json";
const CONCURRENCY = 3;
const DELAY_MS = 450;

// Never let a stray async rejection kill the run.
process.on("unhandledRejection", (e) => console.error("unhandledRejection:", e));
process.on("uncaughtException", (e) => console.error("uncaughtException:", e));

const done = new Set<string>(); // word ids already translated
if (existsSync(PROGRESS_FILE)) {
  try {
    const arr = JSON.parse(readFileSync(PROGRESS_FILE, "utf-8"));
    for (const id of arr) done.add(id);
  } catch {}
}
const saveProgress = () => writeFileSync(PROGRESS_FILE, JSON.stringify([...done]));

function fetchJson(url: string, timeout = 8000): Promise<any> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout }, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy(new Error("timeout"));
    });
  });
}

async function translate(text: string, retries = 2): Promise<string | null> {
  const clean = text?.trim();
  if (!clean) return null;
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=vi&dt=t&q=${encodeURIComponent(
    clean
  )}`;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const data = await fetchJson(url);
      // data[0] is an array of [translatedChunk, originalChunk, ...]
      if (Array.isArray(data) && Array.isArray(data[0])) {
        const translated = data[0]
          .map((seg: any) => (seg && seg[0]) || "")
          .join("")
          .trim();
        if (translated) return translated;
      }
      return null;
    } catch (e: any) {
      if (attempt === retries) return null;
      await sleep(800 * (attempt + 1)); // backoff
    }
  }
  return null;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function processWord(w: { id: string; word: string; definitionEn: string | null; example: string | null }) {
  const [defVi, exVi] = await Promise.all([
    w.definitionEn ? translate(w.definitionEn) : Promise.resolve(null),
    w.example ? translate(w.example) : Promise.resolve(null),
  ]);
  await prisma.word.update({
    where: { id: w.id },
    data: { definitionVi: defVi, exampleVi: exVi },
  });
  done.add(w.id);
  return { w, defVi, exVi };
}

async function main() {
  console.log("🌐 Translating definitions + examples → Vietnamese...\n");
  // Resume from DB state: only words still missing a VI translation.
  const words = await prisma.word.findMany({
    where: { definitionVi: null, id: { notIn: [...done] } },
    select: { id: true, word: true, definitionEn: true, example: true },
    orderBy: { word: "asc" },
  });
  const total = words.length;
  console.log(`   ${total} words remaining (${done.size} already done).`);
  if (total === 0) {
    console.log("✅ Nothing to do.");
    return;
  }

  let processed = 0;
  let failed = 0;
  const start = Date.now();
  const BATCH = 40;

  // simple concurrency pool
  let idx = 0;
  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (idx < words.length) {
      const i = idx++;
      const w = words[i];
      try {
        await processWord(w);
      } catch (e) {
        failed++;
      }
      processed++;
      if (processed % 10 === 0) {
        const pct = ((done.size / (done.size + total)) * 100).toFixed(1);
        const elapsedMin = ((Date.now() - start) / 60000).toFixed(1);
        process.stdout.write(
          `\r   ${done.size}/${done.size + total} (${pct}%) · ${elapsedMin}min · ❌${failed}   `
        );
      }
      if (processed % BATCH === 0) saveProgress();
      await sleep(DELAY_MS);
    }
  });

  await Promise.all(workers);
  saveProgress();

  console.log("\n\n✅ Translation complete!");
  console.log(`   Translated: ${done.size} words | errors: ${failed}`);
  // sample
  const sample = await prisma.word.findMany({
    where: { definitionVi: { not: null } },
    take: 3,
    select: { word: true, definitionEn: true, definitionVi: true, example: true, exampleVi: true },
  });
  for (const s of sample) {
    console.log(`\n   ${s.word}`);
    console.log(`     EN: ${s.definitionEn}`);
    console.log(`     VI: ${s.definitionVi}`);
    if (s.example) console.log(`     ex EN: ${s.example}`);
    if (s.exampleVi) console.log(`     ex VI: ${s.exampleVi}`);
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
