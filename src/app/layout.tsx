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

const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  axes: ["opsz", "SOFT", "WONK"],
  style: ["normal", "italic"],
});

const sans = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Atelier — Vocabulary Studio",
  description: "A refined spaced-repetition studio for mastering English vocabulary, A1 to B2.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/favicon.svg",
    apple: "/icons/apple-touch-icon.png",
  },
};

// Next 14.2: theme-color belongs in the viewport export, not metadata.
// Matches the manifest theme_color (Atelier ink #1F1C16).
export const viewport: Viewport = {
  themeColor: "#1F1C16",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning className={`${display.variable} ${sans.variable} ${mono.variable}`}>
      <head>
        {/* Prevent FOUC: set theme + lang before paint */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');var m=window.matchMedia('(prefers-color-scheme: dark)').matches;if(t==='dark'||(!t&&m)){document.documentElement.classList.add('dark')}}catch(e){}})();try{var l=localStorage.getItem('lang');if(l){document.documentElement.lang=l}}catch(e){}var l2=localStorage.getItem('lang');window.__bip=null;addEventListener('beforeinstallprompt',function(e){e.preventDefault();window.__bip=e});`,
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
