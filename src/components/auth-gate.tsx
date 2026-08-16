"use client";

// The guest experience used to be a dead end: the bottom nav showed every tab,
// but tapping a gated one hit a server-side redirect("/login") that landed on
// the page the guest was already looking at — so the tap "did nothing".
//
// Two pieces replace it, and they share this file's copy and sign-in button:
//   • AuthGateModal (here) — for taps the client can intercept BEFORE
//     navigating: a topic card, page 2 of the library, the star button.
//   • <AuthRequired> (auth-required.tsx) — for a guest who lands on a gated
//     URL directly. Rendered by the page instead of redirecting.
//
// Only a KNOWN guest is gated. While NextAuth resolves the session, taps pass
// through — a signed-in user must never be interrupted by a login prompt, and
// the server gate is still there as the real enforcement.

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useSession, signIn } from "next-auth/react";
import { AnimatePresence, motion } from "motion/react";
import { Lock, X } from "lucide-react";
import { useI18n } from "./i18n-provider";

// Reasons map to auth.reasons.* copy — one sentence explaining what the
// login unlocks, so the prompt answers "why" instead of just demanding.
export type GateReason =
  | "topic"
  | "library"
  | "word"
  | "star"
  | "study"
  | "placement"
  | "grammar"
  | "generic";

type OpenOpts = { callbackUrl?: string; reason?: GateReason };

type GateCtx = {
  /** Session is resolved AND says nobody is signed in. */
  knownGuest: boolean;
  /** Open the prompt unconditionally (caller already knows it's a guest). */
  open: (opts?: OpenOpts) => void;
  /** true = proceed. false = the caller is a known guest and the prompt opened. */
  requireAuth: (opts?: OpenOpts) => boolean;
};

const Ctx = createContext<GateCtx>({
  knownGuest: false,
  open: () => {},
  requireAuth: () => true,
});

const GOOGLE_ENABLED = process.env.NEXT_PUBLIC_GOOGLE_ENABLED === "1";
const BYPASS = process.env.NEXT_PUBLIC_AUTH_BYPASS === "1";

export function AuthGateProvider({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const [opts, setOpts] = useState<OpenOpts | null>(null);

  const knownGuest = !BYPASS && status === "unauthenticated";

  const open = useCallback((o?: OpenOpts) => setOpts(o ?? {}), []);
  const close = useCallback(() => setOpts(null), []);

  const requireAuth = useCallback(
    (o?: OpenOpts) => {
      if (!knownGuest) return true;
      setOpts(o ?? {});
      return false;
    },
    [knownGuest]
  );

  const value = useMemo(() => ({ knownGuest, open, requireAuth }), [knownGuest, open, requireAuth]);

  return (
    <Ctx.Provider value={value}>
      {children}
      <AuthGateModal opts={opts} onClose={close} />
    </Ctx.Provider>
  );
}

export function useAuthGate() {
  return useContext(Ctx);
}

/**
 * Click handler for a <Link> a guest may not follow: swallows the navigation
 * and opens the prompt instead. `authed` comes from the server render, so
 * there is no flash of a wrong state on first paint.
 */
export function useGuestGuard(authed: boolean) {
  const { open } = useAuthGate();
  return useCallback(
    (href: string, reason: GateReason = "generic") =>
      (e: React.MouseEvent) => {
        if (authed) return;
        e.preventDefault();
        open({ callbackUrl: href, reason });
      },
    [authed, open]
  );
}

/** Send the visitor to Google, or to /login when Google is not configured. */
export function startSignIn(callbackUrl?: string) {
  const cb =
    callbackUrl ||
    (typeof window !== "undefined" ? window.location.pathname + window.location.search : "/");
  if (GOOGLE_ENABLED) {
    signIn("google", { callbackUrl: cb });
  } else if (typeof window !== "undefined") {
    // No Google credentials on the server: /login owns the "not configured"
    // notice, so hand off rather than firing a sign-in that cannot succeed.
    window.location.href = `/login?callbackUrl=${encodeURIComponent(cb)}`;
  }
}

function AuthGateModal({ opts, onClose }: { opts: OpenOpts | null; onClose: () => void }) {
  const { t } = useI18n();
  const openNow = opts !== null;

  // Escape closes. Body scroll is locked so the page behind cannot move under
  // the sheet on mobile.
  useEffect(() => {
    if (!openNow) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [openNow, onClose]);

  const reason = opts?.reason ?? "generic";

  return (
    <AnimatePresence>
      {openNow && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="auth-gate-title"
        >
          <div
            className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden
          />
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.98 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="relative w-full sm:max-w-sm card-atelier p-7 pb-[calc(1.75rem+env(safe-area-inset-bottom))] sm:pb-7 rounded-t-3xl sm:rounded-[1.25rem]"
          >
            <button
              onClick={onClose}
              aria-label={t("auth.later")}
              className="absolute right-4 top-4 rounded-full p-1.5 text-fg-muted hover:text-fg hover:bg-ink/5 transition-colors"
            >
              <X size={16} />
            </button>

            <span className="grid h-11 w-11 place-items-center rounded-full bg-ember/10 text-ember mb-5">
              <Lock size={18} strokeWidth={2} />
            </span>

            <h2 id="auth-gate-title" className="display text-2xl mb-2">
              {t("auth.gateTitle")}
            </h2>
            <p className="text-sm text-fg-muted leading-relaxed mb-6">{t(`auth.reasons.${reason}`)}</p>

            <button
              onClick={() => startSignIn(opts?.callbackUrl)}
              className="w-full inline-flex items-center justify-center gap-2.5 rounded-full bg-ink text-paper px-6 py-3 font-medium hover:opacity-90 transition-opacity"
            >
              <GoogleMark />
              {GOOGLE_ENABLED ? t("auth.signInGoogle") : t("auth.signIn")}
            </button>
            <button
              onClick={onClose}
              className="w-full mt-2 rounded-full px-6 py-2.5 text-sm text-fg-muted hover:text-fg transition-colors"
            >
              {t("auth.later")}
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function GoogleMark({ size = 17 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.46a5.52 5.52 0 0 1-2.4 3.62v3.01h3.88c2.27-2.09 3.58-5.17 3.58-8.82z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.08 7.94-2.91l-3.88-3.01c-1.08.72-2.45 1.16-4.06 1.16-3.13 0-5.78-2.11-6.73-4.96H1.26v3.09A12 12 0 0 0 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.28a7.21 7.21 0 0 1 0-4.56V6.63H1.26a12 12 0 0 0 0 10.74l4.01-3.09z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.44-3.44C17.95 1.18 15.24 0 12 0A12 12 0 0 0 1.26 6.63l4.01 3.09C6.22 6.86 8.87 4.75 12 4.75z"
      />
    </svg>
  );
}
