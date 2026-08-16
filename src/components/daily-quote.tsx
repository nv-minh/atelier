"use client";

// One quote a day, from ZenQuotes — designed to be ignorable.
//
// The rules that keep it from becoming nagware:
//   • It is never a modal, a toast, or an interstitial. It sits in the page
//     flow and can be dismissed in one tap. On the home page it is placed high
//     enough to actually be read (the point of a daily quote is that the reader
//     sees it), which makes the two rules below load-bearing rather than
//     decorative: nothing about it may shift the page or demand a response.
//   • It renders NOTHING until the text is in hand, then fades in. No skeleton
//     that shifts the layout, no spinner competing for attention.
//   • Any failure — offline, ZenQuotes down, malformed body — is silent: the
//     component simply doesn't appear. A quote is never worth an error state.
//   • Dismissing hides it for the rest of the local day, and the dismissal is
//     checked BEFORE fetching, so a dismissed day costs no request at all.
//   • The day's quote is kept in localStorage: it is fetched once, on the first
//     visit of the day, and every visit after that renders it straight from
//     disk with no network call. A new local day is the only thing that sends
//     us back to /api/quote. Policy lives in lib/quote-prefs.ts.
//   • It is English, like the vocabulary itself, with a speak button — a
//     sentence of real English is study material in this app, not chrome.

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Volume2, VolumeX, X } from "lucide-react";
import { useI18n } from "./i18n-provider";
import { speak, stopSpeaking } from "@/lib/tts";
import { cn } from "@/lib/utils";
import { cardClasses } from "@/lib/ui/card-classes";
import {
  isDismissed,
  recordDismissed,
  readCachedQuote,
  writeCachedQuote,
  type CachedQuote,
} from "@/lib/quote-prefs";

export function DailyQuote({ className }: { className?: string }) {
  const { t } = useI18n();
  const [quote, setQuote] = useState<CachedQuote | null>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (isDismissed()) return;

    // Already fetched today: render it now, touch the network never.
    const cached = readCachedQuote();
    if (cached) {
      setQuote(cached);
      return;
    }

    let alive = true;
    // First visit of the day — fetch at idle so the quote never competes with
    // the page's own data, then keep it for the rest of the day.
    const start = () => {
      fetch("/api/quote")
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (!alive || !data?.text) return;
          setQuote({ text: data.text, author: data.author });
          writeCachedQuote(data);
        })
        .catch(() => {
          /* decoration — stay silent */
        });
    };
    const ric = (window as any).requestIdleCallback as
      | ((cb: () => void, o?: { timeout: number }) => number)
      | undefined;
    const handle = ric ? ric(start, { timeout: 2000 }) : window.setTimeout(start, 600);
    return () => {
      alive = false;
      const cic = (window as any).cancelIdleCallback as ((h: number) => void) | undefined;
      if (ric && cic) cic(handle);
      else window.clearTimeout(handle);
    };
  }, []);

  // Reading the quote aloud is the one part of this card that can fail in a way
  // worth showing: a button that answers a tap with nothing is indistinguishable
  // from a broken one. "playing" comes from the utterance actually starting, and
  // "failed" from it never doing so — see the watchdog in lib/tts.ts.
  const [audio, setAudio] = useState<"idle" | "playing" | "failed">("idle");

  const toggleSpeak = useCallback(() => {
    if (!quote) return;
    if (audio === "playing") {
      stopSpeaking();
      setAudio("idle");
      return;
    }
    setAudio("playing");
    speak(quote.text, {
      rate: 0.88,
      onEnd: () => setAudio("idle"),
      onFail: () => setAudio("failed"),
    });
  }, [audio, quote]);

  // Never leave the page still talking.
  useEffect(() => () => stopSpeaking(), []);

  const dismiss = useCallback(() => {
    stopSpeaking();
    setHidden(true);
    recordDismissed();
  }, []);

  return (
    <AnimatePresence>
      {quote && !hidden && (
        <motion.figure
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6, height: 0, marginBottom: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className={cn(
            cardClasses("flat"),
            "relative px-6 py-7 sm:px-9 sm:py-8 overflow-hidden",
            className
          )}
        >
          {/* oversized quotation mark, same editorial device as the hero "a" */}
          <span
            aria-hidden
            className="pointer-events-none absolute -top-8 right-4 select-none display display-it text-[10rem] leading-none text-fg/[0.045]"
          >
            &rdquo;
          </span>

          <div className="relative">
            <div className="flex items-center gap-2 mb-4">
              <span className="h-px w-6 bg-ember/50" />
              <figcaption className="text-[10px] uppercase tracking-[0.18em] text-fg-muted/80 font-mono">
                {t("quote.label")}
              </figcaption>
            </div>

            <blockquote className="display display-it text-xl sm:text-2xl leading-snug max-w-2xl text-balance">
              {quote.text}
            </blockquote>

            <div className="mt-5 flex items-center justify-between gap-4">
              <cite className="not-italic text-sm text-fg-muted">— {quote.author}</cite>
              {/* data-nosound: the listen button starts its own audio, so the
                  shell's tap tone would just double up on it. */}
              <div className="flex items-center gap-1 shrink-0" data-nosound>
                <button
                  onClick={toggleSpeak}
                  aria-label={audio === "failed" ? t("quote.listenFailed") : t("quote.listen")}
                  title={audio === "failed" ? t("quote.listenFailed") : t("quote.listen")}
                  className={cn(
                    "rounded-full p-2 transition-colors hover:bg-ink/5",
                    audio === "playing" && "text-ember",
                    audio === "failed" && "text-fg-muted/50",
                    audio === "idle" && "text-fg-muted hover:text-ember"
                  )}
                >
                  {audio === "failed" ? (
                    <VolumeX size={15} />
                  ) : (
                    <Volume2 size={15} className={audio === "playing" ? "animate-pulse" : undefined} />
                  )}
                </button>
                <button
                  onClick={dismiss}
                  aria-label={t("quote.dismiss")}
                  title={t("quote.dismiss")}
                  className="rounded-full p-2 text-fg-muted hover:text-fg hover:bg-ink/5 transition-colors"
                >
                  <X size={15} />
                </button>
              </div>
            </div>
          </div>
        </motion.figure>
      )}
    </AnimatePresence>
  );
}
