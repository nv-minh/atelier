# Plan B1 — Âm thanh, rung & độ mượt mobile

> **For agentic workers:** Steps use checkbox (`- [ ]`) syntax for tracking. Implement task-by-task; each task ends with a commit.

**Goal:** Give the app a voice (WebAudio effect sounds + haptics, on by default, toggleable in Settings) and make it feel smooth on phones (`prefers-reduced-motion`, tap polish, measured paint cost).

**Architecture:** Three pure, React-free modules (`sound.ts`, `haptics.ts`, `feedback-prefs.ts`) form the feedback layer; components call `playSound("correct")` directly — no provider, no context, no re-renders. Correct/wrong audio wires into exactly ONE place (`PracticeShell.onAnswer`) because all four modes report through it. Reduced-motion is handled globally by `<MotionConfig reducedMotion="user">` plus one CSS block, not by editing 17 files.

**Tech Stack:** Next.js 14.2 App Router, React 18, TypeScript 5.7, vitest 2.1, motion 11.18.2 (already installed — `MotionConfig` comes from its `framer-motion` re-export). **No new dependencies.**

**Spec:** `docs/superpowers/specs/2026-08-13-feel-sound-pwa-design.md` (sections 2 and 3)

## Global Constraints

- **Branch:** `feel-sound-pwa`, applied on top of `2d630fa`. Worktree root: `/Users/abc/Desktop/vocab-master/.claude/worktrees/feel-sound-pwa`. Do NOT `cd` to the main checkout.
- **No new dependencies.** No `npm install`. `MotionConfig` is already available via `motion/react` (motion@11.18.2 re-exports `framer-motion`, which declares `reducedMotion?: ReducedMotionConfig`).
- **No schema changes.** No `db:push`. Preferences live in localStorage, like theme/lang (`src/app/layout.tsx:58`).
- **localStorage keys are prefixed `atelier.`** — exactly: `atelier.sound`, `atelier.haptic`. Do not use bare keys (`theme`/`lang` are bare for legacy reasons; new keys are namespaced).
- **Defaults are ON** for both sound and haptic when localStorage is empty or holds garbage.
- **`AudioContext` must be created lazily**, inside the first `playSound` call (which is always within a user gesture). Never at module top level — iOS/Chrome autoplay policy yields a permanently `suspended` context otherwise.
- **Every module in `src/lib/` here must be React-free** (no imports from react). They are plain TS so vitest can test them in the `node` environment.
- **`navigator.vibrate` must be feature-detected.** iOS Safari has no support; the code no-ops there and must not throw.
- **Comments and copy in English** (code); user-facing strings go through i18n in both `vi` and `en`.
- **TDD for the three lib modules.** Write the failing test first, run it, confirm it fails, then implement. Component wiring has no automated test (spec practice-modes §12) — verify by running the app.
- **Commit style:** lowercase conventional prefix (`feat(sound):`, `feat(ui):`, `test(sound):`, `perf(ui):`). End messages with a blank line then `Co-Authored-By: Claude <noreply@anthropic.com>`.

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `src/lib/feedback-prefs.ts` | Create | Read/write the two localStorage flags. Single source of truth for "is sound/haptic on". React-free. |
| `src/lib/feedback-prefs.test.ts` | Create | Defaults, round-trip, garbage tolerance, SSR safety. |
| `src/lib/haptics.ts` | Create | `vibrate(pattern)` with feature detection + prefs check. React-free. |
| `src/lib/haptics.test.ts` | Create | No-op without support; correct pattern with support; respects the pref. |
| `src/lib/sound.ts` | Create | Lazy `AudioContext`, six synthesized sounds, prefs check. React-free. |
| `src/lib/sound.test.ts` | Create | No context constructed while muted; context constructed once when unmuted. |
| `src/components/providers.tsx` | Modify | Add `MotionConfig reducedMotion="user"` + mount the delegated tap-sound listener. |
| `src/components/tap-sound.tsx` | Create | The delegated `pointerdown` listener component (one listener for the whole app). |
| `src/app/globals.css` | Modify | Reduced-motion block + four mobile tap-polish rules. |
| `src/components/practice/practice-shell.tsx` | Modify | `correct`/`wrong` sound + haptic in `onAnswer`; `complete` sound on session end. |
| `src/components/practice/modes/flashcard.tsx` | Modify | `flip` sound on card flip. |
| `src/components/gamification/achievement-toast.tsx` | Modify | `achievement` sound on push. |
| `src/components/study/rating-buttons.tsx` | Modify | `data-nosound` (own sound comes from `onAnswer`). |
| `src/components/practice/modes/quiz.tsx` | Modify | `data-nosound` on answer options. |
| `src/components/audio-button.tsx` | Modify | `data-nosound` (plays TTS already). |
| `src/app/settings/settings-client.tsx` | Modify | "Sound & haptics" section with two toggles. |
| `src/lib/i18n/dictionaries.ts` | Modify | New `settings.*` keys in `vi` (line ~278) and `en` (line ~690). |

