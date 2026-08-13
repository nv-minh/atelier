import { describe, it, expect, vi, afterEach } from "vitest";

// NOTE: tts.ts is imported dynamically inside each test, never statically, so
// the module's voice cache and its "utterance still alive" reference start
// fresh every case (vi.resetModules() in afterEach clears the registry).

type FakeUtterance = {
  text: string;
  rate: number;
  pitch: number;
  lang?: string;
  voice?: unknown;
  addEventListener: (type: string, fn: (e?: any) => void) => void;
  fire: (type: string, e?: any) => void;
};

/**
 * Stand-in for the Web Speech API. `speak` records the utterance but does NOT
 * fire any event on its own — each test drives start/end/error explicitly,
 * which is the only way to model an engine that accepts an utterance and then
 * silently never starts it.
 */
function stubSpeech(opts?: { voices?: Array<{ name: string; lang: string }> }) {
  const spoken: FakeUtterance[] = [];
  const synth = {
    speaking: false,
    pending: false,
    paused: false,
    speak: vi.fn((u: FakeUtterance) => void spoken.push(u)),
    cancel: vi.fn(),
    resume: vi.fn(),
    getVoices: () => opts?.voices ?? [{ name: "Samantha", lang: "en-US" }],
    onvoiceschanged: null as null | (() => void),
  };

  const Utterance = vi.fn(function (this: any, text: string) {
    const listeners = new Map<string, Array<(e?: any) => void>>();
    this.text = text;
    this.rate = 1;
    this.pitch = 1;
    this.addEventListener = (type: string, fn: (e?: any) => void) => {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type)!.push(fn);
    };
    this.fire = (type: string, e?: any) => {
      for (const fn of listeners.get(type) ?? []) fn(e);
    };
  });

  vi.stubGlobal("window", { speechSynthesis: synth, SpeechSynthesisUtterance: Utterance, setTimeout, clearTimeout });
  vi.stubGlobal("speechSynthesis", synth);
  vi.stubGlobal("SpeechSynthesisUtterance", Utterance);
  return { synth, spoken };
}

describe("speak", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    vi.resetModules();
  });

  it("does not cancel an idle queue — cancel() immediately before speak() can drop the utterance in Chrome", async () => {
    const { synth, spoken } = stubSpeech();
    const { speak } = await import("./tts");

    speak("serendipity");

    expect(synth.cancel).not.toHaveBeenCalled();
    expect(spoken).toHaveLength(1);
  });

  it("cancels a busy queue first, and defers the new utterance to a later task", async () => {
    vi.useFakeTimers();
    const { synth, spoken } = stubSpeech();
    synth.speaking = true; // something is already talking
    const { speak } = await import("./tts");

    speak("serendipity");

    expect(synth.cancel).toHaveBeenCalledTimes(1);
    expect(spoken).toHaveLength(0); // not in the same task as cancel()

    vi.runAllTimers();
    expect(spoken).toHaveLength(1);
  });

  it("reports start and end from the real utterance events", async () => {
    const { spoken } = stubSpeech();
    const onStart = vi.fn();
    const onEnd = vi.fn();
    const { speak } = await import("./tts");

    speak("a quote worth hearing", { onStart, onEnd });
    expect(onStart).not.toHaveBeenCalled();

    spoken[0].fire("start");
    expect(onStart).toHaveBeenCalledTimes(1);

    spoken[0].fire("end");
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it("fails loudly when the engine accepts the utterance but never starts it", async () => {
    vi.useFakeTimers();
    const { synth, spoken } = stubSpeech();
    const onFail = vi.fn();
    const { speak } = await import("./tts");

    speak("Keep your face to the sunshine.", { onFail });
    expect(spoken).toHaveLength(1); // accepted...
    expect(onFail).not.toHaveBeenCalled();

    vi.advanceTimersByTime(5000); // ...but silent

    expect(onFail).toHaveBeenCalledTimes(1);
    // and the wedged utterance is cleared so it cannot poison later calls
    expect(synth.cancel).toHaveBeenCalled();
  });

  it("does not report failure once speech has actually started", async () => {
    vi.useFakeTimers();
    const { spoken } = stubSpeech();
    const onFail = vi.fn();
    const { speak } = await import("./tts");

    speak("a long quote that takes a while to read aloud", { onFail });
    spoken[0].fire("start");

    vi.advanceTimersByTime(60_000);

    expect(onFail).not.toHaveBeenCalled();
  });

  it("treats an error event as a failure, not a completion", async () => {
    const { spoken } = stubSpeech();
    const onEnd = vi.fn();
    const onFail = vi.fn();
    const { speak } = await import("./tts");

    speak("hello", { onEnd, onFail });
    spoken[0].fire("error", { error: "synthesis-failed" });

    expect(onFail).toHaveBeenCalledTimes(1);
    expect(onEnd).not.toHaveBeenCalled();
  });

  it("reports failure instead of throwing when the platform has no speech synthesis", async () => {
    vi.stubGlobal("window", {});
    vi.stubGlobal("speechSynthesis", undefined);
    const onFail = vi.fn();
    const { speak } = await import("./tts");

    expect(() => speak("hello", { onFail })).not.toThrow();
    expect(onFail).toHaveBeenCalledTimes(1);
  });

  it("applies the requested rate and picks an English voice", async () => {
    const { spoken } = stubSpeech();
    const { speak } = await import("./tts");

    speak("hello", { rate: 0.88 });

    expect(spoken[0].rate).toBe(0.88);
    expect(spoken[0].lang).toBe("en-US");
  });
});

describe("stopSpeaking", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    vi.resetModules();
  });

  it("cancels the queue and suppresses the pending failure watchdog", async () => {
    vi.useFakeTimers();
    const { synth } = stubSpeech();
    const onFail = vi.fn();
    const { speak, stopSpeaking } = await import("./tts");

    speak("a quote the reader interrupts", { onFail });
    stopSpeaking();

    expect(synth.cancel).toHaveBeenCalled();

    vi.advanceTimersByTime(10_000);
    // Stopping on purpose is not a failure.
    expect(onFail).not.toHaveBeenCalled();
  });
});
