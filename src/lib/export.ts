import "server-only";
import { prisma } from "./db";
import { type ExportRow } from "./export-format";
import { filterWhere, type VaultFilter } from "./vault/scope";

export type { ExportRow };
export { CEFR_LEVELS } from "./export-format";
export { toCsv, toAnkiTxt } from "./export-format";

type WordFields = {
  word: string;
  ipaUs: string | null;
  ipaUk: string | null;
  typeEn: string | null;
  definitionEn: string | null;
  definitionVi: string | null;
  example: string | null;
  exampleVi: string | null;
  cefr: string;
};

const WORD_SELECT = {
  word: true,
  ipaUs: true,
  ipaUk: true,
  typeEn: true,
  definitionEn: true,
  definitionVi: true,
  example: true,
  exampleVi: true,
  cefr: true,
} as const;

function toRow(w: WordFields): ExportRow {
  return {
    word: w.word,
    ipa: w.ipaUs ?? w.ipaUk ?? "",
    typeEn: w.typeEn ?? "",
    definitionEn: w.definitionEn ?? "",
    definitionVi: w.definitionVi ?? "",
    example: w.example ?? "",
    exampleVi: w.exampleVi ?? "",
    cefr: w.cefr,
  };
}

const ORDER = [{ cefr: "asc" as const }, { word: "asc" as const }];

// Fetch export rows for a filter, ordered by CEFR then word. What used to be
// four separate branches (all/starred/learned/cefr:X) is now one query — the
// filter's `where` fragment is built by the same filterWhere() that /browse
// and study use, so export can never drift from what those show as "starred"
// or "learned".
export async function getExportRows(userId: string, filter: VaultFilter): Promise<ExportRow[]> {
  const words = await prisma.word.findMany({
    where: filterWhere(filter, userId),
    select: WORD_SELECT,
    orderBy: ORDER,
  });
  return words.map(toRow);
}
