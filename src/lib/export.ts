import "server-only";
import { prisma } from "./db";
import { getStarredWordIds } from "./study-engine";
import { STATES } from "./fsrs";
import { CEFR_LEVELS, type ExportRow } from "./export-format";

export type { ExportRow };
export { CEFR_LEVELS } from "./export-format";
export { toCsv, toAnkiTxt } from "./export-format";

type CefrLevel = (typeof CEFR_LEVELS)[number];

export type ExportScope = "all" | "starred" | "learned" | `cefr:${CefrLevel}`;

function isCefrLevel(s: string): s is CefrLevel {
  return (CEFR_LEVELS as readonly string[]).includes(s);
}

// Parse + validate an untrusted scope string. Returns null on anything invalid
// so callers can answer 400.
export function parseScope(raw: string | null): ExportScope | null {
  if (raw === "all" || raw === "starred" || raw === "learned") return raw;
  if (raw && raw.startsWith("cefr:")) {
    const level = raw.slice("cefr:".length);
    if (isCefrLevel(level)) return `cefr:${level}`;
  }
  return null;
}

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

// Fetch export rows for a scope, ordered by CEFR then word.
export async function getExportRows(userId: string, scope: ExportScope): Promise<ExportRow[]> {
  if (scope === "all") {
    const words = await prisma.word.findMany({ select: WORD_SELECT, orderBy: ORDER });
    return words.map(toRow);
  }

  if (scope === "starred") {
    const ids = await getStarredWordIds(userId);
    if (ids.length === 0) return [];
    const words = await prisma.word.findMany({
      where: { id: { in: ids } },
      select: WORD_SELECT,
      orderBy: ORDER,
    });
    return words.map(toRow);
  }

  if (scope === "learned") {
    // "Learned" = the user's card has left the learning phase (Review or Relearning).
    const cards = await prisma.card.findMany({
      where: { userId, state: { in: [STATES.Review, STATES.Relearning] } },
      select: { wordId: true },
    });
    const ids = cards.map((c) => c.wordId);
    if (ids.length === 0) return [];
    const words = await prisma.word.findMany({
      where: { id: { in: ids } },
      select: WORD_SELECT,
      orderBy: ORDER,
    });
    return words.map(toRow);
  }

  // cefr:<level>
  const level = scope.slice("cefr:".length);
  const words = await prisma.word.findMany({
    where: { cefr: level },
    select: WORD_SELECT,
    orderBy: ORDER,
  });
  return words.map(toRow);
}
