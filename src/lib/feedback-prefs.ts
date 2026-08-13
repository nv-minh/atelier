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