---

## Task 1: The three feedback modules (TDD)

**Files:**
- Create: `src/lib/feedback-prefs.ts`, `src/lib/feedback-prefs.test.ts`
- Create: `src/lib/haptics.ts`, `src/lib/haptics.test.ts`
- Create: `src/lib/sound.ts`, `src/lib/sound.test.ts`

**Interfaces produced** (later tasks depend on these exact names):
```ts
// feedback-prefs.ts
export type FeedbackPref = "sound" | "haptic";
export function isEnabled(pref: FeedbackPref): boolean;
export function setEnabled(pref: FeedbackPref, on: boolean): void;

// haptics.ts
export function vibrate(pattern: number | number[]): void;

// sound.ts
export type SoundName = "tap" | "correct" | "wrong" | "flip" | "complete" | "achievement";
export function playSound(name: SoundName): void;
```

- [ ] **Step 1: Write `feedback-prefs.test.ts` (failing first)**

```ts
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
```

- [ ] **Step 2: Run it, confirm FAIL**

Run: `npx vitest run src/lib/feedback-prefs.test.ts`
Expected: FAIL — "Cannot find module './feedback-prefs'".

- [ ] **Step 3: Write `feedback-prefs.ts`**

```ts
// Device-local feedback preferences (sound effects, haptics).
//
// These live in localStorage rather than the Settings model on purpose: they
// are per-DEVICE preferences, like theme and lang. A user who mutes the app on
// their phone at work should still get sound on their laptop at home.
//
// React-free by design so the whole feedback layer stays testable in vitest's
// node environment and callable from anywhere without a provider.

export type FeedbackPref = "sound" | "haptic";

const KEY: Record<FeedbackPref, string> = {
  sound: "atelier.sound",
  haptic: "atelier.haptic",
};

// Both default to ON: a feature nobody can hear is a feature nobody knows
// exists. The Settings toggle is how you turn it off.
const DEFAULT = true;

export function isEnabled(pref: FeedbackPref): boolean {
  // Guarded for SSR (no localStorage on the server) and for browsers that
  // throw on storage access in private mode.
  try {
    const raw = localStorage.getItem(KEY[pref]);
    if (raw === "1") return true;
    if (raw === "0") return false;
    return DEFAULT; // unset OR garbage
  } catch {
    return DEFAULT;
  }
}

export function setEnabled(pref: FeedbackPref, on: boolean): void {
  try {
    localStorage.setItem(KEY[pref], on ? "1" : "0");
  } catch {
    // Storage full or blocked — the preference just won't persist. Not worth
    // surfacing: the in-page behaviour still follows the toggle for this visit.
  }
}
```

- [ ] **Step 4: Run it, confirm PASS**

