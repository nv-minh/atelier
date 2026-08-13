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
