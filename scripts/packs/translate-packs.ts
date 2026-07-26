/* eslint-disable */
// Fill Vietnamese fields on pack files: definition_vi + type_vi from the
// open EN-VI dictionary (OVDP / Ho Ngoc Duc data via anhviet.json) — real
// dictionary senses beat machine translation, especially for IT terms where
// the "Lĩnh vực: toán & tin" section gives e.g. server → "máy chủ" instead of
// "người hầu". Misses and example sentences fall back to the same Google
// Translate gtx endpoint prisma/translate-vi.ts uses, cached on disk.
import { readFileSync } from "fs";
import { resolve } from "path";
import { cacheGet, cacheSet } from "./lib/cache";
import { gtxTranslate } from "./lib/gtx";
import { sleep } from "./lib/http";
import { PackWord, RAW_DIR, packExists, packsFromArgv, readPack, writePack } from "./lib/formats";

const CONCURRENCY = 3;
const DELAY_MS = 450;

process.on("unhandledRejection", (e) => console.error("unhandledRejection:", e));

// ── anhviet.json loader ──────────────────────────────────────────────
// The file is JSON-ish but malformed (unescaped quotes inside keys), so parse
// line-by-line: `"<term>": "<content>",` — lazy match stops at the first
// `": "` which is the key/value boundary for every well-formed entry.
function loadAnhViet(): Map<string, string> {
  const map = new Map<string, string>();
  const text = readFileSync(resolve(RAW_DIR, "anhviet.json"), "utf-8");
  const re = /^"(.+?)": "(.*)",?\s*$/;
  for (const line of text.split("\n")) {
    const m = re.exec(line);
    if (!m) continue;
    const key = m[1].trim().toLowerCase();
    if (!map.has(key)) map.set(key, m[2]);
  }
  return map;
}

const TYPE_VI_FROM_SECTION: Array<[RegExp, string]> = [
  [/ngoại động từ|nội động từ|^động từ|trợ động từ/, "Động từ"],
  [/danh từ/, "Danh từ"],
  [/tính từ/, "Tính từ"],
  [/phó từ|trạng từ/, "Trạng từ"],
  [/giới từ/, "Giới từ"],
  [/liên từ/, "Liên từ"],
  [/thán từ/, "Thán từ"],
  [/đại từ/, "Đại từ"],
  [/mạo từ/, "Mạo từ"],
];

const TYPE_VI_FROM_EN: Record<string, string> = {
  noun: "Danh từ",
  verb: "Động từ",
  adjective: "Tính từ",
  adverb: "Trạng từ",
  preposition: "Giới từ",
  conjunction: "Liên từ",
  pronoun: "Đại từ",
  exclamation: "Thán từ",
  interjection: "Thán từ",
  determiner: "Hạn định từ",
  number: "Số từ",
  "modal verb": "Động từ khuyết thiếu",
  "auxiliary verb": "Trợ động từ",
  "indefinite article": "Mạo từ bất định",
  "definite article": "Mạo từ xác định",
};

function cleanSense(s: string): string {
  return s
    .split("=")[0] // "=example+ translation" tails
    .replace(/\s+/g, " ")
    .replace(/^[\s;,.]+|[\s;,.]+$/g, "")
    .trim();
}

function typeViFromLabel(label: string): string | undefined {
  for (const [re, vi] of TYPE_VI_FROM_SECTION) {
    if (re.test(label)) return vi;
  }
  return undefined;
}

