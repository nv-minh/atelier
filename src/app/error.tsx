"use client";

// Route-level error boundary. Catches an uncaught throw in any server/client
// component BELOW the root layout (which still wraps this page, so theming, the
// nav and i18n all remain). Purposefully self-contained: it must render even
// when the thing that broke is the data layer, so it depends on no data fetch
// and no i18n dictionary key (Vietnamese-first, English below — the app's own
// convention). A stack/message preview is shown only outside production.
import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[atelier] route error boundary:", error);
  }, [error]);

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-6 py-20">
      <div className="shell w-full max-w-md text-center">
        <p className="font-display text-6xl leading-none text-ink/15 select-none" aria-hidden>
          ¦
        </p>
        <h1 className="mt-4 font-display text-2xl text-ink">Đã xảy ra lỗi</h1>
        <p className="mt-1 text-sm text-soft">Something went wrong.</p>
        <p className="mt-4 text-sm text-soft">
          Trang này không tải được. Thử lại, hoặc quay về trang chủ.
          <br />
          This page didn&apos;t load. Try again, or head back home.
        </p>
        <div className="mt-7 flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-paper transition hover:bg-ink/90"
          >
            Thử lại · Try again
          </button>
          <a
            href="/"
            className="rounded-full border border-line px-5 py-2.5 text-sm font-medium text-ink transition hover:bg-ink/5"
          >
            Về trang chủ
          </a>
        </div>
        {process.env.NODE_ENV !== "production" && error?.message ? (
          <pre className="mt-6 max-h-40 overflow-auto rounded-lg border border-line bg-paper p-3 text-left text-xs text-soft">
            {error.message}
          </pre>
        ) : null}
      </div>
    </div>
  );
}
