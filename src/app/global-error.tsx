"use client";

// Root error boundary. Fires when an error escapes the root layout itself, so
// the root layout (ThemeProvider, I18nProvider, globals.css, fonts) is NOT
// available here — this component must render its OWN <html>/<body> and not
// depend on Tailwind tokens or the i18n provider. Styles are inline so it looks
// acceptable even with no stylesheet loaded. Vietnamese-first, English below.
import { useEffect } from "react";

const INK = "#1F1C16"; // Atelier ink (matches manifest theme_color)
const PAPER = "#F7F3EA";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[atelier] global error boundary:", error);
  }, [error]);

  return (
    <html lang="vi">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "5rem 1.5rem",
          background: PAPER,
          color: INK,
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
        }}
      >
        <div style={{ maxWidth: 420, textAlign: "center" }}>
          <h1 style={{ fontSize: "1.5rem", margin: "0 0 0.25rem" }}>Ứng dụng gặp lỗi</h1>
          <p style={{ opacity: 0.7, fontSize: "0.9rem", margin: "0 0 1rem" }}>
            Something went wrong.
          </p>
          <p style={{ opacity: 0.7, fontSize: "0.9rem", margin: "0 0 1.75rem" }}>
            Tải lại trang, hoặc quay về trang chủ.
            <br />
            Reload the page, or head back home.
          </p>
          <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center" }}>
            <button
              onClick={reset}
              style={{
                background: INK,
                color: PAPER,
                border: "none",
                borderRadius: 9999,
                padding: "0.6rem 1.25rem",
                fontSize: "0.875rem",
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Thử lại · Try again
            </button>
            <a
              href="/"
              style={{
                border: `1px solid ${INK}33`,
                borderRadius: 9999,
                padding: "0.6rem 1.25rem",
                fontSize: "0.875rem",
                fontWeight: 500,
                textDecoration: "none",
                color: INK,
              }}
            >
              Về trang chủ
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
