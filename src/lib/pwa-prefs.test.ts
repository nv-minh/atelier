import { describe, it, expect, vi, afterEach } from "vitest";
import {
  recordSessionDone,
  sessionsDone,
  recordDismissed,
  isDismissalActive,
  isStandalone,
  shouldOffer,
  DISMISS_DAYS,
} from "./pwa-prefs";

const DAY = 24 * 60 * 60 * 1000;

function stubStorage(seed: Record<string, string> = {}) {
  const store = new Map(Object.entries(seed));
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  });
  return store;
}

// The app counts as "installed" when either signal says so.
function stubDisplayMode(opts: { standalone?: boolean; iosStandalone?: boolean } = {}) {
  vi.stubGlobal("window", {
    matchMedia: (q: string) => ({ matches: !!opts.standalone && q.includes("standalone") }),
  });
  vi.stubGlobal("navigator", { standalone: opts.iosStandalone ?? false, userAgent: "test" });
}

describe("pwa-prefs", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("starts with zero completed sessions", () => {
    stubStorage();
    expect(sessionsDone()).toBe(0);
  });

  it("counts completed sessions", () => {
    stubStorage();
    recordSessionDone();
    recordSessionDone();
    expect(sessionsDone()).toBe(2);
  });

  it("uses an atelier-prefixed key for the counter", () => {
    const store = stubStorage();
    recordSessionDone();
    expect(store.has("atelier.sessionsDone")).toBe(true);
  });

  it("treats a garbage counter value as zero rather than NaN", () => {
    stubStorage({ "atelier.sessionsDone": "banana" });
    expect(sessionsDone()).toBe(0);
  });

  it("remembers a dismissal for DISMISS_DAYS and then forgets it", () => {
    stubStorage();
    const t0 = 1_000_000_000_000;
    recordDismissed(t0);
    expect(isDismissalActive(t0)).toBe(true);
    expect(isDismissalActive(t0 + (DISMISS_DAYS - 1) * DAY)).toBe(true);
    expect(isDismissalActive(t0 + (DISMISS_DAYS + 1) * DAY)).toBe(false);
  });

  it("reports no active dismissal when none was ever recorded", () => {
    stubStorage();
    expect(isDismissalActive(1_000_000_000_000)).toBe(false);
  });

  it("detects standalone via display-mode", () => {
    stubStorage();
    stubDisplayMode({ standalone: true });
    expect(isStandalone()).toBe(true);
  });

  it("detects standalone via the iOS navigator flag", () => {
    stubStorage();
    stubDisplayMode({ iosStandalone: true });
    expect(isStandalone()).toBe(true);
  });

  it("does not offer before the session threshold is met", () => {
    stubStorage();
    stubDisplayMode();
    expect(shouldOffer(1_000_000_000_000)).toBe(false);
  });

  it("offers once the session threshold is met", () => {
    stubStorage();
    stubDisplayMode();
    recordSessionDone();
    expect(shouldOffer(1_000_000_000_000)).toBe(true);
  });

  it("never offers while running standalone, however many sessions are done", () => {
    stubStorage();
    stubDisplayMode({ standalone: true });
    recordSessionDone();
    recordSessionDone();
    expect(shouldOffer(1_000_000_000_000)).toBe(false);
  });

  it("does not offer while a dismissal is still active", () => {
    stubStorage();
    stubDisplayMode();
    recordSessionDone();
    const t0 = 1_000_000_000_000;
    recordDismissed(t0);
    expect(shouldOffer(t0 + DAY)).toBe(false);
    expect(shouldOffer(t0 + (DISMISS_DAYS + 1) * DAY)).toBe(true);
  });

  it("does not throw when localStorage is unavailable (SSR)", () => {
    vi.stubGlobal("localStorage", undefined);
    stubDisplayMode();
    expect(() => sessionsDone()).not.toThrow();
    expect(() => recordSessionDone()).not.toThrow();
    expect(sessionsDone()).toBe(0);
  });
});
