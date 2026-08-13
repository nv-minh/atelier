import { CEFR_LEVELS } from "../export-format";
import { topicBySlug } from "../topic-taxonomy";

export type ResolvedSelection = {
  /**
   * "profile"   — score against the learner's inferred band and interests
   * "explicit"  — the learner filtered by hand; that wins over any inference
   * "frequency" — nothing known about them; fall back to frequency order
   */
  strategy: "profile" | "explicit" | "frequency";
  /** Target on the continuous CEFR scale, or null when unknown. */
  band: number | null;
  topics: string[];
  /**
   * False whenever a band window would fight a decision the learner made.
   * An explicit `cefr=A1` from a C1 profile would otherwise intersect [B2, C1]
   * with A1 and return nothing at all.
   */
  applyBandWindow: boolean;
};

/** `studyWordFilter` treats "ALL" as unset; do the same here or they disagree. */
function actual(v: string | undefined): string | undefined {
  return v && v !== "ALL" ? v : undefined;
}

/**
 * Compile the learner's own cefr/topic choice into a Prisma `where` fragment.
 *
 * Lives here, next to resolveSelection, because both answer the same question:
 * what did the learner actually ask for? The selector applies this to every
 * candidate pool itself rather than trusting its caller to have done it — a
 * caller that passed the filter but not the compiled clause silently returned
 * words outside the requested level.
 *
 * Mirrors study-engine's studyWordFilter, duplicated rather than imported
 * because study-engine imports the selector (import cycle).
 */
export function explicitWordWhere(filter: {
  cefr?: string;
  topic?: string;
}): Record<string, unknown> {
  const w: Record<string, unknown> = {};
  const cefr = actual(filter.cefr);
  const topic = actual(filter.topic);
  if (cefr) w.cefr = cefr;
  if (topic) w.topics = { contains: `"${topic}"` };
  return w;
}

function bandOf(cefr: string): number | null {
  const i = (CEFR_LEVELS as readonly string[]).indexOf(cefr);
  return i === -1 ? null : i;
}

const clampBand = (n: number) => Math.min(CEFR_LEVELS.length - 1, Math.max(0, n));

/**
 * Decide what to select against, given what the learner asked for and what the
 * system inferred about them.
 *
 * The rule this exists to enforce: **an explicit filter always beats a stored
 * profile.** The profile is a guess the app made; a click is something the
 * learner said. If they want A1 words, they get A1 words, whatever their band.
 *
 * Stale topic slugs are dropped rather than passed through — crawl batches add
 * and rename topics, and a slug that no longer exists would become a filter
 * matching nothing.
 */
export function resolveSelection(input: {
  profile: { band: number; topics: string[] } | null;
  filter: { cefr?: string; topic?: string };
}): ResolvedSelection {
  const cefr = actual(input.filter.cefr);
  const topic = actual(input.filter.topic);

  const explicitBand = cefr ? bandOf(cefr) : null;
  const live = (slugs: string[]) => slugs.filter((s) => topicBySlug(s) !== undefined);

  // An explicit topic replaces the profile's interests entirely; an explicit
  // CEFR overrides the band and switches the window off.
  const topics = topic ? live([topic]) : live(input.profile?.topics ?? []);

  if (explicitBand !== null) {
    return { strategy: "explicit", band: explicitBand, topics, applyBandWindow: false };
  }

  if (!input.profile) {
    return { strategy: "frequency", band: null, topics, applyBandWindow: false };
  }

  return {
    strategy: "profile",
    band: clampBand(input.profile.band),
    topics,
    applyBandWindow: true,
  };
}
