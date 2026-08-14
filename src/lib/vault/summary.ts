// The vault's summary strip. Pure shaping: turn the raw groupBy result into
// the numbers the strip renders. Does NOT call getDashboardStats — that
// function also fetches the last 100 ReviewLogs and does a whole-CEFR fanout
// this strip has no use for.
import { STATES, LEARNED_STATES } from "../fsrs";

export type SummaryInput = {
  cardStates: { state: number; count: number }[];
  knownCount: number;
  bandLevel: string | null;
  bandTotal?: number;
  bandLearned?: number;
};

export type VaultSummary = {
  seen: number;
  learned: number;
  learning: number;
  known: number;
  band: { level: string; learned: number; total: number } | null;
};

const LEARNED = new Set<number>(LEARNED_STATES);
const LEARNING = new Set<number>([STATES.New, STATES.Learning]);

export function shapeSummary(input: SummaryInput): VaultSummary {
  let seen = 0;
  let learned = 0;
  let learning = 0;
  for (const row of input.cardStates) {
    seen += row.count;
    if (LEARNED.has(row.state)) learned += row.count;
    else if (LEARNING.has(row.state)) learning += row.count;
    // Unknown state values (stale/corrupt data outside 0..3) still count
    // toward seen, but neither bucket — better an undercount than a crash.
  }
  return {
    seen,
    learned,
    learning,
    known: input.knownCount,
    // The band bar is built from two cheap counts (bandTotal, bandLearned)
    // scoped to the learner's own CEFR band, instead of scanning every card
    // the user owns the way getDashboardStats does to build all five bands.
    band: input.bandLevel
      ? { level: input.bandLevel, learned: input.bandLearned ?? 0, total: input.bandTotal ?? 0 }
      : null,
  };
}
