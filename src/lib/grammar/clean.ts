// Pure CSV-field cleaners for the grammar import pipeline
// (prisma/import-grammar.ts). Prisma-free so vitest can cover them.
import { parse } from "csv-parse/sync";

// Raw CSV file → records keyed by header row. Source files carry a BOM and
// quoted multiline fields; csv-parse handles both.
export function parseCsvRecords(raw: string): Record<string, string>[] {
  return parse(raw, { columns: true, bom: true, skip_empty_lines: true });
}

// Normalize a choice list + its 1-based answer index from either source shape:
//   tests.csv            → cells = [a_en, b_en, c_en, d_en] (some empty)
//   grammar_questions.csv → cells = choices_en.split("##")
// Empty cells are dropped, but the answer must stay pointing at the same TEXT,
// so the 0-based index is recomputed as "non-empty cells before the answer".
// null = unusable row (importer skips + reports it).
export function normalizeChoices(
  cells: string[],
  answerIndex1: string
): { choices: string[]; answerIndex: number } | null {
  const trimmed = cells.map((s) => (s ?? "").trim());
  const n = Number.parseInt(answerIndex1, 10);
  if (!Number.isInteger(n) || n < 1 || n > trimmed.length || !trimmed[n - 1]) return null;
  const choices = trimmed.filter(Boolean);
  if (choices.length < 2) return null;
  const answerIndex = trimmed.slice(0, n - 1).filter(Boolean).length;
  return { choices, answerIndex };
}

// The machine translation left many VI fields empty or byte-identical to the
// EN text. Both mean "no usable translation" → NULL in the DB, which
// grammar-translate-export later picks up as "needs translation".
export function viOrNull(vi: string | null | undefined, en: string): string | null {
  const v = (vi ?? "").trim();
  if (!v) return null;
  const norm = (s: string) => s.replace(/\s+/g, " ").toLowerCase();
  if (norm(v) === norm(en)) return null;
  return v;
}

// Confused-word meaning strings embed example sentences as lines starting
// with "#": '"A few" is …\n# Hurry up …'.
export function splitMeaningExamples(m: string): { meaning: string; examples: string[] } {
  const meaning: string[] = [];
  const examples: string[] = [];
  for (const line of m.split("\n")) {
    const t = line.trim();
    if (t.startsWith("#")) examples.push(t.replace(/^#\s*/, ""));
    else if (t) meaning.push(t);
  }
  return { meaning: meaning.join(" "), examples };
}
