// Validate a bulk request. Pure, so it can be tested without a DB.
export const BULK_MAX = 40; // = /browse's perPage: only act on the page the user is looking at

// Note what is deliberately NOT here: no Card delete, no ReviewLog delete.
// "Stop asking me about this word" goes through mark-known because that
// signal is reversible.
export const BULK_ACTIONS = ["mark-known", "unmark-known", "star", "unstar", "reset"] as const;
export type BulkAction = (typeof BULK_ACTIONS)[number];

type Parsed =
  | { ok: true; wordIds: string[]; action: BulkAction }
  | { ok: false; error: string };

export function parseBulkRequest(body: unknown): Parsed {
  if (!body || typeof body !== "object") return { ok: false, error: "body required" };
  const { wordIds, action } = body as { wordIds?: unknown; action?: unknown };

  if (typeof action !== "string" || !(BULK_ACTIONS as readonly string[]).includes(action)) {
    return { ok: false, error: "invalid action" };
  }
  if (!Array.isArray(wordIds) || wordIds.length === 0) {
    return { ok: false, error: "wordIds required" };
  }
  if (!wordIds.every((id) => typeof id === "string" && id.length > 0)) {
    return { ok: false, error: "wordIds must be strings" };
  }
  const unique = [...new Set(wordIds as string[])];
  if (unique.length > BULK_MAX) return { ok: false, error: `at most ${BULK_MAX} words` };

  return { ok: true, wordIds: unique, action: action as BulkAction };
}
