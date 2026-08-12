import { RATING } from "./types";
import type { ItemResult, Rating } from "./types";

// Answering and committing are SEPARATE on purpose. An answer becomes `pending`
// first; the shell commits it when the item is left. That is what lets Plan 2 add
// the "quá dễ / may mắn thôi" chip (a plain `adjust` on the pending rating) with a
// single review POST and no re-grade endpoint (spec §6).
export type SessionState = {
  index: number;
  pending: ItemResult | null;
  results: ItemResult[];
  combo: number;
  bestCombo: number;
  skipped: string[];
};

export type SessionAction =
  | { type: "answer"; result: ItemResult }
  | { type: "adjust"; rating: Rating }
  | { type: "commit" }
  | { type: "skip"; cardId: string };

export const initialSessionState: SessionState = {
  index: 0,
  pending: null,
  results: [],
  combo: 0,
  bestCombo: 0,
  skipped: [],
};

export function reduceSession(s: SessionState, a: SessionAction): SessionState {
  switch (a.type) {
    case "answer": {
      if (s.pending) return s; // already answered this item — ignore double submit
      const combo = a.result.correct ? s.combo + 1 : 0;
      return { ...s, pending: a.result, combo, bestCombo: Math.max(s.bestCombo, combo) };
    }
    case "adjust": {
      if (!s.pending) return s;
      return { ...s, pending: { ...s.pending, rating: a.rating } };
    }
    case "commit": {
      if (!s.pending) return { ...s, index: s.index + 1 };
      return { ...s, results: [...s.results, s.pending], pending: null, index: s.index + 1 };
    }
    case "skip":
      return { ...s, skipped: [...s.skipped, a.cardId], pending: null, index: s.index + 1 };
  }
}

export type SessionSummaryData = {
  total: number;
  correct: number;
  pct: number;
  bestCombo: number;
  missed: ItemResult[];
  counts: Record<Rating, number>;
};

export function sessionSummary(s: SessionState): SessionSummaryData {
  const total = s.results.length;
  const correct = s.results.filter((r) => r.correct).length;

  // A card can be answered twice in one run (flashcard requeues on Again), so the
  // missed list is deduped by cardId, keeping the first miss.
  const missed: ItemResult[] = [];
  const seen = new Set<string>();
  for (const r of s.results) {
    if (r.correct || seen.has(r.cardId)) continue;
    seen.add(r.cardId);
    missed.push(r);
  }

  const counts: Record<Rating, number> = {
    [RATING.Again]: 0,
    [RATING.Hard]: 0,
    [RATING.Good]: 0,
    [RATING.Easy]: 0,
  };
  for (const r of s.results) counts[r.rating]++;

  return {
    total,
    correct,
    pct: total ? Math.round((correct / total) * 100) : 0,
    bestCombo: s.bestCombo,
    missed,
    counts,
  };
}
