// Read-only audit of keyword-assigned topics: for every (word, topic) pair, which
// field matched which keyword, and whether it was a whole-word or a prefix-only
// hit (assignTopics matches `\bkeyword` with no trailing boundary).
//
// Usage: npx tsx scripts/topics/audit-topics.ts [--out data/llm-runs/topics/audit.json]
import "../../prisma/load-env";
import { PrismaClient } from "@prisma/client";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { TOPICS } from "../../src/lib/topic-taxonomy";

const prisma = new PrismaClient();
const outIdx = process.argv.indexOf("--out");
const OUT = resolve(outIdx !== -1 ? process.argv[outIdx + 1] : "data/llm-runs/topics/audit.json");

type Field = "word" | "definition" | "example" | "synonyms";
type Hit = { keyword: string; field: Field; whole: boolean; matched: string };

const esc = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function hitsFor(keywords: string[], fields: Record<Field, string>): Hit[] {
  const out: Hit[] = [];
  for (const keyword of keywords) {
    const re = new RegExp(`\\b${esc(keyword)}(\\w*)`, "ig");
    for (const field of Object.keys(fields) as Field[]) {
      for (const m of fields[field].matchAll(re)) out.push({ keyword, field, whole: m[1] === "", matched: m[0] });
    }
  }
  return out;
}

async function main(): Promise<void> {
  const words = await prisma.word.findMany({
    select: { id: true, word: true, cefr: true, typeEn: true, definitionEn: true, example: true, synonyms: true, topics: true },
  });
  const rows: Array<{ word: string; cefr: string; type: string | null; def: string | null; topic: string; curated: boolean; hits: Hit[] }> = [];
  for (const w of words) {
    let topics: string[] = [];
    try { topics = JSON.parse(w.topics || "[]"); } catch {}
    let syns: string[] = [];
    try { syns = JSON.parse(w.synonyms || "[]"); } catch {}
    const fields: Record<Field, string> = { word: w.word, definition: w.definitionEn ?? "", example: w.example ?? "", synonyms: syns.join(" ") };
    for (const slug of topics) {
      const t = TOPICS.find((x) => x.slug === slug);
      if (!t) continue;
      rows.push({ word: w.word, cefr: w.cefr, type: w.typeEn, def: w.definitionEn, topic: slug, curated: !!t.curated || t.keywords.length === 0, hits: t.keywords.length ? hitsFor(t.keywords, fields) : [] });
    }
  }
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify({ words: words.length, rows }));
  const by: Record<string, { n: number; headword: number; wholeDef: number; wholeAny: number; onlyExample: number; onlyPrefix: number; curated: boolean }> = {};
  for (const r of rows) {
    const s = (by[r.topic] ??= { n: 0, headword: 0, wholeDef: 0, wholeAny: 0, onlyExample: 0, onlyPrefix: 0, curated: r.curated });
    s.n++;
    if (r.curated && !r.hits.length) continue;
    if (r.hits.some((h) => h.field === "word" && h.whole)) s.headword++;
    if (r.hits.some((h) => h.field === "definition" && h.whole)) s.wholeDef++;
    if (r.hits.some((h) => h.whole)) s.wholeAny++;
    if (!r.hits.some((h) => h.field === "word" || h.field === "definition")) s.onlyExample++;
    if (!r.hits.some((h) => h.whole)) s.onlyPrefix++;
  }
  console.log(`words: ${words.length}, word-topic pairs: ${rows.length}, written ${OUT}`);
  console.log("topic".padEnd(16), "pairs headword wholeDef wholeAny onlyExample/Syn onlyPrefix");
  for (const [t, s] of Object.entries(by).sort((a, b) => b[1].n - a[1].n))
    console.log(t.padEnd(16), String(s.n).padStart(5), String(s.headword).padStart(8), String(s.wholeDef).padStart(8), String(s.wholeAny).padStart(8), String(s.onlyExample).padStart(15), String(s.onlyPrefix).padStart(10), s.curated ? "(curated)" : "");
}

main().finally(() => prisma.$disconnect());
