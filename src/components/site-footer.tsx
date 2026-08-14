"use client";

// Rendered by the landing page only, for now. The signed-in routes keep a tab
// bar pinned to the bottom on mobile, so a footer there would sit underneath
// it — wiring this site-wide is a separate change with its own layout work.

import Link from "next/link";
import { useI18n } from "@/components/i18n-provider";

export function SiteFooter() {
  const { t } = useI18n();

  return (
    <footer className="mt-20 sm:mt-28 border-t border-line pt-8">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-soft/70">
          {t("footer.tagline")}
        </p>
        <nav className="flex items-center gap-5 text-sm text-soft">
          <Link href="/privacy" className="hover:text-ink transition-colors">
            {t("footer.privacy")}
          </Link>
          <Link href="/terms" className="hover:text-ink transition-colors">
            {t("footer.terms")}
          </Link>
        </nav>
      </div>
      <p className="mt-4 max-w-2xl text-xs leading-relaxed text-soft/70">
        {t("footer.dataLine")}
      </p>
    </footer>
  );
}
