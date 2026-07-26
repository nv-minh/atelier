/* eslint-disable */
// Fill Vietnamese fields on pack files: definition_vi + type_vi from the
// open EN-VI dictionary (OVDP / Ho Ngoc Duc data via anhviet.json) — real
// dictionary senses beat machine translation, especially for IT terms where
// the "Lĩnh vực: toán & tin" section gives e.g. server → "máy chủ" instead of
// "người hầu". Misses and example sentences fall back to the same Google
// Translate gtx endpoint prisma/translate-vi.ts uses, cached on disk.
import { readFileSync } from "fs";
import { createHash } from "crypto";
import { resolve } from "path";
import { cacheGet, cacheSet } from "./lib/cache";
import { gtxTranslate } from "./lib/gtx";
import { sleep } from "./lib/http";
import { PackWord, RAW_DIR, packExists, packsFromArgv, readPack, writePack } from "./lib/formats";

const CONCURRENCY = 3;
const DELAY_MS = 450;
// Repair flag: rebuild definition_vi/type_vi for words already sourced from the
// dictionary, using the sense-aligned selector. Normal runs leave them alone.
const RETRANSLATE_ANHVIET = process.argv.includes("--retranslate-anhviet");

process.on("unhandledRejection", (e) => console.error("unhandledRejection:", e));

