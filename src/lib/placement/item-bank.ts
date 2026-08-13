import "server-only";
import { prisma } from "../db";
import { CEFR_LEVELS } from "../export-format";
import { stratifyByTercile } from "./stratify";
import { TRAP_WORDS } from "./traps";

/**
 * Items served per band. The ladder asks blocks of 5 and never re-asks a band,
 * so 5 bands x 5 = 25 real items is the true maximum; 10 per band leaves room
 * for the client to shuffle and skip without running dry.
 */
const PER_BAND = 10;
/** ~1 trap per 8 items over a run of up to 35 is ~4; a couple spare. */
const TRAPS_SERVED = 6;
/** Pool each band's items are stratified over. */
const BAND_POOL = 150;

export type PlacementItem = { id: string; word: string; cefr: string };
export type ItemBank = { items: PlacementItem[]; traps: string[] };

/**
 * Build a placement item bank.
 *
 * Only words that have an English definition: the result screen shows the
 * learner a few words it decided they know, and a card with no meaning on it is
 * not evidence of anything.
 *
 * Items are stratified across each band's frequency thirds — see stratify.ts for
 * why drawing off the top would inflate every measured level.
 *
 * Returns nothing user-specific: `id`, `word`, `cefr` and the trap strings are
 * all public reference data, which is what lets the endpoint stay open to guests.
 */
export async function buildItemBank(rng: () => number = Math.random): Promise<ItemBank> {
  const perBand = await Promise.all(
    CEFR_LEVELS.map(async (cefr) => {
      const rows = await prisma.word.findMany({
        where: {
          cefr,
          definitionEn: { not: null },
          // 14 legacy rows once held "" rather than null; cheap insurance.
          NOT: { definitionEn: "" },
        },
        select: { id: true, word: true, cefr: true },
        orderBy: { freqPct: { sort: "desc", nulls: "last" } },
        take: BAND_POOL,
      });
      return stratifyByTercile(rows, PER_BAND, rng);
    })
  );

  return {
    items: perBand.flat(),
    traps: stratifyByTercile(TRAP_WORDS, TRAPS_SERVED, rng) as string[],
  };
}
