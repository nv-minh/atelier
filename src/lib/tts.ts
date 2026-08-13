"use client";

// Audio pronunciation utility.
// Strategy: try a real human recording from the Free Dictionary API first
// (cached in-memory); fall back to the browser's Web Speech API speaking the
// actual word with a good en-GB / en-US voice. No more 404'd Oxford URLs.

const recordingCache = new Map<string, string | null>();
let voicesCache: SpeechSynthesisVoice[] | null = null;

function getVoices(): SpeechSynthesisVoice[] {
  if (typeof window === "undefined" || !window.speechSynthesis) return [];
  if (!voicesCache || voicesCache.length === 0) {
    voicesCache = window.speechSynthesis.getVoices();
  }
  return voicesCache ?? [];
}

if (typeof window !== "undefined" && window.speechSynthesis) {
  // voices load async in some browsers
  window.speechSynthesis.onvoiceschanged = () => {
    voicesCache = window.speechSynthesis.getVoices();
  };
}

// Fetch a real mp3 recording for the word from dictionaryapi.dev.
export async function fetchRecording(word: string): Promise<string | null> {
  const w = word.trim().toLowerCase();
  if (!w) return null;
  if (recordingCache.has(w)) return recordingCache.get(w)!;
  let result: string | null = null;
  try {
    const res = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(w)}`,
      { cache: "force-cache" }
    );
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        // collect every phonetic audio across all entries
        const audios: string[] = [];
        for (const entry of data) {
          for (const p of entry.phonetics ?? []) {
            if (p.audio && /\.mp3$/i.test(p.audio)) {
              const url = p.audio.startsWith("//") ? `https:${p.audio}` : p.audio;
              audios.push(url);
            }
          }
        }
        // prefer a us/uk source if we can tell from the filename
        result = audios.find((a) => /-us|_us|us\./i.test(a)) ?? audios[0] ?? null;
      }
    }
  } catch {
    result = null;
  }
  recordingCache.set(w, result);
  return result;
}

function pickVoice(accent: "us" | "uk"): SpeechSynthesisVoice | null {
  const voices = getVoices();
  if (voices.length === 0) return null;
  const prefix = accent === "us" ? "en-US" : "en-GB";
  const preferred =
    accent === "us"
      ? ["Google US English", "Samantha", "Alex", "Microsoft Aria", "Microsoft Zira"]
      : ["Google UK English Female", "Google UK English Male", "Daniel", "Kate", "Serena", "Microsoft Hazel"];
  for (const name of preferred) {
    const v = voices.find((x) => x.name === name);
    if (v) return v;
  }
  const byLang = voices.find((v) => v.lang?.toLowerCase().startsWith(prefix.toLowerCase()));
  if (byLang) return byLang;
  // any english voice
  return voices.find((v) => v.lang?.toLowerCase().startsWith("en")) ?? null;
}

export type SpeakOpts = {
  accent?: "us" | "uk";
  rate?: number;
  onStart?: () => void;
  onEnd?: () => void;
  /** Engine refused, errored, or accepted the utterance and never spoke it. */
  onFail?: () => void;
};

/** How long to wait for `start` before calling the utterance a dud. */
const START_TIMEOUT_MS = 1500;

/**
 * The utterance currently handed to the engine.
 *
 * This reference is load-bearing, not bookkeeping: Chrome and Safari can
 * garbage-collect an utterance that nothing else holds, which truncates speech
 * mid-sentence or drops it before `start` ever fires. A single word is usually
 * over before a GC pass notices; several seconds of quote is not, which is why
 * the long-text caller is the one that visibly breaks.
 */
let active: SpeechSynthesisUtterance | null = null;
let watchdog: ReturnType<typeof setTimeout> | null = null;

function getSynth(): SpeechSynthesis | undefined {
  if (typeof window === "undefined") return undefined;
  return window.speechSynthesis ?? undefined;
}

function clearWatchdog() {
  if (watchdog !== null) {
    clearTimeout(watchdog);
    watchdog = null;
  }
}

/** Stop whatever is being spoken. Deliberate silence, so never a failure. */
export function stopSpeaking() {
  clearWatchdog();
  active = null;
  getSynth()?.cancel();
}

// Speak the text via Web Speech API.
export function speak(text: string, opts?: SpeakOpts) {
  const synth = getSynth();
  const body = text.trim();
  if (!synth || !body) {
    opts?.onFail?.();
    return;
  }

  const accent = opts?.accent ?? "us";

  // Abandon our own previous attempt before starting a new one.
  clearWatchdog();
  active = null;

  // cancel() is processed asynchronously inside Chrome, so issuing it in the
  // same task as speak() can swallow the utterance that follows it. Only
  // interrupt when there is really something to interrupt, and give the cancel
  // a task of its own to land in.
  const busy = synth.speaking || synth.pending;
  if (busy) synth.cancel();

  const fire = () => {
    const u = new SpeechSynthesisUtterance(body);
    const v = pickVoice(accent);
    if (v) u.voice = v;
    u.lang = v?.lang ?? (accent === "us" ? "en-US" : "en-GB");
    u.rate = opts?.rate ?? 0.92;
    u.pitch = 1;

    let started = false;
    u.addEventListener("start", () => {
      started = true;
      clearWatchdog();
      opts?.onStart?.();
    });
    u.addEventListener("end", () => {
      clearWatchdog();
      if (active === u) active = null;
      opts?.onEnd?.();
    });
    u.addEventListener("error", () => {
      clearWatchdog();
      if (active === u) active = null;
      opts?.onFail?.();
    });

    active = u;
    synth.speak(u);

    // An engine that accepts an utterance and then never starts it is a real
    // state, not a hypothetical: a tab Chrome considers hidden queues the
    // utterance and holds `speaking` true indefinitely, with no start, no end
    // and no error. Left alone that dead utterance also blocks every later
    // call. Cancel it so the queue works again, and tell the caller so the UI
    // can stop claiming to play something the reader cannot hear.
    watchdog = setTimeout(() => {
      watchdog = null;
      if (started) return;
      if (active === u) active = null;
      synth.cancel();
      opts?.onFail?.();
    }, START_TIMEOUT_MS);
  };

  if (busy) setTimeout(fire, 0);
  else fire();
}

// High-level: play pronunciation for a word. Returns when started.
export async function playWord(
  word: string,
  opts?: { accent?: "us" | "uk"; rate?: number; onEnd?: () => void; onStart?: () => void }
) {
  // A caller's onEnd is how the UI leaves its "playing" state, so a failed
  // utterance has to run it too — otherwise the button stays lit forever.
  const viaSpeech = () => speak(word, { ...opts, onFail: opts?.onEnd });

  const rec = await fetchRecording(word);
  if (rec) {
    const audio = new Audio(rec);
    audio.playbackRate = opts?.rate ?? 1;
    audio.onplay = () => opts?.onStart?.();
    audio.onended = () => opts?.onEnd?.();
    // recording failed -> TTS fallback
    audio.onerror = viaSpeech;
    try {
      await audio.play();
      return;
    } catch {
      // fall through to TTS
    }
  }
  viaSpeech();
}
