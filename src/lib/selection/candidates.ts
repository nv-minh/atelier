import "server-only";
import { prisma } from "../db";
// Deliberately not study-engine's safeJson: study-engine imports this module,
// and pulling a helper back out of it would close an import cycle.
import { parseJsonArray } from "../utils";
import { type Candidate, scoreCandidate } from "./score";
import { explicitWordWhere, resolveSelection } from "./resolve";
import { splitSlots, weightedSampleWithoutReplacement } from "./sample";
import { MAX_WIDEN_ATTEMPTS, bandWindowToLevels, widenPlan } from "./widen";
import { SELECTION } from "./constants";

/** Pool sizes: scored in-process, so these bound the work per request. */
const TOPIC_POOL = 300;
const CORE_POOL = 300;
const PROBE_POOL = 100;

type PoolRow = { id: string; cefr: string; freqPct: number | null; topics: string };

export type LearnerProfileLite = { band: number; topics: string[] };

export async function getLearnerProfile(userId: string): Promise<LearnerProfileLite | null> {
  const p = await prisma.learnerProfile.findUnique({
    where: { userId },
    select: { band: true, topics: true },
  });
  return p ? { band: p.band, topics: parseJsonArray(p.topics) } : null;
}

function toCandidate(r: PoolRow, known: Set<string>): Candidate {
  return {
    id: r.id,
    cefr: r.cefr,
    freqPct: r.freqPct,
    topics: parseJsonArray(r.topics),
    known: known.has(r.id),
  };
}

/**
 * Words the learner has never had a card for.
 *
 * `cards: { none: { userId } }` rather than loading every seen wordId and
 * passing `id: { notIn: [...] }` — that cost a round trip and an array of a few
 * thousand ids on every fetch.
 *
 * `nulls: "last"` is not optional: Postgres sorts NULLs FIRST on DESC, so
 * without it a pool of 300 would be 300 words with no frequency data — which is
 * 4,871 of the 8,011 rows.
 */
async function queryPool(
  userId: string,
  where: Record<string, unknown>,
  take: number
): Promise<PoolRow[]> {
  return prisma.word.findMany({
    where: { ...where, cards: { none: { userId } } },
    select: { id: true, cefr: true, freqPct: true, topics: true },
    orderBy: { freqPct: { sort: "desc", nulls: "last" } },
    take,
  });
}

const topicWhere = (slugs: string[]) =>
  slugs.length ? { OR: slugs.map((s) => ({ topics: { contains: `"${s}"` } })) } : {};

/**
 * Choose up to `limit` new word ids for a learner.
 *
 * Everything decided here comes from the pure modules alongside this file; this
 * function only queries and composes. Scoring happens per request over bounded
 * pools rather than in a precomputed queue table: that table would need
 * invalidating whenever the learner studies, changes topics, or drifts a band —
 * exactly the state that goes stale silently — and there is no job runner to
 * rebuild it.
 *
 * The learner's explicit cefr/topic choice is compiled here via
 * explicitWordWhere and applied to EVERY pool, so the escalation ladder can
 * never widen it away and no caller can forget to pass it.
 */
export async function selectNewWordIds(input: {
  userId: string;
  limit: number;
  filter: { cefr?: string; topic?: string };
  baseWhere?: Record<string, unknown>;
  profile?: LearnerProfileLite | null;
  rng?: () => number;
}): Promise<string[]> {
  const limit = Math.max(0, Math.floor(input.limit));
  if (limit === 0) return [];

  const rng = input.rng ?? Math.random;
  // The learner's explicit choice is merged in last so it always wins.
  const base = { ...(input.baseWhere ?? {}), ...explicitWordWhere(input.filter) };
  const profile =
    input.profile !== undefined ? input.profile : await getLearnerProfile(input.userId);
  const resolved = resolveSelection({ profile, filter: input.filter });

  // No band to aim at: frequency order is the whole strategy, and it already
  // beats the alphabetical ordering this replaced.
  if (resolved.band === null) {
    const rows = await queryPool(input.userId, base, limit);
    return rows.map((r) => r.id);
  }

  const knownIds = new Set(
    (
      await prisma.wordMark.findMany({
        where: { userId: input.userId, known: true },
        select: { wordId: true },
      })
    ).map((m) => m.wordId)
  );

  const target = resolved.band + SELECTION.bandSkew;
  const slots = splitSlots(limit, rng);
  const picked: string[] = [];
  const takenIds = new Set<string>();

  const take = (rows: PoolRow[], count: number, useTopicBoost: boolean) => {
    if (count <= 0) return;
    const pool = rows
      .filter((r) => !takenIds.has(r.id))
      .map((r) => toCandidate(r, knownIds));
    if (!pool.length) return;
    const chosen = weightedSampleWithoutReplacement(
      pool,
      (c) => scoreCandidate(c, { band: resolved.band!, topics: resolved.topics, useTopicBoost }),
      count,
      rng
    );
    for (const c of chosen) {
      takenIds.add(c.id);
      picked.push(c.id);
    }
  };

  for (let attempt = 0; attempt < MAX_WIDEN_ATTEMPTS && picked.length < limit; attempt++) {
    const plan = widenPlan(attempt);
    // An explicit CEFR filter means the learner already chose the level; the
    // band window must not narrow it further.
    const levelWhere =
      plan.requireBandWindow && resolved.applyBandWindow
        ? { cefr: { in: bandWindowToLevels(plan.bandWindow, target) } }
        : {};

    const wantTopic = Math.max(0, slots.topic - picked.length);
    if (plan.useTopicBoost && resolved.topics.length && wantTopic > 0) {
      const rows = await queryPool(
        input.userId,
        { ...base, ...levelWhere, ...topicWhere(resolved.topics) },
        TOPIC_POOL
      );
      take(rows, wantTopic, true);
    }

    // Core: scored WITHOUT the topic boost, so a slice of every session keeps
    // widening the learner's vocabulary instead of narrowing it to one field.
    const remaining = limit - picked.length;
    if (remaining > 0) {
      const coreWant = Math.min(remaining, Math.max(slots.core, remaining - slots.probe));
      const rows = await queryPool(input.userId, { ...base, ...levelWhere }, CORE_POOL);
      take(rows, coreWant, false);
    }

    // Probe: deliberately BELOW the band. This is how a wrongly-assumed "I know
    // this" gets found, and a probe rated Again is the strongest drift signal.
    if (slots.probe > 0 && picked.length < limit && resolved.applyBandWindow) {
      const below = bandWindowToLevels({ lo: -99, hi: -1 }, target);
      const rows = await queryPool(
        input.userId,
        { ...base, cefr: { in: below } },
        PROBE_POOL
      );
      take(rows, Math.min(slots.probe, limit - picked.length), false);
    }

    // Final rung: no band window, frequency order — always yields something if
    // the learner has anything left to see.
    if (picked.length < limit && attempt === MAX_WIDEN_ATTEMPTS - 1) {
      const rows = await queryPool(input.userId, base, limit - picked.length + takenIds.size);
      take(rows, limit - picked.length, false);
    }
  }

  // Shuffle so the probe card is not always last and the three slots are not
  // visibly grouped. Equal weights make this a plain uniform shuffle.
  return weightedSampleWithoutReplacement(picked, () => 1, picked.length, rng);
}
