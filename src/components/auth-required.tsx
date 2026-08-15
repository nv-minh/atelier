"use client";

// The screen a guest gets when they land on a gated URL directly (typed,
// bookmarked, or shared) instead of tapping through the client-side prompt in
// auth-gate.tsx. It replaces the old redirect("/login"), which looked like a
// broken tap whenever the guest was already sitting on /login.
//
// Every wall names what is behind it and points back at the two areas that
// stay open without an account — a guest is never left with only a dead end.

import Link from "next/link";
import { Lock, Compass, Library } from "lucide-react";
import { useI18n } from "./i18n-provider";
import { startSignIn, GoogleMark } from "./auth-gate";
import { cn } from "@/lib/utils";

export type WallContext =
  | "stats"
  | "notebook"
  | "topic"
  | "library"
  | "word"
  | "settings"
  | "home"
  | "leaderboard"
  | "grammar";

export function AuthRequired({
  context,
  callbackUrl,
  variant = "page",
  className,
}: {
  context: WallContext;
  /** Where to return after signing in. Defaults to the current URL. */
  callbackUrl?: string;
  /** "page" owns the whole screen; "panel" drops into an existing layout. */
  variant?: "page" | "panel";
  className?: string;
}) {
  const { t } = useI18n();

  const body = (
    <div
      className={cn(
        "card-atelier p-8 sm:p-10 text-center max-w-lg mx-auto animate-fade-up",
        className
      )}
    >
      <span className="grid h-12 w-12 place-items-center rounded-full bg-ember/10 text-ember mx-auto mb-5">
        <Lock size={20} strokeWidth={2} />
      </span>

      <p className="pill text-[10px] text-soft mb-4">{t("auth.badge")}</p>
      <h2 className="display text-2xl sm:text-3xl mb-3">{t(`auth.walls.${context}.title`)}</h2>
      <p className="text-soft leading-relaxed mb-7">{t(`auth.walls.${context}.body`)}</p>

      <button
        onClick={() => startSignIn(callbackUrl)}
        className="inline-flex items-center justify-center gap-2.5 rounded-full bg-ink text-paper px-7 py-3 font-medium hover:opacity-90 transition-opacity"
      >
        <GoogleMark />
        {t("auth.signInGoogle")}
      </button>

      <div className="mt-8 pt-6 border-t border-line">
        <p className="text-xs text-soft/80 mb-3">{t("auth.publicHint")}</p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Link
            href="/topics"
            className="inline-flex items-center gap-1.5 rounded-full border border-line px-4 py-2 text-sm text-soft hover:text-ink hover:border-ink/25 transition-colors"
          >
            <Compass size={14} /> {t("auth.exploreTopics")}
          </Link>
          <Link
            href="/browse"
            className="inline-flex items-center gap-1.5 rounded-full border border-line px-4 py-2 text-sm text-soft hover:text-ink hover:border-ink/25 transition-colors"
          >
            <Library size={14} /> {t("auth.exploreLibrary")}
          </Link>
        </div>
      </div>
    </div>
  );

  if (variant === "panel") return body;

  return (
    <main className="shell py-14 sm:py-20 pb-28 md:pb-20">
      <header className="mb-8 text-center max-w-xl mx-auto">
        <p className="text-sm text-soft font-mono mb-3">{t(`auth.walls.${context}.header`)}</p>
      </header>
      {body}
    </main>
  );
}
