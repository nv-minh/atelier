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
          onClick={() => signIn("google", { callbackUrl })}
          disabled={!hasGoogle}
          className="group inline-flex items-center justify-center gap-3 rounded-full bg-ink text-paper px-7 py-3.5 font-medium hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed w-full sm:w-auto"
        >
          <GoogleIcon />
          {t("login.google")}
        </button>

        {!hasGoogle && (
          <p className="text-xs text-ember/80 mt-4 max-w-xs mx-auto">{t("login.notice")}</p>
        )}
      </div>
    </main>
  );
}

const hasGoogle = process.env.NEXT_PUBLIC_GOOGLE_ENABLED === "1";

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
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

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}