// Extract {typeVi, definitionVi} from a raw anhviet entry body.
// General shape: `@word /ipa/*  <loại từ>- sense- sense=ex+vi*  <loại từ>- …@Chuyên ngành …-sense-sense`
// `tech` marks whether defVi came from a computing/engineering section — the IT
// pack only trusts dictionary senses from those (the general sense of "deploy"
// is military, of "server" is a waiter; gtx on the computing definition_en is
// better than a wrong dictionary sense).
function parseAnhViet(
  body: string,
  preferTech: boolean
): { typeVi?: string; defVi?: string; tech: boolean } {
  let typeVi: string | undefined;

  if (preferTech) {
    for (const marker of [/@Lĩnh vực: (?:toán & tin|tin học)([^@*]*)/, /@Chuyên ngành kỹ thuật([^@*]*)/]) {
      const m = marker.exec(body);
      if (m) {
        const senses = m[1].split("-").map(cleanSense).filter((s) => s.length > 1);
        if (senses.length) return { defVi: [...new Set(senses)].slice(0, 2).join("; "), tech: true };
      }
    }
  }
  // First `*` (part-of-speech) section: from the first '*' to the next '*' or '@'.
  const star = body.indexOf("*");
  if (star === -1) {
    // Entries with no POS section (e.g. "@database- (Tech) kho dữ liệu…").
    // Some inline a POS label as the first "sense" — pull it out.
    const dash = body.indexOf("-");
    if (dash === -1) return { tech: false };
    const senses = body
      .slice(dash + 1)
      .split(/[@]/)[0]
      .split("-")
      .map(cleanSense)
      .filter((s) => s.length > 1)
      .filter((s) => {
        const t = typeViFromLabel(s.toLowerCase());
        if (t && s.length < 20) {
          typeVi = typeVi ?? t;
          return false;
        }
        return true;
      });
    return { typeVi, defVi: senses.slice(0, 2).join("; ") || undefined, tech: false };
  }
  let section = body.slice(star + 1);
  const end = section.search(/[*@]/);
  if (end !== -1) section = section.slice(0, end);

  const dash = section.indexOf("-");
  const typeRaw = (dash === -1 ? section : section.slice(0, dash)).trim().toLowerCase();
  typeVi = typeViFromLabel(typeRaw);
  if (dash === -1) return { typeVi, tech: false };
  const senses = section
    .slice(dash + 1)
    .split("-")
    .map(cleanSense)
    .filter((s) => s.length > 1);
  const defVi = [...new Set(senses)].slice(0, 2).join("; ");
  return { typeVi, defVi: defVi || undefined, tech: false };
}

async function gtxCached(text: string): Promise<string | null> {
  const key = text.slice(0, 180);
  const cached = cacheGet<{ vi: string | null }>("gtx", key);
  if (cached !== undefined) return cached.vi;
  const vi = await gtxTranslate(text);
  cacheSet("gtx", key, { vi });
  await sleep(DELAY_MS);
  return vi;
}

async function translatePack(name: string, anhviet: Map<string, string>): Promise<void> {
  const pack = readPack(name);
  const preferTech = name === "it-programming";
  const todo = pack.words.filter((w) => !w.definition_vi || (!w.example_vi && w.example) || !w.type_vi);
  console.log(`\n${name}: ${todo.length}/${pack.words.length} words need Vietnamese fields`);

  // Pass 1 — dictionary lookups (fast, local, no rate limit).
  let fromDict = 0;
  for (const w of todo) {
    const entry = anhviet.get(w.word);
    if (entry) {
      const { typeVi, defVi, tech } = parseAnhViet(entry, preferTech);
      // IT pack: only trust dictionary senses from tech sections — the general
      // sense is often the wrong domain (deploy = military, server = waiter).
      const trustDef = preferTech ? tech : true;
      if (!w.definition_vi && defVi && trustDef) {
        w.definition_vi = defVi;
        w.vi_source = "anhviet";
        fromDict++;
      }
      if (!w.type_vi && typeVi) w.type_vi = typeVi;
    }
    if (!w.type_vi && w.type_en) {
      w.type_vi = TYPE_VI_FROM_EN[w.type_en.toLowerCase()] ?? null;
    }
  }
  console.log(`  dictionary hits: ${fromDict}`);
  writePack(pack);

  // Pass 2 — gtx for definition misses and example sentences.
  const needsGtx = pack.words.filter(
    (w) => (!w.definition_vi && w.definition_en) || (!w.example_vi && w.example)
  );
  console.log(`  gtx fallback needed for ${needsGtx.length} words`);
  let idx = 0;
  let done = 0;
  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (idx < needsGtx.length) {
      const w = needsGtx[idx++];
      try {
        if (!w.definition_vi && w.definition_en) {
          const vi = await gtxCached(w.definition_en);
          if (vi) {
            w.definition_vi = vi;
            w.vi_source = "gtx";
          }
        }
        if (!w.example_vi && w.example) {
          w.example_vi = (await gtxCached(w.example)) ?? undefined;
        }
      } catch (e: any) {
        console.error(`\n  ! ${w.word}: ${e?.message ?? e}`);
      }
      done++;
      if (done % 25 === 0) {
        process.stdout.write(`\r  ${done}/${needsGtx.length}   `);
        writePack(pack);
      }
    }
  });
  await Promise.all(workers);
  writePack(pack);

  const missing = pack.words.filter((w) => !w.definition_vi).length;
  console.log(`\r  done. ${missing} words still lack definition_vi.`);
}

async function main() {
  console.log("Loading anhviet dictionary (52MB)…");
  const anhviet = loadAnhViet();
  console.log(`  ${anhviet.size} dictionary entries`);
  for (const name of packsFromArgv()) {
    if (!packExists(name)) {
      console.log(`${name}: no pack file — skipped`);
      continue;
    }
    await translatePack(name, anhviet);
  }
  console.log("\n✅ Vietnamese fields complete.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