// ── anhviet.json loader ──────────────────────────────────────────────
// The file is JSON-ish but malformed (unescaped quotes inside keys), so parse
// line-by-line: `"<term>": "<content>",` — lazy match stops at the first
// `": "` which is the key/value boundary for every well-formed entry.
//
// Keys collide after lowercasing: a full dictionary entry ("mean" with `*` POS
// sections) and a bare specialized-glossary stub ("Mean" → "(Econ) Trung
// bình…") map to the same key. Prefer the entry that has POS structure — the
// old first-wins rule let the Econ stub shadow the real dictionary sense.
function loadAnhViet(): Map<string, string> {
  const map = new Map<string, string>();
  const text = readFileSync(resolve(RAW_DIR, "anhviet.json"), "utf-8");
  const re = /^"(.+?)": "(.*)",?\s*$/;
  const hasPos = (s: string) => s.includes("*");
  for (const line of text.split("\n")) {
    const m = re.exec(line);
    if (!m) continue;
    const key = m[1].trim().toLowerCase();
    const val = m[2];
    const existing = map.get(key);
    if (existing === undefined) {
      map.set(key, val);
    } else if (!hasPos(existing) && hasPos(val)) {
      map.set(key, val); // upgrade a bare stub to the structured entry
    }
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
    .split("!")[0] // "!by all means", "!of course" idiom markers
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

// A single sense group inside an anhviet entry: either a `*  <loại từ>- …` POS
// section or a `@Chuyên ngành/@Lĩnh vực …` specialized-field section.
type Section = {
  typeVi?: string; // POS label (Vietnamese), when the section carries one
  senses: string[]; // individual gloss fragments
  tech: boolean; // came from a computing/engineering specialized field
};

// Split an anhviet entry body into ALL its sense groups. The old parser only
// looked at the first `*` section, which for polysemous words is frequently the
// wrong sense (school → "đàn cá", date → "quả chà là", expire → "thở ra").
// Extracting every section lets the caller pick the one that matches the chosen
// English definition instead of blindly trusting sense #1.
function extractSections(body: string): Section[] {
  const sections: Section[] = [];

  // `*  <loại từ>- sense- sense` POS sections. Split on `*`, drop the leading
  // `@word /ipa/` header (index 0), stop each piece at the first `@` (which
  // starts the specialized-field block).
  const starParts = body.split("*").slice(1);
  for (const part of starParts) {
    const seg = part.split("@")[0];
    const dash = seg.indexOf("-");
    const typeRaw = (dash === -1 ? seg : seg.slice(0, dash)).trim().toLowerCase();
    const typeVi = typeViFromLabel(typeRaw);
    const senses =
      dash === -1
        ? []
        : seg
            .slice(dash + 1)
            .split("-")
            .map(cleanSense)
            .filter((s) => s.length > 1);
    if (senses.length || typeVi) sections.push({ typeVi, senses, tech: false });
  }

  // `@Chuyên ngành …` / `@Lĩnh vực …` specialized-field sections (tech, econ,
  // law…). Each is a fresh sense group; mark computing/engineering ones tech.
  const fieldRe = /@(?:Chuyên ngành|Lĩnh vực)[^@*]*/g;
  let m: RegExpExecArray | null;
  while ((m = fieldRe.exec(body)) !== null) {
    const block = m[0];
    const dash = block.indexOf("-");
    if (dash === -1) continue;
    const senses = block
      .slice(dash + 1)
      .split("-")
      .map(cleanSense)
      .filter((s) => s.length > 1);
    if (!senses.length) continue;
    const tech = /toán & tin|tin học|kỹ thuật/.test(block);
    sections.push({ senses, tech });
  }

  // Entries with no POS/field markers at all (e.g. "@database- kho dữ liệu").
  if (sections.length === 0) {
    const dash = body.indexOf("-");
    if (dash !== -1) {
      const senses = body
        .slice(dash + 1)
        .split(/[@]/)[0]
        .split("-")
        .map(cleanSense)
        .filter((s) => s.length > 1);
      if (senses.length) sections.push({ senses, tech: false });
    }
  }

  return sections;
}

// Strip Vietnamese diacritics + lowercase → a bag of content tokens for cheap
// overlap scoring against a gtx translation of the English definition.
const STOP = new Set([
  "và","của","là","một","các","có","cho","với","được","những","này","đó","ở",
  "để","người","cái","khi","hoặc","như","trong","về","the","a","an","to","of",
]);
function tokenize(s: string): Set<string> {
  const flat = s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d");
  const toks = flat.split(/[^a-z0-9]+/).filter((t) => t.length > 1 && !STOP.has(t));
  return new Set(toks);
}

// One candidate gloss, tagged with the POS/domain of the section it came from.
type Candidate = { sense: string; typeVi?: string; tech: boolean; score: number };

// Score a single sense against the reference tokens (from gtx(definition_en)):
// how many reference tokens it shares, normalized by reference size, plus small
// bonuses for POS agreement and (in the tech pack) a computing/engineering
// domain. Scoring per-sense — not per-section — is what lets "khe" beat "đường
// đi của hươu nai" inside slot's single noun section.
function scoreSense(
  sense: string,
  ref: Set<string>,
  opts: { typeVi?: string; tech: boolean; typeViExpected?: string; preferTech: boolean }
): number {
  if (ref.size === 0) return 0;
  const toks = tokenize(sense);
  let hits = 0;
  for (const t of ref) if (toks.has(t)) hits++;
  let score = hits / ref.size;
  if (opts.typeViExpected && opts.typeVi === opts.typeViExpected) score += 0.1;
  if (opts.preferTech && opts.tech) score += 0.2;
  return score;
}

// Pick the dictionary senses that best match the chosen English definition.
// Flattens every section to individual senses, scores each, and keeps the top
// matches. Returns undefined below the confidence threshold → caller uses gtx
// instead, which is sense-correct because it translates THIS definition_en.
function selectSense(
  sections: Section[],
  opts: { typeViExpected?: string; refTokens: Set<string>; preferTech: boolean }
): { typeVi?: string; defVi?: string } | undefined {
  if (!sections.length) return undefined;
  const { typeViExpected, refTokens, preferTech } = opts;

  const candidates: Candidate[] = [];
  for (const sec of sections) {
    // IT pack: only ever trust computing/engineering senses — the general sense
    // is usually the wrong domain (deploy = military, server = waiter).
    if (preferTech && !sec.tech) continue;
    for (const sense of sec.senses) {
      candidates.push({
        sense,
        typeVi: sec.typeVi,
        tech: sec.tech,
        score: scoreSense(sense, refTokens, { typeVi: sec.typeVi, tech: sec.tech, typeViExpected, preferTech }),
      });
    }
  }
  if (!candidates.length) return undefined;

  candidates.sort((a, b) => b.score - a.score);
  const best = candidates[0];
  const THRESHOLD = 0.12; // at least one meaningful shared token
  if (best.score < THRESHOLD) return undefined;

  // Keep the top sense plus any near-ties from the SAME part of speech, so a
  // definition reads naturally ("trường học, học đường") without dragging in an
  // unrelated homonym from another section.
  const chosen: string[] = [];
  for (const c of candidates) {
    if (chosen.length >= 2) break;
    if (c.score < THRESHOLD) break;
    if (c.typeVi !== best.typeVi) continue;
    if (!chosen.includes(c.sense)) chosen.push(c.sense);
  }
  return { typeVi: best.typeVi, defVi: chosen.join("; ") || undefined };
}

// typeVi from any section that carries a POS label (used when the chosen sense's
// own section has none, e.g. a specialized-field section).
function anyTypeVi(sections: Section[]): string | undefined {
  for (const s of sections) if (s.typeVi) return s.typeVi;
  return undefined;
}

async function gtxCached(text: string): Promise<string | null> {
  // Hash the full text for the cache key — slicing to 180 chars collided on
  // long definitions that share a prefix, and unencoded long words could blow
  // past the filesystem's filename limit (ENAMETOOLONG).
  const key = createHash("sha1").update(text).digest("hex");
  const cached = cacheGet<{ vi: string | null }>("gtx", key);
  if (cached !== undefined) return cached.vi;
  // Fall back to the legacy slice(0,180) key so the 3,451 already-cached
  // translations are reused (no re-crawl) while new writes use the hash.
  const legacy = cacheGet<{ vi: string | null }>("gtx", text.slice(0, 180));
  if (legacy !== undefined) {
    if (legacy.vi !== null) cacheSet("gtx", key, legacy); // migrate forward
    return legacy.vi;
  }
  const vi = await gtxTranslate(text);
  // Never cache a null: a single 429/timeout would otherwise poison the entry
  // permanently and every re-run would keep the word untranslated.
  if (vi !== null) cacheSet("gtx", key, { vi });
  await sleep(DELAY_MS);
  return vi;
}

// Choose definition_vi + type_vi for one word. Prefers a sense-aligned
// dictionary entry; falls back to gtx(definition_en) when no dictionary sense
// scores above threshold (gtx is sense-correct because it translates THIS
// definition). Returns whether the word ended up on the dictionary path.
async function resolveViDefinition(
  w: PackWord,
  anhviet: Map<string, string>,
  preferTech: boolean
): Promise<"anhviet" | "gtx" | "none"> {
  const entry = anhviet.get(w.word);
  const sections = entry ? extractSections(entry) : [];

  // typeVi: pick from a POS section if present, else map from type_en.
  if (!w.type_vi) {
    w.type_vi = anyTypeVi(sections) ?? (w.type_en ? TYPE_VI_FROM_EN[w.type_en.toLowerCase()] ?? null : null);
  }

  if (w.definition_vi || !w.definition_en) {
    return w.vi_source === "anhviet" ? "anhviet" : w.vi_source === "gtx" ? "gtx" : "none";
  }

  // Reference tokens = gtx of the chosen English definition. Cached, so this is
  // cheap on re-runs and lets us align the dictionary sense to THIS meaning.
  const refVi = await gtxCached(w.definition_en);
  const refTokens = refVi ? tokenize(refVi) : new Set<string>();
  const typeViExpected = w.type_en ? TYPE_VI_FROM_EN[w.type_en.toLowerCase()] : undefined;

  const picked = selectSense(sections, { typeViExpected, refTokens, preferTech });
  if (picked?.defVi) {
    w.definition_vi = picked.defVi;
    w.vi_source = "anhviet";
    if (picked.typeVi && !w.type_vi) w.type_vi = picked.typeVi;
    return "anhviet";
  }

  // No aligned dictionary sense — use the gtx translation of definition_en.
  if (refVi) {
    w.definition_vi = refVi;
    w.vi_source = "gtx";
    return "gtx";
  }
  return "none";
}

async function translatePack(name: string, anhviet: Map<string, string>): Promise<void> {
  const pack = readPack(name);
  const preferTech = name === "it-programming";

  // Repair mode: clear existing anhviet-sourced definitions so the fixed
  // sense-aligned selector rebuilds them (leaves gtx-sourced rows untouched —
  // they were already sense-correct).
  if (RETRANSLATE_ANHVIET) {
    let cleared = 0;
    for (const w of pack.words) {
      if (w.vi_source === "anhviet") {
        w.definition_vi = null;
        w.type_vi = null;
        cleared++;
      }
    }
    console.log(`\n${name}: cleared ${cleared} anhviet definitions for re-translation`);
  }

  const todo = pack.words.filter((w) => !w.definition_vi || (!w.example_vi && w.example) || !w.type_vi);
  console.log(`${name}: ${todo.length}/${pack.words.length} words need Vietnamese fields`);

  // Single concurrent pass: sense selection needs gtx(definition_en) tokens, so
  // dictionary and gtx work now share the same rate-limited worker pool.
  let fromDict = 0;
  let fromGtx = 0;
  let idx = 0;
  let done = 0;
  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (idx < todo.length) {
      const w = todo[idx++];
      try {
        const src = await resolveViDefinition(w, anhviet, preferTech);
        if (src === "anhviet") fromDict++;
        else if (src === "gtx") fromGtx++;
        if (!w.example_vi && w.example) {
          w.example_vi = (await gtxCached(w.example)) ?? undefined;
        }
      } catch (e: any) {
        console.error(`\n  ! ${w.word}: ${e?.message ?? e}`);
      }
      done++;
      if (done % 25 === 0) {
        process.stdout.write(`\r  ${done}/${todo.length}   `);
        writePack(pack);
      }
    }
  });
  await Promise.all(workers);
  writePack(pack);

  const missing = pack.words.filter((w) => !w.definition_vi).length;
  console.log(`\r  done. dictionary ${fromDict}, gtx ${fromGtx}; ${missing} still lack definition_vi.`);
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