Run: `npx vitest run src/lib/feedback-prefs.test.ts`
Expected: PASS — 5 tests.

- [ ] **Step 5: Write `haptics.test.ts` (failing first)**

```ts
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
```

- [ ] **Step 6: Run it, confirm FAIL, then write `haptics.ts`**

Run: `npx vitest run src/lib/haptics.test.ts` → FAIL (module not found).

```ts
import { isEnabled } from "./feedback-prefs";

// Haptic feedback, where the platform offers it.
//
// HARD LIMIT: iOS Safari does not implement navigator.vibrate, and there is no
// web-app workaround. On iPhone this is a permanent no-op. Feature-detect
// rather than assume (spec practice-modes §10).
export function vibrate(pattern: number | number[]): void {
  if (!isEnabled("haptic")) return;
  try {
    const nav = typeof navigator === "undefined" ? undefined : navigator;
    if (!nav || typeof nav.vibrate !== "function") return;
    nav.vibrate(pattern);
  } catch {
    // Some browsers throw if called outside a user gesture. Never let feedback
    // break the interaction that triggered it.
  }
}
```

Run again: PASS — 3 tests.

- [ ] **Step 7: Write `sound.test.ts` (failing first)**

```ts
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
```

Note: every case imports `./sound` **dynamically, after** stubbing globals, so the module's lazy `AudioContext` state starts fresh each time (`vi.resetModules()` in `afterEach` clears the module registry). Do not add a static top-level import of `sound.ts` to this file — it would evaluate the module before the stubs exist.

- [ ] **Step 8: Run it, confirm FAIL, then write `sound.ts`**

Run: `npx vitest run src/lib/sound.test.ts` → FAIL (module not found).

```ts
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
```

- [ ] **Step 9: Run the full suite + type-check**

Run: `npx vitest run && npx tsc --noEmit`
Expected: all pass (29 existing + 11 new = 40 tests), tsc clean.

- [ ] **Step 10: Commit**

```bash
git add src/lib/feedback-prefs.ts src/lib/feedback-prefs.test.ts src/lib/haptics.ts src/lib/haptics.test.ts src/lib/sound.ts src/lib/sound.test.ts
git commit -m "$(cat <<'EOF'
feat(sound): synthesized feedback layer with device-local preferences

Three React-free modules: feedback-prefs (two localStorage flags, both
defaulting to on), haptics (feature-detected, a permanent no-op on iOS
Safari), and sound (six oscillator-synthesized tones, no audio files).

The AudioContext is built lazily inside the first playSound call. Built at
import time it would be born suspended under iOS and Chrome autoplay policy
and every later sound would be silent — a test locks the lazy behaviour, and
another locks that a muted app never constructs a context at all.

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Wire feedback into the app

**Files:**
- Create: `src/components/tap-sound.tsx`
- Modify: `src/components/providers.tsx`, `src/components/practice/practice-shell.tsx`, `src/components/practice/modes/flashcard.tsx`, `src/components/gamification/achievement-toast.tsx`, `src/components/study/rating-buttons.tsx`, `src/components/practice/modes/quiz.tsx`, `src/components/audio-button.tsx`

**Interfaces consumed:** `playSound(name)` and `vibrate(pattern)` from Task 1.

- [ ] **Step 1: Create the delegated tap-sound listener**

Create `src/components/tap-sound.tsx`:

```tsx
"use client";

import { useEffect } from "react";
import { playSound } from "@/lib/sound";

