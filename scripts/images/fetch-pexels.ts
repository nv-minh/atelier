/* eslint-disable */
// Backfill Word images from the Pexels API into data/images.json (the durable,
// committed word → image-URL artifact). Reads the DB but NEVER writes it —
// prisma/apply-images.ts pushes images.json into Word.imageUrl.
//
// Selection is driven by images.json, not the DB: any DB word without an entry
// gets fetched, so the script is resumable across multi-day runs and immune to
// legacy junk values in Word.imageUrl. Existing real images (Wikimedia/Pexels)
// found in the DB are synced into images.json first so they become durable too.
//
// Paced with a fixed BASE_DELAY_MS between requests, backing off on real 429s
// (a short-window burst limiter, observed independently of the account's much
// larger overall quota). x-ratelimit-reset is NOT trusted for pacing — it has
// been observed returning nonsense (a date in the past; separately, a date
// ~356 days out) even on 200 responses, so a bad value can never translate
// into a multi-day sleep (see saneResetDelayMs). Raw responses (including
// empty results) are cached under data/cache/pexels/ so reruns never re-hit
// the API for a word.
//
// Usage:
//   npm run images:fetch                  # full run (resumable, Ctrl-C safe)
//   npm run images:fetch -- --limit 20    # smoke test
//   npm run images:fetch -- --word cat    # single-word debug
//   npm run images:fetch -- --retry-misses  # re-try words Pexels had 0 results for
import "../../prisma/load-env";
import { PrismaClient } from "@prisma/client";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve } from "path";
import { cacheGet, cacheSet } from "../packs/lib/cache";
import { UA, sleep } from "../packs/lib/http";

const prisma = new PrismaClient();

const IMAGES_FILE = resolve(process.cwd(), "data/images.json");
const REAL_IMAGE_PREFIXES = ["https://upload.wikimedia.org", "https://images.pexels.com/"];
const BASE_DELAY_MS = 700;
const MIN_DELAY_MS = 500;
const MAX_DELAY_MS = 6000; // never crawl slower than ~10/min — higher just wastes the key's quota
// Base sleep on a 429. 60s wasted ~45s per penalty if the burst window is
// shorter (observed ~5-req bursts); 20s probes the window faster and the
// exponential backoff still escalates (20→40→80s…) if 429s persist.
const BASE_429_SLEEP_MS = 20000;
const CHECKPOINT_EVERY = 25;

type ImageEntry = {
  url: string | null;
  source: "wikimedia" | "pexels" | "none";
  photoId?: number;
  photographer?: string;
  pexelsUrl?: string;
};
type ImagesFile = {
  metadata: { generated: string; counts: Record<string, number> };
  images: Record<string, ImageEntry>;
};

// Plain-object lookup: `images[word]` for word "constructor" (a real IT-pack
// entry) silently returns Object.prototype.constructor instead of undefined.
// Guard every read with hasOwnProperty so such words aren't mistaken as done.
function getEntry(images: Record<string, ImageEntry>, word: string): ImageEntry | undefined {
  return Object.prototype.hasOwnProperty.call(images, word) ? images[word] : undefined;
}

function loadImagesFile(path: string = IMAGES_FILE): ImagesFile {
  if (existsSync(path)) {
    return JSON.parse(readFileSync(path, "utf-8"));
  }
  return { metadata: { generated: "", counts: {} }, images: {} };
}

function saveImagesFile(f: ImagesFile, path: string = IMAGES_FILE): void {
  const counts: Record<string, number> = { wikimedia: 0, pexels: 0, none: 0 };
  for (const e of Object.values(f.images)) counts[e.source] = (counts[e.source] ?? 0) + 1;
  const sorted: Record<string, ImageEntry> = {};
  for (const k of Object.keys(f.images).sort()) sorted[k] = f.images[k];
  const out: ImagesFile = {
    metadata: { generated: new Date().toISOString(), counts },
    images: sorted,
  };
  writeFileSync(path, JSON.stringify(out, null, 1));
}

function realPrefix(url: string | null): boolean {
  return !!url && REAL_IMAGE_PREFIXES.some((p) => url.startsWith(p));
}

// --- Pexels API -------------------------------------------------------------

type PexelsResult = { json: any; remaining: number; resetDelayMs: number | undefined };

// Pexels' x-ratelimit-reset has been observed returning nonsense (a date in
// the past, and separately a date ~356 days out) even on plain 200 responses,
// so it is NOT used for pacing — only kept here for optional diagnostics, and
// only trusted if it resolves to a small, sane, strictly-future offset.
const MAX_SANE_RESET_MS = 60 * 60 * 1000; // 1 hour

function saneResetDelayMs(resetHeader: string | null): number | undefined {
  const resetAtMs = Number(resetHeader ?? NaN) * 1000;
  if (Number.isNaN(resetAtMs)) return undefined;
  const delta = resetAtMs - Date.now();
  return delta > 0 && delta <= MAX_SANE_RESET_MS ? delta : undefined;
}

