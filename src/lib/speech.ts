"use client";

// Client-side Web Speech API helpers for pronunciation practice. No server-only
// imports — this runs in the browser. Firefox has no SpeechRecognition, so every
// entry point feature-detects and degrades gracefully.

import { normalizeWord, levenshtein } from "./utils";

// ── Minimal ambient types ────────────────────────────────────────────
// TypeScript's DOM lib doesn't ship SpeechRecognition types (it's not a finalized
// standard), so declare just the surface we use. Intentionally not @types/* — we
// only need the constructor, the handful of props we set, and the event shapes.
export interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}
export interface SpeechRecognitionResult {
  readonly length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
  isFinal: boolean;
}
export interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}
export interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}
export interface SpeechRecognitionErrorEvent extends Event {
  // "no-speech" | "aborted" | "audio-capture" | "network" | "not-allowed"
  // | "service-not-allowed" | "bad-grammar" | "language-not-supported"
  readonly error: string;
  readonly message: string;
}
export interface SpeechRecognition extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => void) | null;
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => void) | null;
  onend: ((this: SpeechRecognition, ev: Event) => void) | null;
  onstart: ((this: SpeechRecognition, ev: Event) => void) | null;
}

export type SpeechRecognitionCtor = new () => SpeechRecognition;

// Feature-detect the SpeechRecognition constructor. Returns null on the server
// (no window) and in browsers that don't implement it (Firefox). Chrome/Edge use
// the webkit-prefixed name; Safari exposes both.
export function getSpeechRecognition(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

// Grade a spoken attempt against the target word. Correct if ANY recognition
// alternative normalizes exactly equal to the target, OR — for targets of 4+
// characters — is within Levenshtein distance 1 (a single-character slip, mirroring
// gradeTyping's typo tolerance). `best` is the closest alternative by edit distance
// to the target, for showing the user what was actually heard.
//
// Known limitation: recognition transcribes spoken numbers as digits ("one" → "1"),
// so number/spelled-out targets can grade as misses. Acceptable for a vocabulary
// drill (the Oxford set is overwhelmingly non-numeric); not worth a digit↔word map.
export function gradeSpeech(
  alternatives: string[],
  target: string
): { correct: boolean; best: string } {
  const tgt = normalizeWord(target);
  const norm = alternatives.map((a) => normalizeWord(a)).filter((a) => a.length > 0);

  if (norm.length === 0) {
    return { correct: false, best: alternatives[0] ?? "" };
  }

  let correct = false;
  for (const a of norm) {
    if (a === tgt || (tgt.length >= 4 && levenshtein(a, tgt) <= 1)) {
      correct = true;
      break;
    }
  }

  // Pick the alternative (from the raw list, so casing/spacing shows as heard)
  // whose normalized form is closest to the target for display.
  let bestIdx = 0;
  let bestDist = Infinity;
  for (let i = 0; i < norm.length; i++) {
    const d = levenshtein(norm[i], tgt);
    if (d < bestDist) {
      bestDist = d;
      bestIdx = i;
    }
  }
  // norm was filtered, so map bestIdx back through the original list by finding the
  // i-th non-empty normalized entry. Simplest: rebuild a parallel raw list.
  const raw = alternatives.filter((a) => normalizeWord(a).length > 0);
  return { correct, best: raw[bestIdx] ?? alternatives[0] ?? "" };
}
