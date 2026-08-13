import { describe, it, expect, vi, afterEach } from "vitest";
import {
  localDay,
  isDismissed,
  recordDismissed,
  readCachedQuote,
  writeCachedQuote,
} from "./quote-prefs";

function stubStorage(seed: Record<string, string> = {}) {
  const store = new Map(Object.entries(seed));
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  });
  return store;
}

/** Storage that throws on every access — private mode, blocked cookies. */
function stubBlockedStorage() {
  vi.stubGlobal("localStorage", {
    getItem: () => {
      throw new Error("blocked");
    },
    setItem: () => {
      throw new Error("blocked");
    },
  });
}

const CACHE_KEY = "atelier.quote.today";
const AUG_13 = new Date(2026, 7, 13, 10, 0, 0);
const AUG_14 = new Date(2026, 7, 14, 10, 0, 0);

const LIVE = { text: "Little by little, one travels far.", author: "Tolkien", source: "zenquotes" };

afterEach(() => vi.unstubAllGlobals());

describe("localDay", () => {
  it("uses local calendar fields, not the UTC date", () => {
    // 00:30 on the 14th in UTC+7 is still the 13th in UTC. The reader is
    // looking at the 14th, so that is the day the quote rolls over on.
    expect(localDay(new Date(2026, 7, 14, 0, 30))).toBe("2026-08-14");
  });

  it("zero-pads months and days", () => {
    expect(localDay(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});

describe("dismissal", () => {
  it("hides the quote for the rest of the day it was dismissed on", () => {
    stubStorage();
    recordDismissed(AUG_13);
    expect(isDismissed(AUG_13)).toBe(true);
  });

  it("comes back the next day", () => {
    stubStorage();
    recordDismissed(AUG_13);
    expect(isDismissed(AUG_14)).toBe(false);
  });

  it("is not dismissed when nothing was ever stored", () => {
    stubStorage();
    expect(isDismissed(AUG_13)).toBe(false);
  });
});

describe("daily cache", () => {
  it("returns today's quote so no second request is made", () => {
    stubStorage();
    writeCachedQuote(LIVE, AUG_13);
    expect(readCachedQuote(AUG_13)).toEqual({ text: LIVE.text, author: LIVE.author });
  });

  it("treats yesterday's quote as stale — a new day means a new fetch", () => {
    stubStorage();
    writeCachedQuote(LIVE, AUG_13);
    expect(readCachedQuote(AUG_14)).toBeNull();
  });

  // A fallback means ZenQuotes was down or throttling. Pinning it for the day
  // would keep serving the stand-in long after the real API recovered.
  it("refuses to store a fallback quote", () => {
    const store = stubStorage();
    writeCachedQuote({ text: "Curated stand-in.", author: "Anon", source: "fallback" }, AUG_13);
    expect(store.has(CACHE_KEY)).toBe(false);
    expect(readCachedQuote(AUG_13)).toBeNull();
  });

  it("stores a quote with no source field (nothing says it is a fallback)", () => {
    stubStorage();
    writeCachedQuote({ text: "Plain quote.", author: "Anon" }, AUG_13);
    expect(readCachedQuote(AUG_13)).toEqual({ text: "Plain quote.", author: "Anon" });
  });

  it("ignores an empty quote instead of caching a blank card", () => {
    const store = stubStorage();
    writeCachedQuote({ text: "", author: "Nobody", source: "zenquotes" }, AUG_13);
    expect(store.has(CACHE_KEY)).toBe(false);
  });

  it("survives a corrupt entry by refetching", () => {
    stubStorage({ [CACHE_KEY]: "{not json" });
    expect(readCachedQuote(AUG_13)).toBeNull();
  });

  it("ignores an entry missing its text", () => {
    stubStorage({ [CACHE_KEY]: JSON.stringify({ day: localDay(AUG_13), author: "Tolkien" }) });
    expect(readCachedQuote(AUG_13)).toBeNull();
  });

  it("degrades to no-cache when storage is blocked, never throwing", () => {
    stubBlockedStorage();
    expect(() => writeCachedQuote(LIVE, AUG_13)).not.toThrow();
    expect(readCachedQuote(AUG_13)).toBeNull();
    expect(isDismissed(AUG_13)).toBe(false);
    expect(() => recordDismissed(AUG_13)).not.toThrow();
  });
});
