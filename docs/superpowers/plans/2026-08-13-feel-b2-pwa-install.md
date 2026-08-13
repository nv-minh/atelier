# Plan B2 — Lời mời cài PWA

> **For agentic workers:** Steps use checkbox (`- [ ]`) syntax for tracking. Implement task-by-task; each task ends with a commit.

**Goal:** Invite people to install the app — but only after they've actually used it, only once, and never when it's already installed.

**Architecture:** One gate module (`src/lib/pwa-prefs.ts`, React-free, testable) holds every "should we ask?" rule; one client component (`src/components/pwa-install.tsx`) renders the banner and owns the `beforeinstallprompt` plumbing. The session counter is incremented at exactly one place — the `endedRef` guard in `PracticeShell` that already fires once per completed session. iOS gets a separate instruction branch because Safari never fires `beforeinstallprompt`.

**Tech Stack:** Next.js 14.2 App Router, React 18, TypeScript 5.7, vitest 2.1, lucide-react (already installed, for icons). **No new dependencies.**

**Spec:** `docs/superpowers/specs/2026-08-13-feel-sound-pwa-design.md` (section 4)

## Global Constraints

- **Branch:** `feel-sound-pwa`, applied on top of B1's last commit. Worktree root: `/Users/abc/Desktop/vocab-master/.claude/worktrees/feel-sound-pwa`. Do NOT `cd` to the main checkout.
- **No new dependencies.** No `npm install`. No schema changes, no `db:push`.
- **localStorage keys are prefixed `atelier.`** — exactly: `atelier.sessionsDone`, `atelier.installDismissedAt`. (B1 already established `atelier.sound` / `atelier.haptic`.)
- **`src/lib/pwa-prefs.ts` must be React-free** (no react imports) so vitest can test it in the `node` environment, like B1's three modules.
- **Never show the banner when the app is already installed.** Both `matchMedia('(display-mode: standalone)')` and `navigator.standalone` (iOS's own flag) must be checked.
- **`beforeinstallprompt` must be `preventDefault()`ed and stashed.** The stashed event is single-use: after calling `prompt()` once, drop the reference.
- **iOS Safari never fires `beforeinstallprompt`.** There is no API to trigger installation there — the iOS branch shows instructions only, never a working install button. Do not fake one.
- **Comments in English**; all user-facing strings go through i18n in BOTH `vi` and `en`.
- **TDD for `pwa-prefs.ts`.** Write the failing test first, run it, confirm it fails, then implement. The component has no automated test (spec practice-modes §12) — verify by running the app.
- **Do NOT create scratch pages or routes under `src/app/`.** Any temp file must be deleted before finishing. (A previous agent left debris; don't repeat it.)
- **Stage only your own files.** Never `git add -A`.
- **Commit style:** lowercase conventional prefix (`feat(pwa):`, `test(pwa):`). End messages with a blank line then `Co-Authored-By: Claude <noreply@anthropic.com>`.

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `src/lib/pwa-prefs.ts` | Create | Every "should we ask?" rule: session counting, dismissal memory, standalone detection. React-free, pure enough to test. |
| `src/lib/pwa-prefs.test.ts` | Create | The gate logic under all its branches. |
| `src/components/pwa-install.tsx` | Create | `beforeinstallprompt` capture, the banner UI, the iOS instruction branch. |
| `src/app/layout.tsx` | Modify | Mount `<PwaInstall />` beside `<SwRegister />` (line 69). |
| `src/components/practice/practice-shell.tsx` | Modify | One line: `recordSessionDone()` inside the existing `endedRef` guard. |
| `src/lib/i18n/dictionaries.ts` | Modify | New top-level `pwa` section in `vi` (before line 433) and `en` (before line 849). |

---

## Task 1: The gate module (TDD)

**Files:**
- Create: `src/lib/pwa-prefs.ts`, `src/lib/pwa-prefs.test.ts`

**Interfaces produced:**
```ts
export function recordSessionDone(): void;
export function sessionsDone(): number;
export function recordDismissed(nowMs: number): void;
export function isDismissalActive(nowMs: number): boolean;
export function isStandalone(): boolean;
export function isIos(): boolean;
export function shouldOffer(nowMs: number): boolean;
export const MIN_SESSIONS = 1;
export const DISMISS_DAYS = 30;
```

Note `nowMs` is passed IN rather than read from `Date.now()` inside the module. That keeps the time-dependent logic testable without faking timers.

- [ ] **Step 1: Write `pwa-prefs.test.ts` (failing first)**

```ts
import { describe, it, expect, vi, afterEach } from "vitest";
import {
  recordSessionDone,
  sessionsDone,
  recordDismissed,
  isDismissalActive,
  isStandalone,
  shouldOffer,
  DISMISS_DAYS,
} from "./pwa-prefs";

const DAY = 24 * 60 * 60 * 1000;

function stubStorage(seed: Record<string, string> = {}) {
  const store = new Map(Object.entries(seed));
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  });
  return store;
}

// The app counts as "installed" when either signal says so.
function stubDisplayMode(opts: { standalone?: boolean; iosStandalone?: boolean } = {}) {
  vi.stubGlobal("window", {
    matchMedia: (q: string) => ({ matches: !!opts.standalone && q.includes("standalone") }),
  });
  vi.stubGlobal("navigator", { standalone: opts.iosStandalone ?? false, userAgent: "test" });
}

describe("pwa-prefs", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("starts with zero completed sessions", () => {
    stubStorage();
    expect(sessionsDone()).toBe(0);
  });

  it("counts completed sessions", () => {
    stubStorage();
    recordSessionDone();
    recordSessionDone();
    expect(sessionsDone()).toBe(2);
  });

  it("uses an atelier-prefixed key for the counter", () => {
    const store = stubStorage();
    recordSessionDone();
    expect(store.has("atelier.sessionsDone")).toBe(true);
  });

  it("treats a garbage counter value as zero rather than NaN", () => {
    stubStorage({ "atelier.sessionsDone": "banana" });
    expect(sessionsDone()).toBe(0);
  });

  it("remembers a dismissal for DISMISS_DAYS and then forgets it", () => {
    stubStorage();
    const t0 = 1_000_000_000_000;
    recordDismissed(t0);
    expect(isDismissalActive(t0)).toBe(true);
    expect(isDismissalActive(t0 + (DISMISS_DAYS - 1) * DAY)).toBe(true);
    expect(isDismissalActive(t0 + (DISMISS_DAYS + 1) * DAY)).toBe(false);
  });

  it("reports no active dismissal when none was ever recorded", () => {
    stubStorage();
    expect(isDismissalActive(1_000_000_000_000)).toBe(false);
  });

  it("detects standalone via display-mode", () => {
    stubStorage();
    stubDisplayMode({ standalone: true });
    expect(isStandalone()).toBe(true);
  });

  it("detects standalone via the iOS navigator flag", () => {
    stubStorage();
    stubDisplayMode({ iosStandalone: true });
    expect(isStandalone()).toBe(true);
  });

  it("does not offer before the session threshold is met", () => {
    stubStorage();
    stubDisplayMode();
    expect(shouldOffer(1_000_000_000_000)).toBe(false);
  });

  it("offers once the session threshold is met", () => {
    stubStorage();
    stubDisplayMode();
    recordSessionDone();
    expect(shouldOffer(1_000_000_000_000)).toBe(true);
  });

  it("never offers while running standalone, however many sessions are done", () => {
    stubStorage();
    stubDisplayMode({ standalone: true });
    recordSessionDone();
    recordSessionDone();
    expect(shouldOffer(1_000_000_000_000)).toBe(false);
  });

  it("does not offer while a dismissal is still active", () => {
    stubStorage();
    stubDisplayMode();
    recordSessionDone();
    const t0 = 1_000_000_000_000;
    recordDismissed(t0);
    expect(shouldOffer(t0 + DAY)).toBe(false);
    expect(shouldOffer(t0 + (DISMISS_DAYS + 1) * DAY)).toBe(true);
  });

  it("does not throw when localStorage is unavailable (SSR)", () => {
    vi.stubGlobal("localStorage", undefined);
    stubDisplayMode();
    expect(() => sessionsDone()).not.toThrow();
    expect(() => recordSessionDone()).not.toThrow();
    expect(sessionsDone()).toBe(0);
  });
});
```

- [ ] **Step 2: Run it, confirm FAIL**

Run: `npx vitest run src/lib/pwa-prefs.test.ts`
Expected: FAIL — "Cannot find module './pwa-prefs'".

- [ ] **Step 3: Write `pwa-prefs.ts`**

```ts
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
```

- [ ] **Step 4: Run it, confirm PASS**

Run: `npx vitest run src/lib/pwa-prefs.test.ts`
Expected: PASS — 13 tests.

- [ ] **Step 5: Full suite + type-check, then commit**

Run: `npx vitest run && npx tsc --noEmit` — expected 53 tests passing (40 from B1 + 13 new), tsc clean.

```bash
git add src/lib/pwa-prefs.ts src/lib/pwa-prefs.test.ts
git commit -m "$(cat <<'EOF'
feat(pwa): install-invite gate with session and dismissal rules

Policy lives apart from plumbing: this module answers "should we ask?" and
knows nothing about the DOM. Time is injected rather than read from Date.now
so every rule is testable without fake timers.

Standalone detection reads two signals — the standards-based display-mode
query and Safari's own navigator.standalone — because iOS implements neither
beforeinstallprompt nor the standard flag.

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: The banner component + wiring

**Files:**
- Create: `src/components/pwa-install.tsx`
- Modify: `src/app/layout.tsx`, `src/components/practice/practice-shell.tsx`, `src/lib/i18n/dictionaries.ts`

**Interfaces consumed:** everything exported by `src/lib/pwa-prefs.ts` (Task 1).

- [ ] **Step 1: Add i18n keys**

In `src/lib/i18n/dictionaries.ts`, add a new top-level `pwa` section to the **`vi`** dictionary. Put it immediately after the `topics: { ... }` section's closing brace and before the `},` that closes the `vi` block (around line 432):

```ts
    pwa: {
      title: "Cài Atelier vào máy",
      body: "Mở nhanh từ màn hình chính, chạy toàn màn hình, dùng được cả khi mạng chập chờn.",
      install: "Cài đặt",
      later: "Để sau",
      iosTitle: "Thêm Atelier vào màn hình chính",
      iosStep1: "Bấm nút Chia sẻ ở thanh dưới Safari",
      iosStep2: 'Chọn "Thêm vào MH chính"',
      dismiss: "Đóng",
    },
```

Add the same section to the **`en`** dictionary, in the matching position at the end of the `en` block (around line 848):

```ts
    pwa: {
      title: "Install Atelier",
      body: "Open it straight from your home screen, full screen, and keep working when the network drops.",
      install: "Install",
      later: "Not now",
      iosTitle: "Add Atelier to your home screen",
      iosStep1: "Tap the Share button in Safari's bottom bar",
      iosStep2: 'Choose "Add to Home Screen"',
      dismiss: "Dismiss",
    },
```

Both dictionaries must end up with the same key set — verify by comparing.

- [ ] **Step 2: Create `src/components/pwa-install.tsx`**

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { isIos, isStandalone, recordDismissed, shouldOffer } from "@/lib/pwa-prefs";

// The event Chrome fires when the app qualifies for installation. It is not in
// TypeScript's DOM lib, so it is declared here rather than pulled from a
// dependency.
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function PwaInstall() {
  const { t } = useI18n();
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [iosMode, setIosMode] = useState(false);

  // ---- capture the browser's install offer before it shows its own UI ----
  useEffect(() => {
    const onBeforeInstall = (e: Event) => {
      // Without preventDefault, Chrome shows its own mini-infobar and this
      // banner would be a second, redundant prompt.
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      if (shouldOffer(Date.now())) setVisible(true);
    };
    const onInstalled = () => {
      // Installed — nothing left to ask for, now or later.
      setVisible(false);
      setDeferred(null);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  // ---- iOS branch: Safari never fires beforeinstallprompt ----
  // There is no API to trigger installation there, so the only honest option is
  // to show the manual steps. Gated on the same rules as the Chrome branch.
  useEffect(() => {
    if (!isIos() || isStandalone()) return;
    if (!shouldOffer(Date.now())) return;
    setIosMode(true);
    setVisible(true);
  }, []);

  const dismiss = useCallback(() => {
    recordDismissed(Date.now());
    setVisible(false);
  }, []);

  const install = useCallback(async () => {
    const evt = deferred;
    if (!evt) return;
    // The stashed event is single-use: once prompt() has been called, the
    // browser will not accept it again.
    setDeferred(null);
    setVisible(false);
    try {
      await evt.prompt();
      const choice = await evt.userChoice;
      // Declining the native dialog counts as "not now" — without this, the
      // banner would reappear on the next visit having already been refused.
      if (choice.outcome === "dismissed") recordDismissed(Date.now());
    } catch {
      // Browser refused to show it (already installed, or a stale event).
    }
  }, [deferred]);

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label={iosMode ? t("pwa.iosTitle") : t("pwa.title")}
      className="fixed inset-x-0 bottom-20 md:bottom-6 z-50 px-4 pb-[env(safe-area-inset-bottom)]"
    >
      <div className="card-atelier mx-auto max-w-md p-4 sm:p-5 relative">
        <button
          onClick={dismiss}
          aria-label={t("pwa.dismiss")}
          className="absolute top-3 right-3 text-soft hover:text-ink transition-colors"
        >
          <X size={16} />
        </button>

        <div className="flex items-start gap-3">
          <span className="inline-grid h-10 w-10 shrink-0 place-items-center rounded-full bg-ember/12 text-ember">
            {iosMode ? <Share size={18} /> : <Download size={18} />}
          </span>
          <div className="min-w-0 pr-6">
            <p className="text-sm font-semibold leading-tight">
              {iosMode ? t("pwa.iosTitle") : t("pwa.title")}
            </p>

            {iosMode ? (
              <ol className="mt-2 space-y-1 text-xs text-soft list-decimal list-inside">
                <li>{t("pwa.iosStep1")}</li>
                <li>{t("pwa.iosStep2")}</li>
              </ol>
            ) : (
              <>
                <p className="text-xs text-soft mt-1 leading-relaxed">{t("pwa.body")}</p>
                <div className="flex items-center gap-2 mt-3">
                  <button
                    onClick={install}
                    className="rounded-full bg-ink text-paper px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity"
                  >
                    {t("pwa.install")}
                  </button>
                  <button
                    onClick={dismiss}
                    className="rounded-full border border-line px-4 py-2 text-sm text-soft hover:text-ink transition-colors"
                  >
                    {t("pwa.later")}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Mount it in `layout.tsx`**

Add the import beside the existing `SwRegister` import (line 9):

```ts
import { PwaInstall } from "@/components/pwa-install";
```

And render it beside `<SwRegister />` (line 69):

```tsx
              <SwRegister />
              <PwaInstall />
```

- [ ] **Step 4: Count completed sessions in `practice-shell.tsx`**

Add the import:

```ts
import { recordSessionDone } from "@/lib/pwa-prefs";
```

In the completion effect, the existing lines are:

```ts
    if (endedRef.current) return;
    endedRef.current = true;
    setDone(true);
    playSound("complete");
```

Add the counter call immediately after `playSound("complete");`:

```ts
    // Counted here rather than on the summary screen's render: endedRef makes
    // this run exactly once per finished session, and a remount of the summary
    // must not inflate the count.
    recordSessionDone();
```

- [ ] **Step 5: Type-check, test, and verify in the browser**

Run: `npx tsc --noEmit && npx vitest run` — clean, 53 tests.

Then `npm run dev` and verify:
1. **Fresh state** (DevTools → Application → Local Storage → clear): no banner on any page. This is the important negative case — the invite must not appear before a session is done.
2. Set `localStorage.setItem('atelier.sessionsDone','1')`, reload → in Chrome the banner appears (Chrome only fires `beforeinstallprompt` on a qualifying origin; on `localhost` it generally does — if it does not fire in your environment, say so honestly in the report rather than claiming you saw the banner).
3. Click "Not now" → banner disappears and `atelier.installDismissedAt` is set; reload → no banner.
4. Clear `atelier.installDismissedAt`, then in DevTools toggle device emulation to an iPhone and reload → the iOS instruction variant renders (Share icon + two numbered steps, no Install button).
5. Confirm the banner sits above the mobile bottom nav and does not cover it.

- [ ] **Step 6: Commit**

```bash
git add src/components/pwa-install.tsx src/app/layout.tsx src/components/practice/practice-shell.tsx src/lib/i18n/dictionaries.ts
git commit -m "$(cat <<'EOF'
feat(pwa): invite people to install once the app has proved useful

The banner waits for a finished session, remembers "not now" for a month,
and never appears when the app is already running standalone. Declining
Chrome's own dialog is recorded as a dismissal too, so a refusal is not
re-asked on the next visit.

iOS gets a separate branch: Safari fires no beforeinstallprompt and exposes
no way to trigger installation, so it shows the manual Share steps rather
than a button that cannot work.

The session counter increments inside the shell's existing endedRef guard,
which already runs exactly once per completed session.

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

## Verification checklist for the whole plan

- [ ] `npx vitest run` — 53 tests pass (40 from B1 + 13 new)
- [ ] `npx tsc --noEmit` — clean
- [ ] No banner in fresh state; banner after one completed session
- [ ] "Not now" persists across reload
- [ ] iOS emulation shows instructions, not an install button
- [ ] No new dependency in `package.json`
- [ ] No debris files under `src/app/`
- [ ] Both `vi` and `en` have the identical `pwa` key set
