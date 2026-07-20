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

// Speak the word via Web Speech API.
export function speak(word: string, opts?: { accent?: "us" | "uk"; rate?: number }) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  const accent = opts?.accent ?? "us";
  const synth = window.speechSynthesis;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(word.trim());
  const v = pickVoice(accent);
  if (v) u.voice = v;
  u.lang = v?.lang ?? (accent === "us" ? "en-US" : "en-GB");
  u.rate = opts?.rate ?? 0.92;
  u.pitch = 1;
  synth.speak(u);
}

// High-level: play pronunciation for a word. Returns when started.
export async function playWord(
  word: string,
  opts?: { accent?: "us" | "uk"; rate?: number; onEnd?: () => void; onStart?: () => void }
) {
  const accent = opts?.accent ?? "us";
  const rec = await fetchRecording(word);
  if (rec) {
    const audio = new Audio(rec);
    audio.playbackRate = opts?.rate ?? 1;
    audio.onplay = () => opts?.onStart?.();
    audio.onended = () => opts?.onEnd?.();
    audio.onerror = () => {
      // recording failed -> TTS fallback
      speak(word, opts);
      opts?.onStart?.();
      window.setTimeout(() => opts?.onEnd?.(), 600);
    };
    try {
      await audio.play();
      return;
    } catch {
      // fall through to TTS
    }
  }
  speak(word, opts);
  opts?.onStart?.();
  // approximate end so UI can reset
  const dur = Math.max(600, word.length * 110);
  window.setTimeout(() => opts?.onEnd?.(), dur);
}
