/* eslint-disable */
// Push data/images.json (the durable word → image-URL artifact) into Word.imageUrl.
// Idempotent and safe to run mid-crawl — images appear in the app progressively
// as scripts/images/fetch-pexels.ts fills in more of images.json.
//
// Rules:
//   - entry has a real url, different from the DB value → update, UNLESS the DB
//     already holds a Wikimedia url (Wikimedia is never overwritten by Pexels).
//   - entry is a confirmed miss (url: null) and the DB holds legacy junk (not a
//     real image) → clean it to null. Pass --keep-legacy to skip this.
//   - word has no entry in images.json → left untouched.
//
// Usage:
//   npm run images:apply                # apply + clean legacy junk
//   npm run images:apply -- --dry-run   # report counts only
//   npm run images:apply -- --keep-legacy
import "./load-env";
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "fs";
import { resolve } from "path";

const prisma = new PrismaClient();

const IMAGES_FILE = resolve(process.cwd(), "data/images.json");
const REAL_IMAGE_PREFIXES = ["https://upload.wikimedia.org", "https://images.pexels.com/"];

const DRY_RUN = process.argv.includes("--dry-run");
const KEEP_LEGACY = process.argv.includes("--keep-legacy");

// Plain-object lookup: `images[word]` for word "constructor" (a real IT-pack
// entry) silently returns Object.prototype.constructor instead of undefined.
// Guard every read with hasOwnProperty so such words aren't mistaken as done.
function getEntry(
  images: Record<string, { url: string | null; source: string }>,
  word: string
): { url: string | null; source: string } | undefined {
  return Object.prototype.hasOwnProperty.call(images, word) ? images[word] : undefined;
}

function isReal(url: string | null): boolean {
  return !!url && REAL_IMAGE_PREFIXES.some((p) => url.startsWith(p));
}
function isWikimedia(url: string | null): boolean {
  return !!url && url.startsWith("https://upload.wikimedia.org");
}

async function main() {
  const file: { images: Record<string, { url: string | null; source: string }> } = JSON.parse(
    readFileSync(IMAGES_FILE, "utf-8")
  );

  const rows = await prisma.word.findMany({ select: { word: true, imageUrl: true } });
  console.log(
    `${DRY_RUN ? "🔍 DRY RUN — " : ""}${Object.keys(file.images).length} entries in images.json · ${rows.length} words in DB\n`
  );

  let setPexels = 0;
  let keptWikimedia = 0;
  let cleanedLegacy = 0;
  let unchanged = 0;
  let noEntry = 0;
  const updates: Array<{ word: string; data: { imageUrl: string | null } }> = [];

  for (const r of rows) {
    const entry = getEntry(file.images, r.word);
    if (!entry) {
      noEntry++;
      continue;
    }
    if (isWikimedia(r.imageUrl)) {
      keptWikimedia++;
      continue; // never overwrite an existing Wikimedia image
    }
    if (entry.url) {
      if (entry.url !== r.imageUrl) {
        updates.push({ word: r.word, data: { imageUrl: entry.url } });
        setPexels++;
      } else {
        unchanged++;
      }
    } else {
      // confirmed miss — clean legacy junk (non-null, non-real) to null
      if (r.imageUrl && !isReal(r.imageUrl) && !KEEP_LEGACY) {
        updates.push({ word: r.word, data: { imageUrl: null } });
        cleanedLegacy++;
      } else {
        unchanged++;
      }
    }
  }

  console.log(
    `set-pexels ${setPexels} · kept-wikimedia ${keptWikimedia} · cleaned-legacy ${cleanedLegacy} · unchanged ${unchanged} · no-entry ${noEntry}`
  );

  if (DRY_RUN) return;

  const TX = 50;
  for (let i = 0; i < updates.length; i += TX) {
    await prisma.$transaction(
      updates.slice(i, i + TX).map((u) => prisma.word.update({ where: { word: u.word }, data: u.data }))
    );
    process.stdout.write(`\r   applied ${Math.min(i + TX, updates.length)}/${updates.length}   `);
  }
  console.log(`\n\n✅ Applied ${updates.length} update(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
