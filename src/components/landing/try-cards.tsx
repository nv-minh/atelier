"use client";

// The landing page's thesis: instead of describing spaced repetition, hand the
// visitor the actual card and let them tap it. Three real rows from the word
// table — same image, IPA, definitions and example a signed-in learner sees, on
// the same flip mechanics as /study/flashcard.
//
// The sign-in ask arrives only after the third card, phrased as the thing the
// tapping just created: a bit of progress that needs somewhere to live.

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ArrowRight, RotateCcw } from "lucide-react";
import { CefrBadge } from "@/components/cefr-badge";
import { AudioButton } from "@/components/audio-button";
import { WordImage, isRealImage } from "@/components/word-image";
import { startSignIn, GoogleMark } from "@/components/auth-gate";
import { useI18n } from "@/components/i18n-provider";

export type DemoWord = {
  word: string;
  cefr: string;
  typeVi: string | null;
  ipaUk: string | null;
  definitionEn: string | null;
  definitionVi: string | null;
  example: string | null;
  imageUrl: string | null;
};

export function TryCards({ words }: { words: DemoWord[] }) {
  const { t } = useI18n();
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [done, setDone] = useState(false);

  if (words.length === 0) return null;
  const card = words[Math.min(i, words.length - 1)];
  const last = i >= words.length - 1;

  const advance = () => {
    if (last) {
      setDone(true);
      return;
    }
    setFlipped(false);
    setI((n) => n + 1);
  };

  const restart = () => {
    setDone(false);
    setFlipped(false);
    setI(0);
  };

  return (
    <div className="w-full max-w-md mx-auto lg:mx-0">
      <AnimatePresence mode="wait">
        {done ? (
          <motion.div
            key="done"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="card-atelier p-7 sm:p-9 flex flex-col justify-center"
            style={{ minHeight: "min(58vh, 440px)" }}
          >
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ember mb-4">
              {t("landing.demo.doneLabel")}
            </p>
            <h3 className="display text-3xl sm:text-4xl leading-tight mb-4">
              {t("landing.demo.doneTitle", { n: words.length })}
            </h3>
            <p className="text-soft leading-relaxed mb-8">{t("landing.demo.doneBody")}</p>
            <button
              onClick={() => startSignIn("/")}
              className="w-full inline-flex items-center justify-center gap-2.5 rounded-full bg-ink text-paper px-6 py-3.5 font-medium hover:opacity-90 transition-opacity"
            >
              <GoogleMark />
              {t("landing.ctaPrimary")}
            </button>
            <button
              onClick={restart}
              className="mt-2 inline-flex items-center justify-center gap-1.5 rounded-full px-6 py-2.5 text-sm text-soft hover:text-ink transition-colors"
            >
              <RotateCcw size={13} /> {t("landing.demo.again")}
            </button>
          </motion.div>
        ) : (
          <motion.div
            key="deck"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            <div className="perspective-1000 select-none">
              {/* role=button rather than a real <button>: the card contains the
                  audio control, and a button inside a button is invalid HTML —
                  the browser relocates it and hydration fails. */}
              <motion.div
                role="button"
                tabIndex={0}
                onClick={() => setFlipped((f) => !f)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setFlipped((f) => !f);
                  }
                }}
                aria-label={flipped ? t("landing.demo.tapToHide") : t("landing.demo.tapToReveal")}
                className="relative preserve-3d w-full cursor-pointer rounded-[1.25rem] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember/60 focus-visible:ring-offset-4 focus-visible:ring-offset-paper"
                style={{ minHeight: "min(58vh, 440px)" }}
                animate={{ rotateY: flipped ? 180 : 0 }}
                transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
              >
                <Front card={card} />
                <Back card={card} />
              </motion.div>
            </div>

            {/* Deck position doubles as the progress read-out: the dots are the
                three cards, the mono count is for anyone who wants the number. */}
            <div className="mt-5 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2" aria-hidden>
                {words.map((w, n) => (
                  <span
                    key={w.word}
                    className={
                      n === i
                        ? "h-1.5 w-6 rounded-full bg-ember transition-all"
                        : "h-1.5 w-1.5 rounded-full bg-ink/15 transition-all"
                    }
                  />
                ))}
                <span className="font-mono text-[11px] text-soft/70 ml-2 tabular-nums">
                  {i + 1}/{words.length}
                </span>
              </div>

              <button
                onClick={advance}
                className="group inline-flex items-center gap-1.5 rounded-full border border-line px-4 py-2 text-sm font-medium hover:border-ink/25 hover:bg-paper-200/50 transition-colors"
              >
                {last ? t("landing.demo.finish") : t("landing.demo.next")}
                <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Front({ card }: { card: DemoWord }) {
  const { t } = useI18n();
  return (
    <div className="backface-hidden absolute inset-0 card-atelier p-6 sm:p-8 flex flex-col">
      <div className="flex items-center justify-between">
        <CefrBadge level={card.cefr} />
        {/* stop the tap here so hearing the word doesn't also flip the card */}
        <span onClick={(e) => e.stopPropagation()} role="presentation">
          <AudioButton word={card.word} accent="uk" size="sm" />
        </span>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center text-center gap-4 py-4">
        {isRealImage(card.imageUrl) && (
          <WordImage imageUrl={card.imageUrl} word={card.word} className="!w-auto" maxH="max-h-32" />
        )}
        <div>
          <p className="display text-4xl sm:text-5xl leading-none">{card.word}</p>
          {card.ipaUk && (
            <p className="font-mono text-sm text-soft mt-2.5">{card.ipaUk}</p>
          )}
        </div>
      </div>

      <p className="text-center text-xs text-soft/70">{t("landing.demo.tapToReveal")}</p>
    </div>
  );
}

function Back({ card }: { card: DemoWord }) {
  const { t } = useI18n();
  return (
    <div className="backface-hidden rotate-y-180 absolute inset-0 card-atelier p-6 sm:p-8 flex flex-col overflow-y-auto scrollbar-hide">
      <div className="flex items-baseline justify-between gap-3">
        <p className="display text-2xl">{card.word}</p>
        {card.typeVi && <span className="text-xs text-soft shrink-0">{card.typeVi}</span>}
      </div>

      <div className="flex-1 flex flex-col justify-center gap-4 py-5">
        {card.definitionVi && (
          <p className="display text-2xl sm:text-[1.75rem] leading-snug">{card.definitionVi}</p>
        )}
        {card.definitionEn && (
          <p className="text-sm text-soft leading-relaxed">{card.definitionEn}</p>
        )}
        {card.example && (
          <p className="text-sm leading-relaxed border-l-2 border-ember/40 pl-3.5 text-soft">
            <span className="font-mono text-[10px] uppercase tracking-wider text-soft/60 block mb-1">
              {t("landing.demo.example")}
            </span>
            {card.example}
          </p>
        )}
      </div>

      <p className="text-center text-xs text-soft/70">{t("landing.demo.tapToHide")}</p>
    </div>
  );
}
