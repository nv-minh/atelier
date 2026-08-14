// confused_words.csv body parsing. EN bodies are all valid JSON (measured on
// all 832 rows). VI bodies were mangled by whatever produced the CSV — the
// `":"` after a "w"/"m" key collapsed into `>` or vanished (831/832 rows) —
// but the damage is mechanical, so we attempt regex repairs before giving up.
import { splitMeaningExamples } from "./clean";

export type ConfusedEntry = { w: string; m: string; examples: string[] };

function toEntries(parsed: unknown): ConfusedEntry[] | null {
  if (!Array.isArray(parsed) || parsed.length === 0) return null;
  const out: ConfusedEntry[] = [];
  for (const item of parsed) {
    if (typeof item !== "object" || item === null) return null;
    const { w, m } = item as { w?: unknown; m?: unknown };
    if (typeof w !== "string" || typeof m !== "string" || !w.trim()) return null;
    const { meaning, examples } = splitMeaningExamples(m);
    out.push({ w: w.trim(), m: meaning, examples });
  }
  return out;
}

// Throws on failure — the importer catches, skips the row and reports it.
export function parseEntriesEn(bodyEn: string): ConfusedEntry[] {
  const entries = toEntries(JSON.parse(bodyEn));
  if (!entries) throw new Error("body_en is not a [{w,m}] array");
  return entries;
}

// Observed manglings, in application order. Repairs may misfire on exotic
// content — that's fine: the result then fails toEntries() and we return null.
const REPAIRS: Array<[RegExp, string]> = [
  [/"w">/g, '"w":"'], // {"w">Một vài"   → {"w":"Một vài"
  [/"m">/g, '"m":"'], // "m">Ahold …     → "m":"Ahold …
  [/\{"w"(?!\s*:)/g, '{"w":"'], // {"w"A hold"   → {"w":"A hold"
  [/,"m"(?!\s*:)"?/g, ',"m":"'], // ,"m""Along …  → ,"m":"Along …
];

// null = no usable VI (→ DB NULL → exported for translation later).
export function parseEntriesVi(bodyVi: string): ConfusedEntry[] | null {
  const raw = (bodyVi ?? "").trim();
  if (!raw) return null;
  const repaired = REPAIRS.reduce((s, [re, sub]) => s.replace(re, sub), raw);
  for (const attempt of [raw, repaired]) {
    try {
      const entries = toEntries(JSON.parse(attempt));
      if (entries) return entries;
    } catch {
      // try the next attempt / fall through to null
    }
  }
  return null;
}
