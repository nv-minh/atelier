/**
 * The guest's placement draft, kept in localStorage until they log in.
 *
 * A guest can take the whole test without an account (that is the point — the
 * ask for a login lands after they have seen their result, not before). This
 * module owns only the storage; the flow lives in the /onboarding route and the
 * apply step in POST /api/placement/result.
 *
 * React-free and defensive, following pwa-prefs.ts: every localStorage call can
 * throw (private browsing, full quota, blocked storage), and losing a draft is
 * always preferable to breaking the page.
 *
 * NOTE on idempotency: whether a draft may be applied is decided by the SERVER,
 * which compares `takenAt` against the stored `placedAt`. Two tabs applying the
 * same draft is a server concern, and localStorage cannot be trusted to arbitrate
 * it.
 */
export const DRAFT_VERSION = 1;
export const DRAFT_KEY = "vm.placement.v1";

export type PlacementDraft = {
  version: number;
  /** Epoch ms. Required — the server's replay check has nothing to compare without it. */
  takenAt: number;
  items: Array<{ wordId: string; known: boolean }>;
  traps: Array<{ word: string; known: boolean }>;
  topics: string[];
  estimate: { band: number; vocabSizeEst: number; estimatorVersion: number };
};

function isAnswerList(v: unknown, key: "wordId" | "word"): boolean {
  return (
    Array.isArray(v) &&
    v.every(
      (x) =>
        x !== null &&
        typeof x === "object" &&
        typeof (x as Record<string, unknown>)[key] === "string" &&
        typeof (x as Record<string, unknown>).known === "boolean"
    )
  );
}

/**
 * Read the draft, or null if there isn't a trustworthy one.
 *
 * Validates rather than casts: this data comes from the browser and can be
 * hand-edited, half-written by an interrupted tab, or left over from an older
 * release. A malformed draft that reached the server would store a wrong band
 * silently, which is worse than losing it.
 */
export function readDraft(): PlacementDraft | null {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(DRAFT_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;

  try {
    const d = JSON.parse(raw) as Partial<PlacementDraft>;
    if (!d || typeof d !== "object") return null;
    // A different version may mean different item semantics.
    if (d.version !== DRAFT_VERSION) return null;
    if (typeof d.takenAt !== "number" || !Number.isFinite(d.takenAt) || d.takenAt <= 0) return null;
    if (!isAnswerList(d.items, "wordId")) return null;
    if (!isAnswerList(d.traps, "word")) return null;
    if (!Array.isArray(d.topics) || !d.topics.every((t) => typeof t === "string")) return null;
    if (!d.estimate || typeof d.estimate.band !== "number") return null;
    return d as PlacementDraft;
  } catch {
    return null;
  }
}

export function writeDraft(draft: PlacementDraft): void {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // Storage blocked or full. The learner loses the draft on reload; the test
    // itself still works, and the result screen is still shown.
  }
}

export function clearDraft(): void {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    // Nothing to do — a draft that cannot be removed is re-validated on read.
  }
}
