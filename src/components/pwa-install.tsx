"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Download, Share, X } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  isIos,
  recordDismissed,
  SESSION_DONE_EVENT,
  shouldOffer,
} from "@/lib/pwa-prefs";

// The event Chrome fires when the app qualifies for installation. It is not in
// TypeScript's DOM lib, so it is declared here rather than pulled from a
// dependency.
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function PwaInstall() {
  const { t } = useI18n();
  const pathname = usePathname();
  // Never read during render — only the effect and the install handler touch
  // it — so a ref avoids re-rendering on every beforeinstallprompt/appinstalled
  // event for no visual reason.
  const deferredRef = useRef<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [iosMode, setIosMode] = useState(false);

  // The single decision of whether to show something right now. Called on
  // mount, whenever a real install event arrives, whenever a session
  // finishes, and whenever the route changes — that last one matters because
  // a first-time user can cross the session threshold mid-visit, well after
  // the page's one shot at beforeinstallprompt has already come and gone.
  const recheck = useCallback(() => {
    // Decide nothing while the banner is suppressed: recording a dismissal for
    // a card that cannot render would burn the one invite this user gets.
    if (pathname?.startsWith("/study/")) return;
    if (deferredRef.current) {
      if (shouldOffer(Date.now())) setVisible(true);
      return;
    }
    if (isIos() && shouldOffer(Date.now())) {
      // Safari never fires appinstalled and navigator.standalone stays
      // false inside a Safari tab even after the app is added to the home
      // screen, so showing these steps is the only "did they ask" signal
      // we get — count it as a dismissal, or the card reappears forever.
      recordDismissed(Date.now());
      setIosMode(true);
      setVisible(true);
    }
  }, [pathname]);

  // recheck's identity changes with pathname; the event-listener effect below
  // only runs once, so it reaches the latest version through this ref rather
  // than resubscribing on every route change.
  const recheckRef = useRef(recheck);
  useEffect(() => {
    recheckRef.current = recheck;
  }, [recheck]);

  // Re-evaluate whenever the route changes — leaving a study route can
  // reveal a decision that the pathname gate above previously suppressed.
  // The mount effect below already performs the initial check (after seeding
  // the pre-hydration stash), so this skips that first run to avoid an
  // unseeded duplicate.
  const isFirstPathnameRun = useRef(true);
  useEffect(() => {
    if (isFirstPathnameRun.current) {
      isFirstPathnameRun.current = false;
      return;
    }
    recheck();
  }, [recheck]);

  useEffect(() => {
    // Seed from the pre-hydration stash (see the inline script in
    // layout.tsx): on a repeat visit the install criteria can already be met
    // at load, so Chrome may fire beforeinstallprompt before this bundle
    // executes, and the event is unusable once its turn passes.
    const win = window as unknown as { __bip?: BeforeInstallPromptEvent | null };
    if (win.__bip) {
      deferredRef.current = win.__bip;
      win.__bip = null;
    }

    const onBeforeInstall = (e: Event) => {
      // Without preventDefault, Chrome shows its own mini-infobar and this
      // banner would be a second, redundant prompt.
      e.preventDefault();
      deferredRef.current = e as BeforeInstallPromptEvent;
      // A real install event beats UA guessing — if this fires, the platform
      // is not iOS, whatever the user agent looked like.
      setIosMode(false);
      recheckRef.current();
    };
    const onInstalled = () => {
      // Installed — nothing left to ask for, now or later.
      setVisible(false);
      deferredRef.current = null;
    };
    const onSessionDone = () => recheckRef.current();

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    window.addEventListener(SESSION_DONE_EVENT, onSessionDone);
    recheckRef.current();

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
      window.removeEventListener(SESSION_DONE_EVENT, onSessionDone);
    };
  }, []);

  const dismiss = useCallback(() => {
    recordDismissed(Date.now());
    setVisible(false);
  }, []);

  const install = useCallback(async () => {
    const evt = deferredRef.current;
    if (!evt) return;
    // The stashed event is single-use: once prompt() has been called, the
    // browser will not accept it again.
    deferredRef.current = null;
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
  }, []);

  // Live study routes get the achievement toast in the same fixed corner —
  // stay out of its way rather than paint over it.
  if (pathname?.startsWith("/study/")) return null;
  if (!visible) return null;

  // bottom-24 clears the mobile tab bar: 64px of row plus its own 0.5rem of
  // slack, and the safe-area inset is padded for below that.
  return (
    <div
      role="region"
      aria-live="polite"
      aria-label={iosMode ? t("pwa.iosTitle") : t("pwa.title")}
      className="fixed inset-x-0 bottom-24 md:bottom-6 z-50 px-4 pb-[env(safe-area-inset-bottom)]"
    >
      <Card variant="flat" className="mx-auto max-w-md p-4 sm:p-5 relative">
        <button
          onClick={dismiss}
          aria-label={t("pwa.dismiss")}
          className="absolute top-3 right-3 text-fg-muted hover:text-fg transition-colors"
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
              <ol className="mt-2 space-y-1 text-xs text-fg-muted list-decimal list-inside">
                <li>{t("pwa.iosStep1")}</li>
                <li>{t("pwa.iosStep2")}</li>
              </ol>
            ) : (
              <>
                <p className="text-xs text-fg-muted mt-1 leading-relaxed">{t("pwa.body")}</p>
                <div className="flex items-center gap-2 mt-3">
                  <Button onClick={install} variant="primary" size="sm">
                    {t("pwa.install")}
                  </Button>
                  <button
                    onClick={dismiss}
                    className="rounded-full border border-hairline/10 px-4 py-2 text-sm text-fg-muted hover:text-fg transition-colors"
                  >
                    {t("pwa.later")}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
