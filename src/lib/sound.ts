import { isEnabled } from "./feedback-prefs";

// Synthesized UI sounds — no audio files, no network, no decode latency.
//
// Everything is generated with oscillators, so the whole palette costs a couple
// of KB of code and starts instantly. Tones are short, quiet, and soft-edged to
// match Atelier's paper feel and to stay out of the way of the TTS pronunciation
// audio the app already plays (src/lib/tts.ts).

export type SoundName = "tap" | "correct" | "wrong" | "flip" | "complete" | "achievement";

// Module-level, created LAZILY. An AudioContext constructed at import time (i.e.
// on page load, outside a user gesture) is born "suspended" under iOS Safari and
// Chrome's autoplay policy, and every later sound is silent. Building it inside
// the first playSound call guarantees we are inside a gesture.
let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (ctx) return ctx;
  try {
    const Ctor =
      typeof window !== "undefined"
        ? window.AudioContext ?? (window as any).webkitAudioContext
        : undefined;
    if (!Ctor) return null;
    ctx = new Ctor();
    return ctx;
  } catch {
    return null;
  }
}

// One shaped tone. `type` picks the timbre, the gain envelope gives it a soft
// attack and an exponential tail so nothing clicks.
function tone(
  c: AudioContext,
  opts: { freq: number; from?: number; dur: number; peak: number; at: number; type?: OscillatorType }
) {
  const osc = c.createOscillator();
  const gain = c.createGain();
  const start = c.currentTime + opts.at;
  const end = start + opts.dur;

  osc.type = opts.type ?? "sine";
  osc.frequency.setValueAtTime(opts.from ?? opts.freq, start);
  if (opts.from && opts.from !== opts.freq) {
    osc.frequency.linearRampToValueAtTime(opts.freq, end);
  }

  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.linearRampToValueAtTime(opts.peak, start + Math.min(0.015, opts.dur / 3));
  gain.gain.exponentialRampToValueAtTime(0.0001, end);

  osc.connect(gain);
  gain.connect(c.destination);
  osc.start(start);
  osc.stop(end + 0.02);
}

export function playSound(name: SoundName): void {
  // Check the preference BEFORE touching the audio machinery: a muted app must
  // not even construct an AudioContext (locked by a test).
  if (!isEnabled("sound")) return;

  const c = getCtx();
  if (!c) return;

  try {
    // A context can fall back to "suspended" when the tab is backgrounded.
    if (c.state === "suspended") void c.resume();

    switch (name) {
      case "tap":
        tone(c, { freq: 880, dur: 0.04, peak: 0.05, at: 0 });
        break;
      case "correct":
        tone(c, { freq: 660, dur: 0.06, peak: 0.09, at: 0, type: "triangle" });
        tone(c, { freq: 880, dur: 0.09, peak: 0.09, at: 0.06, type: "triangle" });
        break;
      case "wrong":
        tone(c, { freq: 220, from: 260, dur: 0.15, peak: 0.09, at: 0 });
        break;
      case "flip":
        tone(c, { freq: 520, from: 720, dur: 0.06, peak: 0.04, at: 0, type: "triangle" });
        break;
      case "complete":
        tone(c, { freq: 523, dur: 0.1, peak: 0.08, at: 0, type: "triangle" });
        tone(c, { freq: 659, dur: 0.1, peak: 0.08, at: 0.1, type: "triangle" });
        tone(c, { freq: 784, dur: 0.16, peak: 0.09, at: 0.2, type: "triangle" });
        break;
      case "achievement":
        tone(c, { freq: 523, dur: 0.1, peak: 0.07, at: 0, type: "triangle" });
        tone(c, { freq: 659, dur: 0.1, peak: 0.07, at: 0.09, type: "triangle" });
        tone(c, { freq: 784, dur: 0.1, peak: 0.08, at: 0.18, type: "triangle" });
        tone(c, { freq: 1046, dur: 0.2, peak: 0.08, at: 0.27, type: "triangle" });
        break;
    }
  } catch {
    // Audio must never break the interaction that triggered it.
  }
}
