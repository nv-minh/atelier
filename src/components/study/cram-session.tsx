"use client";

import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import Link from "next/link";
import { ArrowLeft, ChevronLeft, ChevronRight, Shuffle, CheckCircle2, RotateCcw } from "lucide-react";
import { Flashcard, type Card } from "@/components/study/flashcard";
import { useI18n } from "@/components/i18n-provider";

export function CramSession({
  initialCards,
  direction = "forward",
}: {
  initialCards: Card[];
  direction?: "forward" | "reverse" | "cloze";
}) {
  const { t } = useI18n();
  const [order, setOrder] = useState(() => initialCards.map((_, i) => i));
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [seen, setSeen] = useState(0);
  const [againIds, setAgainIds] = useState<Set<string>>(new Set());
  const [done, setDone] = useState(false);

  const current = initialCards[order[index]];

  const next = useCallback(() => {
    setFlipped(false);
    setTimeout(() => {
      setSeen((s) => s + 1);
      setIndex((i) => (i + 1) % order.length);
    }, 120);
  }, [order.length]);

  const prev = useCallback(() => {
    setFlipped(false);
    setTimeout(() => setIndex((i) => (i - 1 + order.length) % order.length), 120);
  }, [order.length]);

  const shuffle = () => {
    setFlipped(false);
    setOrder((o) => {
      const a = [...o];
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    });
    setIndex(0);
    setSeen(0);
    setAgainIds(new Set());
    setDone(false);
  };

  const markAgain = () => {
    if (current) setAgainIds((s) => new Set(s).add(current.cardId));
    next();
  };

  // finish when seen all
  useEffect(() => {
    if (seen >= order.length && !done) setDone(true);
  }, [seen, order.length, done]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (done) return;
      if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        setFlipped((f) => !f);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [next, prev, done]);

  if (done) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-6">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center max-w-md">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200 }}
            className="mx-auto mb-5 grid h-20 w-20 place-items-center rounded-full bg-ember/15 text-ember"
          >
            <CheckCircle2 size={40} strokeWidth={1.5} />
          </motion.div>
          <h2 className="display text-display-md mb-1">{t("study.cramDone")}</h2>
          <p className="text-fg-muted mb-8">
            {t("study.cramSummary", { seen: order.length, again: againIds.size })}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button onClick={() => { setDone(false); shuffle(); }} className="inline-flex items-center justify-center gap-2 rounded-full bg-ink text-paper px-6 py-3 font-medium hover:opacity-90">
              <RotateCcw size={16} /> {t("practice.practiceAgain")}
            </button>
            <a href="/study" className="inline-flex items-center justify-center gap-2 rounded-full border border-hairline/10 px-6 py-3 font-medium hover:bg-paper-200/50">
              {t("study.changeMode")}
            </a>
          </div>
        </motion.div>
      </div>
    );
  }

  const progress = Math.min(100, (seen / order.length) * 100);

  return (
    <main className="shell w-full py-6 sm:py-8 pb-28 md:pb-10 min-h-[calc(100vh-4rem)] flex flex-col">
      <div className="flex items-center justify-between gap-4 mb-5">
        <Link href="/study" className="inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg">
          <ArrowLeft size={15} /> {t("modes.title")}
        </Link>
        <div className="flex items-center gap-3">
          <span className="pill text-fg-muted"><span className="h-1.5 w-1.5 rounded-full bg-ember" /> {t("modes.tagCram")}</span>
          <button onClick={shuffle} className="inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg">
            <Shuffle size={14} /> {t("topics.shuffle")}
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3 mb-6">
        <span className="text-xs font-mono text-fg-muted tabular-nums whitespace-nowrap">
          {Math.min(seen + 1, order.length)}/{order.length}
        </span>
        <div className="flex-1 h-1.5 rounded-full bg-ink/10 overflow-hidden">
          <motion.div className="h-full bg-ember rounded-full" animate={{ width: `${progress}%` }} transition={{ duration: 0.3 }} />
        </div>
      </div>

      <div className="w-full max-w-4xl mx-auto flex-1 flex flex-col justify-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={current.cardId}
            initial={{ opacity: 0, y: 16, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.99 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            <Flashcard
              card={current}
              direction={direction}
              flipped={flipped}
              onFlip={() => setFlipped((f) => !f)}
              previews={[]}
              onRate={() => {}}
              ratingDisabled
            />
          </motion.div>
        </AnimatePresence>

        {/* Cram nav: Prev / Mark review / Next */}
        <div className="mt-6 grid grid-cols-3 gap-3">
          <button onClick={prev} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-hairline/10 bg-surface py-3.5 font-medium hover:bg-paper-200/50">
            <ChevronLeft size={18} /> {t("topics.previous")}
          </button>
          <button onClick={markAgain} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-ember/30 text-ember py-3.5 font-medium hover:bg-ember/5">
            {t("study.cramAgain")}
          </button>
          <button onClick={next} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-ink text-paper py-3.5 font-medium hover:opacity-90">
            {t("topics.next")} <ChevronRight size={18} />
          </button>
        </div>
        <p className="text-center text-xs text-fg-muted mt-3">{t("topics.keyboardHint")}</p>
      </div>
    </main>
  );
}
