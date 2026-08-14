// The translation round-trip contract (spec §4.2). Export dumps every NULL
// *Vi field as a TranslateRow; the user fills textVi out-of-band; import
// validates against this whitelist and UPDATEs. Schema never changes.
export type TranslateRow = {
  table: string;
  id: number;
  field: string;
  textEn: string;
  textVi: string | null;
};

// table → { viField → the EN field its source text comes from }.
// GrammarTestQuestion/GrammarPracticeQuestion choices & answers are EN-only by
// design (product decision, spec §3.1) — deliberately absent here.
export const TRANSLATABLE: Record<string, Record<string, string>> = {
  GrammarTopic: { nameVi: "nameEn" },
  GrammarLesson: { titleVi: "titleEn", contentViHtml: "contentEnHtml" },
  GrammarTestQuestion: { questionVi: "questionEn" },
  GrammarPracticeQuestion: { categoryVi: "categoryEn", questionVi: "questionEn", explanationVi: "explanationEn" },
  GrammarConfusedPair: { titleVi: "titleEn", entriesVi: "entriesEn" },
  GrammarCommonMistake: { titleVi: "titleEn", bodyVi: "bodyEn", noteVi: "noteEn" },
};

type Valid = { ok: true; row: { table: string; id: number; field: string; textVi: string } };
type Invalid = { ok: false; reason: string };

export function validateTranslatedRow(row: unknown): Valid | Invalid {
  if (typeof row !== "object" || row === null) return { ok: false, reason: "not an object" };
  const { table, id, field, textVi } = row as Partial<TranslateRow>;
  if (typeof table !== "string" || !(table in TRANSLATABLE)) return { ok: false, reason: `unknown table "${String(table)}"` };
  if (typeof field !== "string" || !(field in TRANSLATABLE[table])) return { ok: false, reason: `"${String(field)}" is not translatable on ${table}` };
  if (typeof id !== "number" || !Number.isInteger(id)) return { ok: false, reason: "id must be an integer" };
  if (typeof textVi !== "string" || !textVi.trim()) return { ok: false, reason: "textVi is empty" };
  if (field === "entriesVi") {
    try {
      const parsed = JSON.parse(textVi) as unknown;
      const bad = !Array.isArray(parsed) || parsed.length === 0 ||
        parsed.some((e) => typeof (e as { w?: unknown }).w !== "string" || typeof (e as { m?: unknown }).m !== "string");
      if (bad) return { ok: false, reason: "entriesVi must be a non-empty [{w,m,examples?}] array" };
    } catch {
      return { ok: false, reason: "entriesVi is not valid JSON" };
    }
  }
  return { ok: true, row: { table, id, field, textVi } };
}