// ONE listener for the whole app instead of an onClick on every control.
//
// Anything that opts out carries data-nosound: controls that already produce
// their own sound (rating buttons, quiz options — their audio comes from the
// shell's onAnswer) or that start other audio (pronunciation buttons), where a
// tap tone would just double up.
//
// pointerdown rather than click: it fires at the moment of touch, so the sound
// lands with the finger rather than after it lifts. passive + capture so it can
// never delay or block scrolling.
export function TapSound() {
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const el = e.target;
      if (!(el instanceof Element)) return;
      const control = el.closest('button, a, [role="button"]');
      if (!control) return;
      if (control.closest("[data-nosound]")) return;
      if (control.getAttribute("aria-disabled") === "true") return;
      if (control instanceof HTMLButtonElement && control.disabled) return;
      playSound("tap");
    };
    window.addEventListener("pointerdown", onDown, { passive: true, capture: true });
    return () => window.removeEventListener("pointerdown", onDown, { capture: true });
  }, []);

  return null;
}
```

- [ ] **Step 2: Mount MotionConfig + TapSound in `providers.tsx`**

Replace the whole file:

```tsx
"use client";

import { SessionProvider } from "next-auth/react";
import { MotionConfig } from "motion/react";
import { TapSound } from "./tap-sound";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      {/* reducedMotion="user" makes EVERY motion/react component in the app
          respect the OS "reduce motion" setting through Motion's own context —
          17 files covered by one line, and components written later are covered
          automatically. See the spec's amendment to practice-modes §10. */}
      <MotionConfig reducedMotion="user">
        <TapSound />
        {children}
      </MotionConfig>
    </SessionProvider>
  );
}
```

- [ ] **Step 3: Add correct/wrong feedback to `practice-shell.tsx`**

Add imports at the top (after the existing imports):

```ts
import { playSound } from "@/lib/sound";
import { vibrate } from "@/lib/haptics";
```

In `onAnswer`, immediately after the existing `setReveal(...)` line, add:

```ts
      // One wiring point covers all four modes: every mode reports its result
      // through onAnswer (the shell↔mode contract, practice-modes spec §4).
      if (r.correct) {
        playSound("correct");
        vibrate(10);
      } else {
        playSound("wrong");
        vibrate([20, 40, 20]);
      }
```

In the session-completion effect, immediately after `setDone(true);`, add:

```ts
    playSound("complete");
```

- [ ] **Step 4: Add the flip sound to `flashcard.tsx`**

Add the import:

```ts
import { playSound } from "@/lib/sound";
```

There are two places that flip the card — the keyboard handler and the `onFlip` prop. Change the keyboard handler's flip line from:

```ts
        setFlipped((f) => !f);
```

to:

```ts
        setFlipped((f) => {
          playSound("flip");
          return !f;
        });
```

and the `onFlip` prop from:

```tsx
        onFlip={() => setFlipped((f) => !f)}
```

to:

```tsx
        onFlip={() =>
          setFlipped((f) => {
            playSound("flip");
            return !f;
          })
        }
```

- [ ] **Step 5: Add the achievement sound**

In `src/components/gamification/achievement-toast.tsx`, add the import:

```ts
import { playSound } from "@/lib/sound";
```

Inside `push`, the toast is only actually shown when `added.length > 0`. Play the sound there — inside the `setItems` updater, right before the `return`:

```ts
      if (added.length > 0) playSound("achievement");
      return [...cur, ...added];
```

- [ ] **Step 6: Add `data-nosound` opt-outs**

Three edits, each adding one attribute so the delegated listener skips these controls:

1. `src/components/study/rating-buttons.tsx` — on the wrapping `<div className="grid grid-cols-4 ...">`, add `data-nosound`. (One attribute covers all four buttons via `closest`.)
2. `src/components/practice/modes/quiz.tsx` — on the container that wraps the answer option buttons, add `data-nosound`.
3. `src/components/audio-button.tsx` — on the button element itself, add `data-nosound`.

- [ ] **Step 7: Type-check and run the app**

Run: `npx tsc --noEmit` — expected clean.
Run: `npm run dev`, then check:
1. `/study/flashcard` — flipping plays the paper sound; rating plays correct/wrong (NOT also a tap tone).
2. `/study/quiz` — answering plays correct/wrong once, not twice.
3. Nav links and theme/lang toggles play the soft tap tone.
4. Pronunciation buttons play speech only, no tap tone.
5. Finishing a session plays the ascending arpeggio.

- [ ] **Step 8: Commit**

```bash
git add src/components/tap-sound.tsx src/components/providers.tsx src/components/practice/practice-shell.tsx src/components/practice/modes/flashcard.tsx src/components/gamification/achievement-toast.tsx src/components/study/rating-buttons.tsx src/components/practice/modes/quiz.tsx src/components/audio-button.tsx
git commit -m "$(cat <<'EOF'
feat(sound): wire feedback into practice, toasts and general taps

