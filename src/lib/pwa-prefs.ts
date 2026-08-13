// Every "should we invite this person to install?" rule lives here.
//
// React-free and time-injected (callers pass nowMs) so the whole gate is
// testable without a DOM or fake timers. The component in
// components/pwa-install.tsx owns the browser plumbing; this module owns the
// policy.

const KEY_SESSIONS = "atelier.sessionsDone";
const KEY_DISMISSED = "atelier.installDismissedAt";

// Ask only after the app has proved useful at least once. An install prompt on
// first paint is the kind people dismiss reflexively.
export const MIN_SESSIONS = 1;

// "Not now" means not now — for a month.
export const DISMISS_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage blocked or full. The invite just won't be gated correctly for
    // this visit — never worth breaking the page over.
  }
}

export function sessionsDone(): number {
  const n = Number(read(KEY_SESSIONS));
  // Number("banana") is NaN and Number(null) is 0 — both mean "none yet".
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

export function recordSessionDone(): void {
  write(KEY_SESSIONS, String(sessionsDone() + 1));
}

export function recordDismissed(nowMs: number): void {
  write(KEY_DISMISSED, String(nowMs));
}

export function isDismissalActive(nowMs: number): boolean {
  const at = Number(read(KEY_DISMISSED));
  if (!Number.isFinite(at) || at <= 0) return false;
  return nowMs - at < DISMISS_DAYS * DAY_MS;
}

// Already installed? Two different signals, because the standards-based one
// does not cover iOS: Safari exposes its own non-standard navigator.standalone.
export function isStandalone(): boolean {
  try {
    if (typeof window === "undefined") return false;
    if (window.matchMedia?.("(display-mode: standalone)")?.matches) return true;
    if ((navigator as unknown as { standalone?: boolean })?.standalone === true) return true;
    return false;
  } catch {
    return false;
  }
}

// iOS Safari never fires beforeinstallprompt, so it needs the instruction
// branch instead of a button. iPadOS 13+ reports itself as a Mac, hence the
// touch-points check.
export function isIos(): boolean {
  try {
    if (typeof navigator === "undefined") return false;
    const ua = navigator.userAgent || "";
    const iPhoneOrIPad = /iPad|iPhone|iPod/.test(ua);
    const iPadOs = /Macintosh/.test(ua) && (navigator.maxTouchPoints ?? 0) > 1;
    return iPhoneOrIPad || iPadOs;
  } catch {
    return false;
  }
}

export function shouldOffer(nowMs: number): boolean {
  if (isStandalone()) return false;
  if (sessionsDone() < MIN_SESSIONS) return false;
  if (isDismissalActive(nowMs)) return false;
  return true;
}
