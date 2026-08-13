import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { isEnabled, setEnabled } from "./feedback-prefs";

// jsdom is not configured for this project (vitest environment is "node"), so
// stub a minimal localStorage on globalThis for these tests.
function stubStorage(seed: Record<string, string> = {}) {
  const store = new Map(Object.entries(seed));
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  });
  return store;
}

describe("feedback-prefs", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("defaults both preferences to ON when nothing is stored", () => {
    stubStorage();
    expect(isEnabled("sound")).toBe(true);
    expect(isEnabled("haptic")).toBe(true);
  });

  it("round-trips a written value", () => {
    stubStorage();
    setEnabled("sound", false);
    expect(isEnabled("sound")).toBe(false);
    expect(isEnabled("haptic")).toBe(true); // independent flags
  });

  it("uses atelier-prefixed keys", () => {
    const store = stubStorage();
    setEnabled("haptic", false);
    expect(store.has("atelier.haptic")).toBe(true);
  });

  it("falls back to ON when the stored value is garbage", () => {
    stubStorage({ "atelier.sound": "banana" });
    expect(isEnabled("sound")).toBe(true);
  });

  it("returns the default and does not throw when localStorage is unavailable (SSR)", () => {
    vi.stubGlobal("localStorage", undefined);
    expect(() => isEnabled("sound")).not.toThrow();
    expect(isEnabled("sound")).toBe(true);
    expect(() => setEnabled("sound", false)).not.toThrow();
  });
});