Correct/wrong audio and haptics attach at a single point — the shell's
onAnswer — because all four modes report results through it. General tap
tones come from one delegated pointerdown listener rather than an onClick
per control; anything with its own audio opts out with data-nosound.

MotionConfig reducedMotion="user" wraps the tree, so all 17 motion/react
call sites honour the OS reduce-motion setting without touching any of them.

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Settings toggles + i18n

**Files:**
- Modify: `src/app/settings/settings-client.tsx`, `src/lib/i18n/dictionaries.ts`

**Interfaces consumed:** `isEnabled`/`setEnabled` from Task 1, `playSound` from Task 1.

- [ ] **Step 1: Add i18n keys**

In `src/lib/i18n/dictionaries.ts`, inside the **`vi`** `settings: {` block (starts ~line 278), add:

```ts
      feedback: "Âm thanh & rung",
      feedbackDesc: "Phản hồi khi bạn trả lời và khi chạm vào nút.",
      soundToggle: "Âm thanh",
      soundToggleDesc: "Tiếng nhẹ khi đúng, sai, lật thẻ và hoàn thành phiên.",
      hapticToggle: "Rung",
      hapticToggleDesc: "Rung nhẹ khi trả lời. Không khả dụng trên iPhone.",
```

Inside the **`en`** `settings: {` block (starts ~line 690), add:

```ts
      feedback: "Sound & haptics",
      feedbackDesc: "Feedback when you answer and when you tap.",
      soundToggle: "Sound",
      soundToggleDesc: "Soft tones for correct, wrong, card flips and finishing a session.",
      hapticToggle: "Haptics",
      hapticToggleDesc: "A short buzz when you answer. Not available on iPhone.",
```

- [ ] **Step 2: Add the Toggle component to `settings-client.tsx`**

At the bottom of the file, after the `Slider` function, add:

```tsx
function Toggle({
  label,
  desc,
  checked,
  onChange,
}: {
  label: string;
  desc: string;
  checked: boolean;
  onChange: (on: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 mb-5 last:mb-0">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-soft mt-0.5">{desc}</p>
      </div>
      <button
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={cn(
          "shrink-0 relative h-6 w-11 rounded-full transition-colors",
          checked ? "bg-ember" : "bg-ink/15"
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-5 w-5 rounded-full bg-surface shadow transition-transform",
            checked ? "translate-x-[1.375rem]" : "translate-x-0.5"
          )}
        />
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Add the section and its state**

Add imports at the top of `settings-client.tsx`:

```ts
import { useEffect } from "react";
import { isEnabled, setEnabled } from "@/lib/feedback-prefs";
import { playSound } from "@/lib/sound";
```

(`useState` is already imported — extend that import to include `useEffect`.)

Inside `SettingsClient`, after the existing `useState` declarations, add:

```tsx
  // Read on mount, not during render: localStorage does not exist on the server,
  // and reading it during render would desync the first client paint from the
  // server-rendered HTML (hydration mismatch). Start from the module default.
  const [soundOn, setSoundOn] = useState(true);
  const [hapticOn, setHapticOn] = useState(true);
  useEffect(() => {
    setSoundOn(isEnabled("sound"));
    setHapticOn(isEnabled("haptic"));
  }, []);
