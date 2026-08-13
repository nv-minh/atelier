// Rival XP. Three of the spec's anti-tell rules live here and all three are
// ENFORCED, not hoped for: no round numbers, at least one rest day per day
// across the roster, and a hard cap relative to the user's own pace.

import { hashSeed, makeRng, rngFloat } from "./rng";
import type { Rival } from "./rivals";
import { WEEKLY_CAP_MULTIPLIER } from "./constants";

function isWeekend(dateStr: string): boolean {
  const day = new Date(dateStr + "T00:00:00.000Z").getUTCDay();
  return day === 0 || day === 6;
}

export function isRestDay(rival: Rival, dateStr: string): boolean {
  const rng = makeRng(hashSeed("rest", rival.id, dateStr));
  return rng() < rival.restProb;
}

// A day's XP before the roster-level rest rule. Deterministic in (rival, date).
export function rivalDailyXp(rival: Rival, dateStr: string, pace: number): number {
  if (pace <= 0) return 0;
  if (isRestDay(rival, dateStr)) return 0;
  const rng = makeRng(hashSeed("xp", rival.id, dateStr));
  const jitter = 1 + rngFloat(rng, -rival.regularity, rival.regularity);
  const weekend = 1 + (isWeekend(dateStr) ? rival.weekendBias : 0);
  const form = 1 + rival.formTrend;
  const raw = pace * rival.paceFactor * jitter * weekend * form;
  return Math.max(0, Math.round(raw));
}

// Rule: every day, at least one rival is off. If nobody rested on their own,
// the highest-restProb rival is forced to. Ties break on id so it stays
// deterministic.
export function dailyXpForAll(rivals: Rival[], dateStr: string, pace: number): number[] {
  const xps = rivals.map((r) => rivalDailyXp(r, dateStr, pace));
  if (xps.some((x) => x === 0)) return xps;
  let idx = 0;
  for (let i = 1; i < rivals.length; i++) {
    const a = rivals[i];
    const b = rivals[idx];
    if (a.restProb > b.restProb || (a.restProb === b.restProb && a.id < b.id)) idx = i;
  }
  const out = [...xps];
  out[idx] = 0;
  return out;
}

// Nudge a value off a round ten. Real people don't stop at exactly 200 XP, and
// a column of round numbers is the cheapest tell on the board.
function deRound(value: number, seedKey: string): number {
  if (value === 0 || value % 10 !== 0) return value;
  const rng = makeRng(hashSeed("deround", seedKey));
  const shift = 1 + Math.floor(rng() * 3); // 1..3
  return value - shift > 0 ? value - shift : value + shift;
}

export function rivalWeeklyXp(rivals: Rival[], dates: string[], pace: number): number[] {
  if (pace <= 0) return new Array(rivals.length).fill(0);
  const totals = new Array(rivals.length).fill(0) as number[];
  for (const d of dates) {
    const day = dailyXpForAll(rivals, d, pace);
    for (let i = 0; i < rivals.length; i++) totals[i] += day[i];
  }
  const cap = WEEKLY_CAP_MULTIPLIER * pace * dates.length;
  return totals.map((t, i) => {
    const capped = t > cap ? Math.floor(cap) : t;
    return deRound(capped, rivals[i].id);
  });
}
