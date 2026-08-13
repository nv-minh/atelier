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