```

Then insert this section between the Language section and the SRS section:

```tsx
      {/* Sound & haptics */}
      <section className="card-atelier p-6 sm:p-7 mb-4">
        <h2 className="display text-xl mb-1">{t("settings.feedback")}</h2>
        <p className="text-xs text-soft mb-5">{t("settings.feedbackDesc")}</p>
        <Toggle
          label={t("settings.soundToggle")}
          desc={t("settings.soundToggleDesc")}
          checked={soundOn}
          onChange={(on) => {
            setEnabled("sound", on);
            setSoundOn(on);
            // Preview the change immediately — turning sound ON should be
            // audible proof it worked.
            if (on) playSound("correct");
          }}
        />
        <Toggle
          label={t("settings.hapticToggle")}
          desc={t("settings.hapticToggleDesc")}
          checked={hapticOn}
          onChange={(on) => {
            setEnabled("haptic", on);
            setHapticOn(on);
          }}
        />
      </section>
```

Note: these toggles write to localStorage immediately and are NOT part of the "Save changes" button (which posts to `/api/settings`). That is correct — they are device-local, not account settings.

- [ ] **Step 4: Type-check and verify**

Run: `npx tsc --noEmit` — clean.
Run: `npm run dev`, open `/settings`:
1. Both toggles read ON by default.
2. Turning sound off, then answering a card in a session → silent.
3. Turning sound back on → plays the correct tone immediately as preview.
4. Reload the page → toggle states persist.

- [ ] **Step 5: Commit**

```bash
git add src/app/settings/settings-client.tsx src/lib/i18n/dictionaries.ts
git commit -m "$(cat <<'EOF'
feat(sound): sound and haptic toggles in Settings

Two independent switches rather than one: wanting a buzz without tones is a
real preference, and haptics do nothing on iPhone, so a combined flag would
mislead iOS users about what they are turning off.

Both write straight to localStorage rather than joining the Save button's
POST — they are device-local preferences like theme, not account settings.
Preferences are read in an effect, not during render, to keep the first
client paint identical to the server HTML.

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Mobile tap polish + reduced-motion CSS

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1: Add the reduced-motion block**

At the end of `globals.css`, after the `@layer utilities` block, add:

```css
/* Respect the OS "reduce motion" setting for plain CSS transitions and
   animations. Motion/react components are handled separately by
   <MotionConfig reducedMotion="user"> in providers.tsx — this block covers
   everything Motion does not own (Tailwind transition-* utilities, the
   nprogress bar, CSS keyframes). Outside any @layer so it wins on specificity
   ties regardless of layer order. */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

- [ ] **Step 2: Add the mobile tap-polish rules**

In the `@layer base` block, extend the existing `html` rule:

```css
  html {
    -webkit-font-smoothing: antialiased;
    text-rendering: optimizeLegibility;
    /* Kill the grey/blue flash box Android and iOS paint over every tapped
       link and button. The app draws its own press states (Motion whileTap,
       active: utilities), so the native overlay is pure noise. */
    -webkit-tap-highlight-color: transparent;
  }
```

Still inside `@layer base`, add a new rule after the `html` rule:

```css
  /* Opt controls out of double-tap-to-zoom, which is what makes taps feel
     ~300ms late on mobile. Restricted to controls so pinch-zoom on content
     (word images, definitions) keeps working. */
  button,
  a,
  [role="button"],
  input,
  select,
  textarea {
    touch-action: manipulation;
  }
```

Update the `body` rule's height:

```css
  body {
    background-color: rgb(var(--paper));
    color: rgb(var(--ink));
    font-feature-settings: "ss01", "cv01", "cv11";
    /* 100vh on mobile Safari counts the address bar, so the page jumps as the
       bar hides and shows. dvh tracks the real viewport. The vh line stays as
       a fallback for browsers without dvh. */
    min-height: 100vh;
    min-height: 100dvh;
    position: relative;
  }