async function pexelsSearch(apiKey: string, word: string): Promise<PexelsResult> {
  const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(word)}&per_page=1`;
  const res = await fetch(url, {
    headers: { Authorization: apiKey, "User-Agent": UA },
    signal: AbortSignal.timeout(20000),
  });
  const remaining = Number(res.headers.get("x-ratelimit-remaining") ?? NaN);
  const resetDelayMs = saneResetDelayMs(res.headers.get("x-ratelimit-reset"));
  if (res.status === 429) {
    const err: any = new Error("429");
    err.rateLimited = true;
    err.resetDelayMs = resetDelayMs;
    throw err;
  }
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${word}`);
  return { json: await res.json(), remaining, resetDelayMs };
}

function entryFromResponse(json: any): ImageEntry {
  const photo = json?.photos?.[0];
  if (!photo?.src?.large) return { url: null, source: "none" };
  return {
    url: photo.src.large,
    source: "pexels",
    photoId: photo.id,
    photographer: photo.photographer,
    pexelsUrl: photo.url,
  };
}

// --- main -------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  const flag = (name: string) => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const limit = flag("--limit") ? Number(flag("--limit")) : Infinity;
  const onlyWord = flag("--word");
  const retryMisses = args.includes("--retry-misses");

  // Parallel mode: `--worker I/N` runs N disjoint shards concurrently, each with
  // its OWN key (PEXELS_API_KEY_<I+1>) and OWN output file (data/images-part-I.json),
  // so workers never share a quota or fight over one JSON file. Merge the part
  // files back into images.json with `npm run images:merge` when done.
  const workerArg = flag("--worker"); // "I/N", e.g. "0/3"
  const sharded = !!workerArg;
  let workerI = 0;
  let workerN = 1;
  if (sharded) {
    const [a, b] = workerArg!.split("/");
    workerI = Number(a);
    workerN = Number(b);
    if (!Number.isInteger(workerI) || !Number.isInteger(workerN) || workerI < 0 || workerI >= workerN) {
      console.error(`❌ invalid --worker "${workerArg}" (expected "I/N", 0<=I<N)`);
      process.exit(1);
    }
  }

  // PrismaClient's generated code has already loaded .env into process.env.
  const apiKey = sharded ? process.env[`PEXELS_API_KEY_${workerI + 1}`] : process.env.PEXELS_API_KEY;
  if (!apiKey) {
    const want = sharded ? `PEXELS_API_KEY_${workerI + 1}` : "PEXELS_API_KEY";
    console.error(`❌ ${want} missing. Add it to .env (free key: https://www.pexels.com/api/).`);
    process.exit(1);
  }

  // `global` = images.json (read-only reference for the done-set in sharded mode;
  // never written by a shard). `file` = the object this process writes to:
  // the shard's part file in sharded mode, or images.json itself otherwise.
  const global = loadImagesFile(IMAGES_FILE);
  const outPath = sharded ? resolve(process.cwd(), `data/images-part-${workerI}.json`) : IMAGES_FILE;
  const file = sharded ? loadImagesFile(outPath) : global;
  const tag = sharded ? `[w${workerI}] ` : "";
  console.log(`${tag}🖼️  Pexels image backfill — ${Object.keys(global.images).length} entries in data/images.json`);

  const rows = await prisma.word.findMany({
    select: { word: true, imageUrl: true },
    orderBy: { word: "asc" },
  });

  // Sync pass: make real images already in the DB durable in images.json.
  // Sharded workers skip this — images.json already has them, and shards must
  // not write images.json.
  if (!sharded) {
    let synced = 0;
    for (const r of rows) {
      if (realPrefix(r.imageUrl) && !getEntry(file.images, r.word)) {
        file.images[r.word] = {
          url: r.imageUrl!,
          source: r.imageUrl!.startsWith("https://images.pexels.com/") ? "pexels" : "wikimedia",
        };
        synced++;
      }
    }
    if (synced) {
      saveImagesFile(file, outPath);
      console.log(`   synced ${synced} existing DB image(s) into images.json`);
    }
  }

  // Target list: DB words with no entry anywhere (plus confirmed misses if
  // --retry-misses). Done-set = images.json ∪ this worker's part file.
  // Sharding keys on the word's index in the FULL sorted `rows` list — NOT its
  // index in this filtered list — so a word's owning worker never changes even
  // as the done-set grows across restarts. (Keying on the filtered index made
  // the shard boundary drift on restart, so concurrent workers re-fetched each
  // other's words and part files overlapped heavily.)
  let targets = rows.filter((r, idx) => {
    if (sharded && idx % workerN !== workerI) return false;
    const e = getEntry(global.images, r.word) ?? getEntry(file.images, r.word);
    if (!e) return true;
    return retryMisses && e.url === null;
  });
  if (onlyWord) targets = rows.filter((r) => r.word === onlyWord);
  if (targets.length > limit) targets = targets.slice(0, limit);

  console.log(`${tag}   ${targets.length} word(s) to fetch\n`);
  if (!targets.length) {
    console.log(`${tag}✅ nothing to do`);
    return;
  }

  let processed = 0;
  let fetched = 0;
  let misses = 0;
  let cacheHits = 0;
  let errors = 0;
  let sinceCheckpoint = 0;
  const start = Date.now();

  // Adaptive pacing: Pexels' real limiting behavior (a short-window burst
  // cap, observed independently of the account's much larger overall quota)
  // doesn't match any documented number, so we don't hardcode a rate — we
  // back off on 429s and cautiously speed back up after a run of successes.
  let delayMs = BASE_DELAY_MS;
  let consecutiveSuccesses = 0;
  // Exponential backoff across CONSECUTIVE 429s: a fixed 1-min retry loop was
  // re-hitting Pexels every 60s and staying in the penalty box. Doubling each
  // retry (capped) lets the burst window actually reset, then resets to 1 min
  // on the first success.
  let backoff429Ms = BASE_429_SLEEP_MS;

  for (const t of targets) {
    // --retry-misses / --word bypass the cache; a cached empty result would
    // otherwise return empty forever.
    const bypassCache = retryMisses || !!onlyWord;
    let json = bypassCache ? undefined : cacheGet<any>("pexels", t.word);
    if (json !== undefined) {
      cacheHits++;
    } else {
      while (true) {
        try {
          const res = await pexelsSearch(apiKey, t.word);
          json = res.json;
          cacheSet("pexels", t.word, json);
          consecutiveSuccesses++;
          backoff429Ms = BASE_429_SLEEP_MS; // window cleared → reset retry backoff
          // Recover pace quickly: drop ~12% per success so a post-429 spike
          // (e.g. 6s) decays back toward the floor within a dozen successes,
          // instead of needing 20 consecutive successes to shrink at all.
          delayMs = Math.max(MIN_DELAY_MS, Math.round(delayMs * 0.88));
          consecutiveSuccesses = 0;
          if (!Number.isNaN(res.remaining) && res.remaining <= 2) {
            // Quota nearly exhausted — back off. Only trust the header's
            // delay if it's sane (see saneResetDelayMs); otherwise use a
            // fixed fallback rather than risk a garbage multi-day sleep.
            const waitMs = res.resetDelayMs ?? BASE_429_SLEEP_MS;
            console.log(`\n   ⏳ rate window low — sleeping ${(waitMs / 60000).toFixed(1)} min`);
            await sleep(waitMs);
          } else {
            await sleep(delayMs);
          }
          break;
        } catch (e: any) {
          if (e?.rateLimited) {
            consecutiveSuccesses = 0;
            delayMs = Math.min(MAX_DELAY_MS, Math.round(delayMs * 1.3));
            const waitMs = Math.min(600000, backoff429Ms); // cap 10 min
            backoff429Ms *= 2; // next consecutive 429 waits twice as long
            console.log(`\n   ⏳ 429 — sleeping ${(waitMs / 60000).toFixed(1)} min (pace ${delayMs}ms)`);
            await sleep(waitMs);
            continue; // retry the same word
          }
          console.error(`\n   ⚠️  ${t.word}: ${e?.message ?? e}`);
          errors++;
          json = undefined; // no entry written → retried on next run
          await sleep(delayMs);
          break;
        }
      }
    }

    if (json !== undefined) {
      const entry = entryFromResponse(json);
      file.images[t.word] = entry;
      if (entry.url) fetched++;
      else misses++;
      sinceCheckpoint++;
    }

    processed++;
    if (sinceCheckpoint >= CHECKPOINT_EVERY) {
      saveImagesFile(file, outPath);
      sinceCheckpoint = 0;
    }
    if (processed % 25 === 0 || processed === targets.length) {
      const pct = ((processed / targets.length) * 100).toFixed(1);
      const min = ((Date.now() - start) / 60000).toFixed(1);
      process.stdout.write(`\r${tag}  ${processed}/${targets.length} (${pct}%) · ${min}min · img ${fetched} · miss ${misses}   `);
    }
  }

  saveImagesFile(file, outPath);

  const distinct = new Set(
    Object.values(file.images)
      .filter((e) => e.photoId != null)
      .map((e) => e.photoId)
  ).size;
  console.log(`\n\n${tag}✅ Done. fetched ${fetched} · misses ${misses} · cache-hits ${cacheHits} · errors ${errors}`);
  console.log(`${tag}   ${sharded ? outPath.split("/").pop() : "images.json"}: ${Object.keys(file.images).length} entries · ${distinct} distinct Pexels photos`);
  if (!sharded) console.log(`   next: npm run images:apply`);
  else console.log(`${tag}   next: wait for all shards, then npm run images:merge && images:apply`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
