"use client";

import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useI18n } from "@/components/i18n-provider";

function LoginInner() {
  const { t } = useI18n();
  const params = useSearchParams();
  const callbackUrl = params.get("callbackUrl") || "/";

  return (
    <main className="min-h-screen flex items-center justify-center px-6 relative overflow-hidden">
      {/* decorative */}
      <div aria-hidden className="absolute top-10 right-[-3rem] select-none pointer-events-none">
        <span className="display display-it text-[18rem] leading-[0.8] text-ink/[0.05]">a</span>
      </div>

      <div className="relative max-w-md w-full text-center">
        <p className="text-sm text-soft font-mono mb-3">Atelier</p>
        <h1 className="display text-display-md mb-4">
          {t("login.title1")} <span className="display-it text-ember">{t("login.title2")}</span>
        </h1>
        <p className="text-soft mb-10 leading-relaxed">{t("login.subtitle")}</p>

        <button
          onClick={() => signIn("github", { callbackUrl })}
          disabled={!hasGithub}
          className="group inline-flex items-center justify-center gap-3 rounded-full bg-ink text-paper px-7 py-3.5 font-medium hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed w-full sm:w-auto"
        >
          <GithubIcon />
          {t("login.github")}
        </button>

        {!hasGithub && (
          <p className="text-xs text-ember/80 mt-4 max-w-xs mx-auto">{t("login.notice")}</p>
        )}
      </div>
    </main>
  );
}

const hasGithub = process.env.NEXT_PUBLIC_GITHUB_ENABLED === "1";

function GithubIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden fill="currentColor">
      <path d="M12 .5C5.73.5.5 5.73.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.53-1.34-1.3-1.7-1.3-1.7-1.06-.72.08-.71.08-.71 1.17.08 1.79 1.2 1.79 1.2 1.04 1.79 2.73 1.27 3.4.97.11-.75.41-1.27.74-1.56-2.55-.29-5.23-1.28-5.23-5.69 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11 11 0 0 1 2.9-.39c.98 0 1.97.13 2.9.39 2.21-1.49 3.18-1.18 3.18-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.84 1.19 3.1 0 4.42-2.69 5.39-5.25 5.68.42.36.79 1.08.79 2.18v3.23c0 .31.21.68.8.56A11.51 11.51 0 0 0 23.5 12C23.5 5.73 18.27.5 12 .5z" />
    </svg>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}
