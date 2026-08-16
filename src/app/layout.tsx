import type { Metadata, Viewport } from "next";
import { Be_Vietnam_Pro, Noto_Sans_Mono } from "next/font/google";
import "@/styles/tokens.css";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { I18nProvider } from "@/components/i18n-provider";
import { Providers } from "@/components/providers";
import { ProgressBar } from "@/components/progress-bar";
import { Nav } from "@/components/nav";
import { SwRegister } from "@/components/sw-register";
import { PwaInstall } from "@/components/pwa-install";

// Be Vietnam Pro replaces both Literata (--font-display) and Fira Sans
// (--font-sans) — one family, not two (spec §7 R7). Verified, not assumed:
// src/app/dev/type/page.tsx measures every required Vietnamese diacritic
// (ệ ặ ỡ ữ ợ ẩ ẳ ỷ Ơ Ư Đ) against this family with a canvas double-fallback
// trick (same char, two different-metric generics appended — equal widths
// only if the family truly has the glyph), and scripts/ui/check-type.mjs
// turned that into a gate that ran green before this file was touched. Kit v2
// also proposed IBM Plex Mono + Charis SIL for mono/IPA, but that swap is NOT
// made here: IBM Plex Mono is unmeasured, and Charis SIL is a serif, which
// would put IPA transcriptions in a different letterform family than the
// app's geometric sans headings and body copy — see the mono block below,
// unchanged, and R7 for the full ruling. Total font payload drops (three
// families → two) and stays under the §11 120 KB budget — see check:type
// output.
const display = Be_Vietnam_Pro({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-display",
  display: "swap",
});

const sans = Be_Vietnam_Pro({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

// This family renders every IPA transcription in the app (flashcard, dictation,
// pronunciation, landing try-cards), so latin-ext is preloaded on purpose —
// that is the subset the phonetic glyphs live in. JetBrains Mono was missing 14
// of them, which is why a transcription used to mix two fonts mid-line.
const mono = Noto_Sans_Mono({
  subsets: ["latin", "latin-ext", "vietnamese"],
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
  appleWebApp: {
    capable: true,
    title: "Atelier",
    // "default" (opaque status bar), not "black-translucent": translucent
    // pulls page content underneath the status bar, and the current layout
    // does not compensate for that overlap yet. Revisit once Plan 3 ships a
    // real --safe-t app shell.
    statusBarStyle: "default",
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

// Next 14.2: theme-color belongs in the viewport export, not metadata — but
// NOT as `themeColor` here. That field can only express the OS's
// prefers-color-scheme via `media` queries; it can't express an in-app theme
// choice (someone who picked dark in Settings on an OS set to light would
// still get a light status bar). The single <meta name="theme-color"> tag
// rendered in <head> below is the one source of truth instead, kept in sync
// with `data-theme` by the boot script and theme-provider.tsx.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Without viewport-fit=cover every env(safe-area-inset-*) resolves to 0 on
  // iOS, which silently disables the notch and home-bar padding that nav.tsx,
  // auth-gate.tsx and pwa-install.tsx already ask for.
  viewportFit: "cover",
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
        {/* Owns the theme-color the boot script (and later theme-provider.tsx)
            mutates in place via querySelector — see the script below. Must
            render BEFORE that script so the query never comes up empty on
            first paint. Default is the light --bg-canvas-solid token
            (--p-lav-50, src/styles/tokens.css). */}
        <meta name="theme-color" content="#F5F7FF" />
        {/* Prevent FOUC: set theme (data-theme attribute + theme-color meta) +
            lang before paint, and capture the install prompt before React
            mounts. The data-theme/theme-color logic here is inlined (this is
            a plain string, dangerouslySetInnerHTML, so it can't import
            anything) and duplicated by hand in applyThemeColorMeta() /
            ThemeProvider.set() in src/components/theme-provider.tsx — keep
            both in sync if either changes.

            The beforeinstallprompt capture is deliberately OUTSIDE any try —
            it must not be skipped — but everything that touches localStorage is
            inside one. A stray `var l2=localStorage.getItem('lang')` used to sit
            unguarded between them; in Safari private browsing, or anywhere
            storage access is blocked, it threw and took window.__bip and the
            listener down with it, silently disabling the PWA install button for
            exactly the users most likely to have storage restricted. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');var m=window.matchMedia('(prefers-color-scheme: dark)').matches;var d=t==='dark'||(!t&&m);document.documentElement.setAttribute('data-theme',d?'dark':'light');var mc=document.querySelector('meta[name="theme-color"]');if(mc&&d){mc.content='#0A0E22'}}catch(e){}try{var l=localStorage.getItem('lang');if(l){document.documentElement.lang=l}}catch(e){}window.__bip=null;addEventListener('beforeinstallprompt',function(e){e.preventDefault();window.__bip=e})})();`,
          }}
        />
      </head>
      <body className="font-sans antialiased">
        <ThemeProvider>
          <I18nProvider>
            <Providers>
              <ProgressBar />
              <Nav />
              <div>{children}</div>
              <SwRegister />
              <PwaInstall />
            </Providers>
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
