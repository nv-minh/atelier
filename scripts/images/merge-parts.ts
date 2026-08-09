/* eslint-disable */
// Merge sharded worker outputs (data/images-part-*.json) back into the single
// durable data/images.json. Run after all `images:fetch -- --worker I/N` shards
// finish. Idempotent: a word already in images.json is kept; part files only
// ever contribute words the shard uniquely fetched (disjoint by construction).
//
// Usage:
//   npm run images:merge             # merge part files into images.json
//   npm run images:merge -- --clean  # ...then delete the part files
import { readFileSync, writeFileSync, readdirSync, unlinkSync, existsSync } from "fs";
import { resolve } from "path";

const ROOT = resolve(process.cwd(), "data");
const IMAGES_FILE = resolve(ROOT, "images.json");

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

function load(path: string): ImagesFile {
  return existsSync(path) ? JSON.parse(readFileSync(path, "utf-8")) : { metadata: { generated: "", counts: {} }, images: {} };
}

function save(f: ImagesFile, path: string): void {
  const counts: Record<string, number> = { wikimedia: 0, pexels: 0, none: 0 };
  for (const e of Object.values(f.images)) counts[e.source] = (counts[e.source] ?? 0) + 1;
  const sorted: Record<string, ImageEntry> = {};
  for (const k of Object.keys(f.images).sort()) sorted[k] = f.images[k];
  writeFileSync(path, JSON.stringify({ metadata: { generated: new Date().toISOString(), counts }, images: sorted }, null, 1));
}

const clean = process.argv.includes("--clean");
const merged = load(IMAGES_FILE);
const before = Object.keys(merged.images).length;

const partFiles = readdirSync(ROOT)
  .filter((f) => /^images-part-\d+\.json$/.test(f))
  .sort((a, b) => Number(a.match(/\d+/)![0]) - Number(b.match(/\d+/)![0]));

if (!partFiles.length) {
  console.log("No data/images-part-*.json found — nothing to merge.");
  process.exit(0);
}

let added = 0;
for (const pf of partFiles) {
  const part = load(resolve(ROOT, pf));
  let n = 0;
  for (const [w, e] of Object.entries(part.images)) {
    if (!Object.prototype.hasOwnProperty.call(merged.images, w)) {
      merged.images[w] = e;
      n++;
    }
  }
  console.log(`  ${pf}: ${Object.keys(part.images).length} entries · ${n} new`);
  added += n;
  if (clean) unlinkSync(resolve(ROOT, pf));
}

save(merged, IMAGES_FILE);
console.log(`\n✅ Merged ${added} new entries. images.json: ${before} → ${Object.keys(merged.images).length}${clean ? " (part files cleaned)" : ""}`);
console.log("   next: npm run images:apply");
