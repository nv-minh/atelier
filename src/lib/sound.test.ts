import { describe, it, expect, vi, afterEach } from "vitest";
// NOTE: sound.ts is imported dynamically inside each test, never statically.
// Each case stubs globals first, then imports, so the module's lazy AudioContext
// state starts fresh (vi.resetModules() in afterEach clears the registry).

function stubPrefs(soundOn: boolean) {
  const store = new Map<string, string>([["atelier.sound", soundOn ? "1" : "0"]]);
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  });
}

// Minimal AudioContext stand-in: records construction and hands back the
// node shapes sound.ts uses.
function stubAudioContext() {
  const ctor = vi.fn(function (this: any) {
    this.state = "running";
    this.currentTime = 0;
    this.destination = {};
    this.resume = vi.fn();
    this.createOscillator = () => ({
      type: "sine",
      frequency: { setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() },
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    });
    this.createGain = () => ({
      gain: {
        setValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
    });
  });
  vi.stubGlobal("AudioContext", ctor);
  vi.stubGlobal("window", { AudioContext: ctor });
  return ctor;
}

describe("playSound", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("never constructs an AudioContext while sound is muted", async () => {
    stubPrefs(false);
    const ctor = stubAudioContext();
    const { playSound: play } = await import("./sound");
    play("correct");
    expect(ctor).not.toHaveBeenCalled();
  });

  it("constructs the AudioContext lazily and only once across calls", async () => {
    stubPrefs(true);
    const ctor = stubAudioContext();
    const { playSound: play } = await import("./sound");
    expect(ctor).not.toHaveBeenCalled(); // nothing at import time
    play("correct");
    play("wrong");
    play("tap");
    expect(ctor).toHaveBeenCalledTimes(1);
  });

  it("does not throw when the platform has no AudioContext", async () => {
    stubPrefs(true);
    vi.stubGlobal("AudioContext", undefined);
    vi.stubGlobal("window", {});
    const { playSound: play } = await import("./sound");
    expect(() => play("correct")).not.toThrow();
  });
});