```

- [ ] **Step 3: Add safe-area padding to the header**

In `src/components/nav.tsx`, the top `<header>` currently has:

```tsx
          "sticky top-0 z-40 backdrop-blur-xl bg-paper/75 border-b border-line",
```

Change it to add safe-area padding for notched devices in landscape/standalone:

```tsx
          "sticky top-0 z-40 backdrop-blur-xl bg-paper/75 border-b border-line pt-[env(safe-area-inset-top)]",
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit` — clean (CSS changes don't affect it, but nav.tsx did change).
Run: `npm run dev` and check in a mobile viewport (or a real phone on the LAN):
1. Tapping nav items shows no grey flash box.
2. Enable "Reduce motion" in the OS → card transitions and toasts appear instantly, no sliding.
3. Scroll a long page (`/browse`) — no layout jump as the address bar hides.

- [ ] **Step 5: Commit**

```bash
git add src/app/globals.css src/components/nav.tsx
git commit -m "$(cat <<'EOF'
feat(ui): reduced-motion support and mobile tap polish

A prefers-reduced-motion block covers every CSS transition and keyframe;
MotionConfig in providers.tsx already covers the motion/react side, so the
two together mean the setting is honoured app-wide without per-component
branching.

Tap polish: drop the native tap-highlight overlay (the app draws its own
press states), set touch-action: manipulation on controls only so taps stop
waiting on double-tap-zoom while pinch-zoom still works on content, switch
body to dvh so the page stops jumping when Safari's address bar moves, and
pad the header for notched devices.

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Measure the grain overlay, change only if the numbers say so

