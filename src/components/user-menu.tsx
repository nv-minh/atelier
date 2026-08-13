"use client";

import { useSession, signOut } from "next-auth/react";
import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useI18n } from "./i18n-provider";

export function UserMenu() {
  const { data: session, status } = useSession();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  // When auth is bypassed (no real login), hide the user/login controls entirely.
  const bypass = process.env.NEXT_PUBLIC_AUTH_BYPASS === "1";

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", h);
    return () => window.removeEventListener("mousedown", h);
  }, []);

  if (bypass) return null;

  // Server render and first client render must emit the SAME element. Session
  // state is only known in the browser, so anything auth-dependent rendered
  // before mount changes the shape of the nav row and React throws out the
  // whole server tree ("hydration failed"), flashing the page for every guest.
  if (!mounted || status === "loading") {
    return <div className="h-9 w-9 rounded-full bg-ink/10 animate-pulse" />;
  }

  if (!session?.user) {
    return (
      <a
        href="/login"
        className="inline-flex items-center rounded-full border border-line px-3.5 py-1.5 text-sm font-medium text-soft hover:text-ink hover:border-ink/30 transition-colors"
      >
        {t("nav.login")}
      </a>
    );
  }

  const name = session.user.name || session.user.email || "?";
  const image = session.user.image;
  const initial = name.charAt(0).toUpperCase();

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="h-9 w-9 rounded-full overflow-hidden border border-line hover:border-ember/40 transition-colors"
        aria-label="Account"
      >
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt={name} className="h-full w-full object-cover" />
        ) : (
          <span className="grid h-full w-full place-items-center bg-ink text-paper text-sm font-semibold">
            {initial}
          </span>
        )}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-2 w-56 card-atelier p-2 z-50"
          >
            <div className="px-3 py-2 border-b border-line mb-1">
              <p className="text-sm font-medium truncate">{name}</p>
              {session.user.email && (
                <p className="text-xs text-soft truncate">{session.user.email}</p>
              )}
            </div>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="w-full text-left px-3 py-2 rounded-xl text-sm text-soft hover:bg-ink/5 hover:text-ink transition-colors"
            >
              {t("nav.logout")}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
