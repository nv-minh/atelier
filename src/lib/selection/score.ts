import { CEFR_LEVELS } from "../export-format";
import { topicBySlug } from "../topic-taxonomy";
import { SELECTION } from "./constants";

/** The slim shape the pool queries select — never a whole Word row. */
export type Candidate = {
  id: string;
  cefr: string;
  freqPct: number | null;
  topics: string[];
  known: boolean;
};

export type ScoreContext = {
  /** Continuous CEFR scale, A1=0 … C1=4. */
  band: number;
  /** Slugs the learner chose. Stale slugs are ignored, not treated as matches. */
  topics: string[];
  /** The widen path switches this off to reach outside the chosen topics. */
  useTopicBoost: boolean;
};

/**
 * CEFR label → position on the continuous band scale, or null when the label is
 * not one of the five. Unknown labels do exist: `cefr` is a plain string column
 * and a bad import could write anything, so this must not become NaN and poison
 * the whole score.
 */
export function cefrIndex(cefr: string): number | null {
  const i = (CEFR_LEVELS as readonly string[]).indexOf(cefr);
  return i === -1 ? null : i;
}

/**
 * How much to trust a topic tag as evidence of intent.
 *
 * "curated" is reserved for a topic that is curated AND keyword-free, because
 * only then does the slug prove a human put it there at import time. A topic
 * that is curated but also has keywords (today: `travel`) can acquire its slug
 * either way, so the tag proves nothing and gets the lower tier. Reading
 * `Topic.curated` alone would silently over-boost every hybrid topic.
 */
export function topicTier(slug: string): "curated" | "keyword" | "unknown" {
  const t = topicBySlug(slug);
  if (!t) return "unknown";
  return t.curated && t.keywords.length === 0 ? "curated" : "keyword";
}

function topicBoost(c: Candidate, ctx: ScoreContext): number {
  if (!ctx.useTopicBoost || !ctx.topics.length || !c.topics.length) {
    return SELECTION.topicBoostNone;
  }
  // MAX, not product: a word matching a curated and a keyword topic is not
  // twice as on-topic, and compounding would let two weak signals outrank one
  // strong one.
  // Annotated: SELECTION is `as const`, so inference would pin this to the
  // literal 1 and reject every Math.max result below.
  let best: number = SELECTION.topicBoostNone;
  for (const slug of ctx.topics) {
    if (!c.topics.includes(slug)) continue;
    const tier = topicTier(slug);
    if (tier === "curated") best = Math.max(best, SELECTION.topicBoostCurated);
    else if (tier === "keyword") best = Math.max(best, SELECTION.topicBoostKeyword);
    // "unknown" — a slug that left the taxonomy — contributes nothing.
  }
  return best;
}

function bandFit(c: Candidate, ctx: ScoreContext): number {
  const idx = cefrIndex(c.cefr);
  // No usable level: stay neutral rather than guess. Guessing 0 would make every
  // malformed row look like an A1 word and flood beginners with junk.
  if (idx === null) return 1;
  const target = ctx.band + SELECTION.bandSkew;
  const d = idx - target;
  return Math.exp(-(d * d) / (2 * SELECTION.bandSigma * SELECTION.bandSigma));
}

function freqScore(c: Candidate): number {
  if (c.freqPct === null || !Number.isFinite(c.freqPct)) return SELECTION.freqUnknown;
  const pct = Math.min(1, Math.max(0, c.freqPct));
  return SELECTION.freqFloor + SELECTION.freqSpan * pct;
}

/**
 * Score one candidate word for one learner.
 *
 *     score = bandFit x topicBoost x freqScore x knownPenalty
 *
 * Multiplicative on purpose: each factor is a veto-by-degree, so a word that is
 * wrong for the learner's level cannot be rescued by being frequent and
 * on-topic. The result is a sampling WEIGHT, not a probability — only its
 * ratio to other candidates matters.
 *
 * Always strictly positive: nothing is ever impossible, so a wrong band
 * estimate or a mistaken "I know this" can always be corrected by a probe.
 */
export function scoreCandidate(c: Candidate, ctx: ScoreContext): number {
  const known = c.known ? SELECTION.knownPenalty : 1;
  return bandFit(c, ctx) * topicBoost(c, ctx) * freqScore(c) * known;
}