**Files:**
- Possibly modify: `src/app/globals.css` (only if measurement justifies it)
- Modify: `docs/superpowers/plans/2026-08-13-feel-b1-sound-motion.md` (record the numbers in this task's section)

The grain layer (`globals.css:48-57`) is `position: fixed`, covers the viewport, and uses `mix-blend-mode: multiply`. A full-viewport blend layer forces the browser to recomposite a large area every frame while scrolling. **This is a suspect, not a verdict.** Grain is Atelier's signature texture — it does not get traded away for an imagined win.

- [ ] **Step 1: Measure**

Start the app (`npm run dev`), open `/browse` (the longest page), and profile scrolling with and without the grain layer. Use the browser automation tools (`mcp__claude-in-chrome__*`) or Chrome DevTools' Performance panel. Capture, for both conditions:
- average FPS during a sustained scroll
- total paint/composite time over the same scroll

To toggle the layer for the "without" run, set `--grain-opacity: 0` on `:root` in DevTools (this keeps layout identical and isolates the blend/paint cost).

- [ ] **Step 2: Record the numbers in this file**

**Measurement could not be completed — the automation tab never became visible to Chrome's compositor, which suppresses `requestAnimationFrame` entirely.** This is a real, reproducible finding, not a skipped step; the evidence is below.

Setup: dev server started with `AUTH_BYPASS=1` (temp `.env.local`, deleted afterward — not committed) so `/browse` would render without a real session. Opened `/browse` (6,394 rows, `scrollHeight` 5819px) via `mcp__claude-in-chrome__*`, injected the rAF-driven scroll/FPS meter described in Step 1.

What happened:
- The first scripted run (`window.scrollBy` + `requestAnimationFrame`, 600-frame cap) never returned — the tool's own CDP `Runtime.evaluate` call timed out at 45s with zero frames counted.
- `document.visibilityState` read `"hidden"` (`document.hidden === true`) for the entire session, even immediately after navigation.
- Tried to clear it: a real `left_click` on the page (this did flip `document.hasFocus()` to `true`), `resize_window` to 1280×900, `resize_window` to the full display size 1680×1050 (silently had no effect — `window.outerWidth/outerHeight` stayed 1445×840), and an `F11` key press (no fullscreen transition). None changed `visibilityState`.
- Installed a bare rAF counter (`requestAnimationFrame` recursively incrementing a counter, no scrolling involved) and let it run **~130 seconds** of real wall-clock time (two separate waits, 40s then 90s, both confirmed via a background monitor, not guessed). Result: **0 callbacks**, both times. Ordinary background-tab timer throttling caps at roughly 1 Hz, not zero — a persistent zero over two full minutes means rAF is not merely throttled here, it is not scheduled at all, consistent with the tab being occluded at the OS/compositor level (Chrome only produces a compositor frame — and only then fires rAF — for a frame that is actually going to be displayed).
- The page was otherwise fully functional throughout: `document.title`, DOM queries, and `window.scrollBy`/`window.scrollTo` (`scrollY` updated correctly) all worked normally, and `mcp__claude-in-chrome__computer`'s `screenshot` action rendered the real page correctly (grain texture visible in the capture) — screenshot capture forces a one-off render through a separate CDP path that bypasses the occlusion optimization, which is exactly why the page *looks* fine in a screenshot while `requestAnimationFrame` still never fires for it.
- No CDP performance-tracing tool is exposed by the available tools either (checked), so there was no fallback instrumentation path to fall back on within this environment.
- Net effect: the grain-on and grain-off conditions were never actually differentiated by data, because no run — under either condition — produced a single completed frame to measure. This is a measurement-infrastructure ceiling in this sandboxed browser-automation session, not evidence about the grain layer's cost one way or the other.

```
| Condition | Avg FPS | Dropped frames | Elapsed | Result |
|---|---|---|---|---|
| Grain on (default)              | not measurable | not measurable | 45s timeout, 0 frames | rAF never fired (tab occluded) |
| Grain off (`--grain-opacity: 0`) | not measurable | not measurable | not reached           | blocked before this condition was ever reached |
| rAF-only probe (no scroll, either condition) | n/a | n/a | ~130s observed | 0 callbacks both times |
```

- [ ] **Step 3: Decide from the numbers**

There are no numbers to weigh a real-vs-negligible difference against — this is the plan's explicitly anticipated "too noisy/inconclusive to draw a conclusion" outcome, just total rather than partial (zero usable samples rather than noisy ones). Per the plan's own instruction for that case: **change nothing.** The grain layer is Atelier's signature texture and a failed measurement is not grounds to touch it. If someone re-runs this in an environment where the automated tab is actually visible to the compositor (a real interactive browser window, not an automation session kept off-screen), the rAF-based method in Step 1 should work as designed and can produce the real table this step originally asked for.

- [ ] **Step 4: Commit**

If no change was warranted:

```bash
git add docs/superpowers/plans/2026-08-13-feel-b1-sound-motion.md
git commit -m "$(cat <<'EOF'
perf(ui): attempt to measure the grain overlay's scroll cost, leave it in place

Tried to profile sustained scrolling on /browse with and without the layer
using the rAF-driven scroll/FPS meter, per plan. The automation tab never
became visible to the compositor (document.visibilityState stayed "hidden"
through clicks, resizes, and a fullscreen attempt), which suppresses
requestAnimationFrame entirely — confirmed with a bare rAF counter that saw
zero callbacks over ~130s of wall-clock time. No comparative numbers were
obtainable in this environment; details are in the plan's Task 5 section.

A failed measurement is not grounds to touch Atelier's signature texture, so
nothing changed.

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

If a change was warranted, commit the CSS change together with the recorded numbers and describe the measured before/after in the message.

---

## Verification checklist for the whole plan

Before considering B1 done:

- [ ] `npx vitest run` — all tests pass (29 pre-existing + 11 new)
- [ ] `npx tsc --noEmit` — clean
- [ ] All four practice modes play correct/wrong exactly once per answer
- [ ] Muting in Settings actually silences everything, and persists across reload
- [ ] OS reduce-motion setting visibly stops animations
- [ ] No new dependency in `package.json`
- [ ] Grain measurement recorded, whatever the outcome
