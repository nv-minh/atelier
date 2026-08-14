// The shared "scope" vocabulary for /browse, study, and export.
//
// Why merge these: the repo used to have three separate scope vocabularies —
// ExportScope ("all"|"starred"|"learned"|"cefr:X"), the study enum
// ("starred"|"leeches"), and /browse's own q/cefr filters. Adding a fourth
// filter without merging them would mean every "study"/"export" button needs
// a translation table between four vocabularies, and that translation table
// is where bugs would live.
//
// This module is PURE: no prisma, no server-only. It only builds `where`
// fragments.
import { STATES, LEARNED_STATES } from "../fsrs";
import { leechCardWhere } from "../leech";
import { CEFR_LEVELS } from "../export-format";
// Pure module (slug list + a keyword regex, no prisma), so it's safe to pull
// into this pure module too.
import { topicBySlug } from "../topic-taxonomy";
// Type-only: erased at compile time, so vitest never loads the actual Prisma
// client and this module stays pure. Gives scopeWhere/filterWhere compile-time
// checking against the real Word schema instead of an unchecked bag of keys.
import type { Prisma } from "@prisma/client";

export const SCOPES = [
  "all", "mine", "learned", "learning", "known", "unseen", "starred", "leeches", "weak",
] as const;
export type Scope = (typeof SCOPES)[number];

// Each consumer declares the subset it accepts — no consumer accepts every scope.
export const BROWSE_SCOPES = ["all", "mine", "learned", "learning", "known", "unseen"] as const;
export const STUDY_SCOPES = ["starred", "leeches", "weak"] as const;
// weak is not here: "weakest" only makes sense together with a limit, and
// export has no notion of a limit.
export const EXPORT_SCOPES = [
  "all", "mine", "learned", "learning", "known", "unseen", "starred", "leeches",
] as const;

export type VaultFilter = { scope: Scope; cefr?: string; topic?: string; q?: string };

export function parseScope(raw: string | null | undefined, allowed: readonly Scope[]): Scope | null {
  if (!raw) return null;
  return (allowed as readonly string[]).includes(raw) ? (raw as Scope) : null;
}

export function parseFilter(
  sp: { scope?: string; cefr?: string; topic?: string; q?: string },
  allowed: readonly Scope[]
): VaultFilter {
  const out: VaultFilter = { scope: parseScope(sp.scope, allowed) ?? "all" };

  // Backward-compatible alias: the old ExportScope encoded the CEFR level
  // into the scope itself ("cefr:B2"). Keep recognizing it so already-running
  // export URLs don't break.
  let cefr = sp.cefr;
  if (sp.scope?.startsWith("cefr:")) {
    const level = sp.scope.slice("cefr:".length);
    if ((CEFR_LEVELS as readonly string[]).includes(level)) cefr = level;
  }

  if (cefr && cefr !== "ALL" && (CEFR_LEVELS as readonly string[]).includes(cefr)) out.cefr = cefr;
  // Dropped exactly like an invalid cefr is: an unrecognized slug (or a
  // crafted string trying to smuggle content into a downstream header, e.g.
  // the export route's Content-Disposition filename) never reaches a caller.
  if (sp.topic && sp.topic !== "ALL" && topicBySlug(sp.topic)) out.topic = sp.topic;
  const q = sp.q?.trim().toLowerCase();
  if (q) out.q = q;
  return out;
}

export function scopeWhere(scope: Scope, userId: string): Prisma.WordWhereInput {
  switch (scope) {
    case "mine":
      return {
        OR: [
          { cards: { some: { userId } } },
          { marks: { some: { userId, OR: [{ starred: true }, { known: true }] } } },
        ],
      };
    case "learned":
      return { cards: { some: { userId, state: { in: [...LEARNED_STATES] } } } };
    // state 0 is part of "learning" because a Card is only created once a word
    // has entered a session (fetchNewCards): card state 0 means "seen, not yet
    // graduated".
    case "learning":
      return { cards: { some: { userId, state: { in: [STATES.New, STATES.Learning] } } } };
    case "known":
      return { marks: { some: { userId, known: true } } };
    case "unseen":
      // A word the learner explicitly marked known HAS been encountered —
      // declaring knowledge is an encounter. Without this second clause, a
      // word dismissed via mark-known (the sanctioned way to say "stop asking
      // me about this word", see bulk.ts) would stay in "unseen" forever, and
      // since scope=unseen is the most natural place to bulk-mark, the button
      // would look broken exactly where it is used most.
      return {
        cards: { none: { userId } },
        marks: { none: { userId, known: true } },
      };
    case "starred":
      return { marks: { some: { userId, starred: true } } };
    case "leeches":
      return { cards: { some: { userId, ...leechCardWhere() } } };
    // weak filters like learning+ but its whole point is a different order,
    // and the ordering has to happen at the card layer (weak-server.ts)
    // because Prisma can't orderBy across a relation.
    case "weak":
      return { cards: { some: { userId, state: { gte: STATES.Learning } } } };
    case "all":
    default:
      return {};
  }
}

export function filterWhere(f: VaultFilter, userId: string | null): Prisma.WordWhereInput {
  const where: Prisma.WordWhereInput = {};
  if (f.cefr) where.cefr = f.cefr;
  // Word.topics is a JSON array stored as a string — same shape as studyWordFilter.
  if (f.topic) where.topics = { contains: `"${f.topic}"` };
  if (f.q) where.word = { contains: f.q };
  if (userId && f.scope !== "all") Object.assign(where, scopeWhere(f.scope, userId));
  return where;
}
