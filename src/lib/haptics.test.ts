import { describe, it, expect, vi, afterEach } from "vitest";
import { vibrate } from "./haptics";

function stubPrefs(soundOn: boolean, hapticOn: boolean) {
  const store = new Map<string, string>([
    ["atelier.sound", soundOn ? "1" : "0"],
    ["atelier.haptic", hapticOn ? "1" : "0"],
  ]);
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  });
}

describe("vibrate", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("does not throw when the platform has no vibrate (iOS Safari)", () => {
    stubPrefs(true, true);
    vi.stubGlobal("navigator", {});
    expect(() => vibrate(10)).not.toThrow();
  });

  it("calls navigator.vibrate with the given pattern when supported", () => {
    stubPrefs(true, true);
    const spy = vi.fn();
    vi.stubGlobal("navigator", { vibrate: spy });
    vibrate([20, 40, 20]);
    expect(spy).toHaveBeenCalledWith([20, 40, 20]);
  });

  it("does nothing when the haptic preference is off", () => {
    stubPrefs(true, false);
    const spy = vi.fn();
    vi.stubGlobal("navigator", { vibrate: spy });
    vibrate(10);
    expect(spy).not.toHaveBeenCalled();
  });
});
