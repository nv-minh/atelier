import { afterEach, describe, expect, it, vi } from "vitest";
import { DRAFT_KEY, DRAFT_VERSION, type PlacementDraft, clearDraft, readDraft, writeDraft } from "./storage";

function stubStorage(seed: Record<string, string> = {}) {
  const store = new Map(Object.entries(seed));
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  });
  return store;
}

const draft = (over: Partial<PlacementDraft> = {}): PlacementDraft => ({
  version: DRAFT_VERSION,
  takenAt: 1_700_000_000_000,
  items: [{ wordId: "w1", known: true }],
  traps: [{ word: "flimper", known: false }],
  topics: ["medical"],
  estimate: { band: 2.5, vocabSizeEst: 4200, estimatorVersion: 1 },
  ...over,
});

afterEach(() => vi.unstubAllGlobals());

describe("writeDraft / readDraft", () => {
  it("round-trips a draft", () => {
    stubStorage();
    const d = draft();
    writeDraft(d);
    expect(readDraft()).toEqual(d);
  });

  it("returns null when nothing was ever saved", () => {
    stubStorage();
    expect(readDraft()).toBeNull();
  });

  it("stores under a versioned key", () => {
    const store = stubStorage();
    writeDraft(draft());
    expect(store.has(DRAFT_KEY)).toBe(true);
  });
});

describe("rejecting drafts it cannot trust", () => {
  it("discards a draft written by a different version", () => {
    // A future version may mean different item semantics; applying it would
    // write a wrong band rather than fail loudly.
    stubStorage({ [DRAFT_KEY]: JSON.stringify(draft({ version: DRAFT_VERSION + 1 })) });
    expect(readDraft()).toBeNull();
  });

  it("discards unparseable JSON instead of throwing", () => {
    stubStorage({ [DRAFT_KEY]: "{not json" });
    expect(readDraft()).toBeNull();
  });

  it("discards a draft missing its answers", () => {
    stubStorage({ [DRAFT_KEY]: JSON.stringify({ version: DRAFT_VERSION, takenAt: 1 }) });
    expect(readDraft()).toBeNull();
  });

  it("discards a draft whose items are not answer objects", () => {
    stubStorage({
      [DRAFT_KEY]: JSON.stringify(draft({ items: ["w1", "w2"] as unknown as PlacementDraft["items"] })),
    });
    expect(readDraft()).toBeNull();
  });

  it("discards a draft with no timestamp, which the idempotency check needs", () => {
    stubStorage({ [DRAFT_KEY]: JSON.stringify(draft({ takenAt: 0 })) });
    expect(readDraft()).toBeNull();
  });
});

describe("clearDraft", () => {
  it("removes the draft", () => {
    stubStorage();
    writeDraft(draft());
    clearDraft();
    expect(readDraft()).toBeNull();
  });

  it("is safe to call when there is nothing to clear", () => {
    stubStorage();
    expect(() => clearDraft()).not.toThrow();
  });
});

describe("surviving a hostile storage environment", () => {
  it("does not throw when reading is blocked", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("SecurityError");
      },
      setItem: () => {},
      removeItem: () => {},
    });
    expect(readDraft()).toBeNull();
  });

  it("does not throw when writing is blocked", () => {
    // Private browsing and full quotas both throw on setItem. Losing the draft
    // is acceptable; crashing the onboarding flow is not.
    vi.stubGlobal("localStorage", {
      getItem: () => null,
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
      removeItem: () => {},
    });
    expect(() => writeDraft(draft())).not.toThrow();
  });

  it("does not throw when localStorage is absent entirely", () => {
    vi.stubGlobal("localStorage", undefined);
    expect(readDraft()).toBeNull();
    expect(() => writeDraft(draft())).not.toThrow();
    expect(() => clearDraft()).not.toThrow();
  });
});
