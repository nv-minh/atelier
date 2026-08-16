"use client";

// TEMPORARY (X3): standalone-mode back button.
//
// PWA installs running in `display-mode: standalone` have no address bar, so
// there is no browser Back button, and iOS gives no edge-swipe gesture
// either — a user who taps into e.g. /topics/food is stuck there until they
// hit a tab in the bottom bar. This component is a stopgap for that.
//
// Plan 3 (`plan-3-app-shell-and-brand`) deletes this component and replaces
// it with a real Back button built into the new AppBar, plus a left-edge
// swipe gesture. Removing it is meant to be exactly:
//   1. `git rm src/components/standalone-back.tsx`
//   2. drop the `<StandaloneBack />` import/usage from src/components/nav.tsx
// Nothing else in the app should ever import from here.
//
// Rendered in nav.tsx as the first item in the header's left cluster, ahead
// of the brand Link — NOT as a `fixed` overlay. An earlier version floated
// this at `fixed top-left`, which measured out to overlapping BrandMark and
// the start of the "Atelier" wordmark on a real 375px viewport (see task-6
// fix round 1). Living inside the header's normal flex flow means it just
// pushes the logo right, and it inherits the header's own
// `pt-[env(safe-area-inset-top)]` (nav.tsx) for free — no separate safe-area
// padding or z-index needed here.

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useI18n } from "./i18n-provider";

export function StandaloneBack() {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useI18n();

  // Same reasoning as i18n-provider.tsx:31 — the server (and the first
  // client render, before hydration) has no `matchMedia`/`navigator` UA
  // signal to read and must render identically either way, or React logs a
  // hydration mismatch. So this starts at `false` and the real check only
  // ever runs after mount, inside the effect below.
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    setIsStandalone(
      window.matchMedia("(display-mode: standalone)").matches ||
        (navigator as any).standalone === true
    );
  }, []);

  if (!isStandalone) return null;
  // Nothing in session history to go back to.
  if (typeof window !== "undefined" && window.history.length <= 1) return null;
  // Root screen — there is no "back" from here.
  if (pathname === "/") return null;
  // Exactly nav.tsx's `isStudying` condition (nav.tsx:19). Now that this
  // renders inside the header, the header's own `opacity-0
  // pointer-events-none` already hides it during a study session — this
  // check is redundant in practice but stays as a literal copy of nav's
  // expression so the two can never disagree about when the session UI owns
  // the screen.
  if (pathname?.startsWith("/study/") && pathname !== "/study") return null;

  return (
    <button
      onClick={() => router.back()}
      aria-label={t("nav.back")}
      className="grid h-11 w-11 place-items-center rounded-full border border-hairline/10 bg-paper/85 backdrop-blur-xl text-fg hover:bg-paper-200/60 transition-colors"
    >
      <ArrowLeft size={20} />
    </button>
  );
}
