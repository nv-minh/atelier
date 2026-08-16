"use client";

// Offline fallback served by the service worker when a navigation fails.
// Precached at SW install, so it must render WITHOUT a session or network.
// The i18n provider is network-independent (reads only localStorage), so
// t() is safe here — see src/components/i18n-provider.tsx.
import Link from "next/link";
import { useI18n } from "@/components/i18n-provider";
import { cn } from "@/lib/utils";
import { buttonClasses } from "@/lib/ui/button-classes";

export default function OfflinePage() {
  const { t } = useI18n();

  return (
    <main className="min-h-screen flex items-center justify-center px-6 relative overflow-hidden">
      <div aria-hidden className="absolute top-10 right-[-3rem] select-none pointer-events-none">
        <span className="display display-it text-[18rem] leading-[0.8] text-fg/[0.05]">a</span>
      </div>

      <div className="relative max-w-md w-full text-center">
        <div aria-hidden className="text-5xl mb-6">☁️</div>
        <p className="text-sm text-fg-muted font-mono mb-3">Atelier</p>
        <h1 className="display text-display-md mb-4">{t("offline.title")}</h1>
        <p className="text-fg-muted mb-10 leading-relaxed">{t("offline.body")}</p>

        <Link
          href="/"
          className={cn(buttonClasses("primary", "md"), "w-full sm:w-auto")}
        >
          {t("offline.retry")}
        </Link>
      </div>
    </main>
  );
}
