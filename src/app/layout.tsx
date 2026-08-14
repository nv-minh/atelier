import type { Metadata, Viewport } from "next";
import { Fraunces, Hanken_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { I18nProvider } from "@/components/i18n-provider";
import { Providers } from "@/components/providers";
import { ProgressBar } from "@/components/progress-bar";
import { Nav } from "@/components/nav";
import { SwRegister } from "@/components/sw-register";
import { PwaInstall } from "@/components/pwa-install";

// The "vietnamese" subset is not optional here. Google's "latin" unicode-range
// excludes U+1EA0–1EF9 (ạ ả ấ ầ ậ ế ệ ị ọ ộ ớ ợ ụ ứ ữ …) and U+01A0/01AF (Ơ Ư),
// so without it those glyphs fall back per-character to Georgia / system-ui /
// ui-monospace. The damage lands hardest in the hero, which renders Vietnamese
// at up to 96px: six of the twenty glyphs in "Học tiếng Anh và nhớ được lâu."
// would break stroke weight mid-word, and .display-it loses its SOFT/WONK
// variable axes entirely because Georgia has none. Costs ~5–20 KB per family.
const display = Fraunces({
  subsets: ["latin", "vietnamese"],
  variable: "--font-display",
  display: "swap",
  axes: ["opsz", "SOFT", "WONK"],
  style: ["normal", "italic"],
});

const sans = Hanken_Grotesk({
  subsets: ["latin", "vietnamese"],
  variable: "--font-sans",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin", "vietnamese"],
  variable: "--font-mono",
  display: "swap",
});

// The one place the canonical host is named. Moving to a custom domain is a
// Vercel env change, not a code change — and metadataBase must be absolute or
// the Open Graph image URL resolves relative and breaks in every scraper.
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://vocab-master-dusky.vercel.app";

// Metadata is Vietnamese because the server render is Vietnamese: DEFAULT_LANG
// is "vi" and the English toggle only applies client-side, after hydration.
// A crawler never sees the English copy, so describing the site in English
// would be describing a page that does not exist.
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Atelier — Studio học ngôn ngữ",
    template: "%s · Atelier",
  },
  description:
    "Studio luyện tiếng Anh theo lịch nhắc lại (FSRS): hơn 8.000 từ A1–C1, bảy chế độ học, đo trình độ và lịch ôn tính riêng cho bạn. Miễn phí.",
  applicationName: "Atelier",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/favicon.svg",
    apple: "/icons/apple-touch-icon.png",
  },
  // Canonical only, no `languages` map: the VI/EN switch is a localStorage
  // toggle on the same URL, so hreflang would point at URLs that do not exist.
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "Atelier",
    locale: "vi_VN",
    title: "Atelier — Studio học ngôn ngữ",
    description:
      "Hơn 8.000 từ tiếng Anh A1–C1, ôn đúng vào ngày bạn sắp quên. Bảy chế độ học, đo trình độ, miễn phí.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Atelier — Studio học ngôn ngữ",
    description:
      "Hơn 8.000 từ tiếng Anh A1–C1, ôn đúng vào ngày bạn sắp quên. Bảy chế độ học, đo trình độ, miễn phí.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
  },
};

// Next 14.2: theme-color belongs in the viewport export, not metadata.
// Matches the manifest theme_color (Atelier ink #1F1C16).
export const viewport: Viewport = {
  themeColor: "#1F1C16",
};

// lang="vi" matches DEFAULT_LANG and what the server actually renders; the
// inline script in <head> swaps it for readers who chose English.
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi" suppressHydrationWarning className={`${display.variable} ${sans.variable} ${mono.variable}`}>
      <head>
        {/* Prevent FOUC: set theme + lang before paint, and capture the install
            prompt before React mounts.

            The beforeinstallprompt capture is deliberately OUTSIDE any try —
            it must not be skipped — but everything that touches localStorage is
            inside one. A stray `var l2=localStorage.getItem('lang')` used to sit
            unguarded between them; in Safari private browsing, or anywhere
            storage access is blocked, it threw and took window.__bip and the
            listener down with it, silently disabling the PWA install button for
            exactly the users most likely to have storage restricted. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');var m=window.matchMedia('(prefers-color-scheme: dark)').matches;if(t==='dark'||(!t&&m)){document.documentElement.classList.add('dark')}}catch(e){}try{var l=localStorage.getItem('lang');if(l){document.documentElement.lang=l}}catch(e){}window.__bip=null;addEventListener('beforeinstallprompt',function(e){e.preventDefault();window.__bip=e})})();`,
          }}
        />
      </head>
      <body className="font-sans antialiased">
        <ThemeProvider>
          <I18nProvider>
            <Providers>
              <ProgressBar />
              <Nav />
              <div className="relative z-10">{children}</div>
              <SwRegister />
              <PwaInstall />
            </Providers>
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
