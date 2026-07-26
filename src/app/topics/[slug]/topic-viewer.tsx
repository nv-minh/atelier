"use client";

import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import Link from "next/link";
import { ArrowLeft, ChevronLeft, ChevronRight, RefreshCw, Eye, Shuffle } from "lucide-react";
import { Flashcard, type Card } from "@/components/study/flashcard";
import { useI18n } from "@/components/i18n-provider";
import type { Topic } from "@/lib/topic-taxonomy";
import type { TopicWord } from "@/lib/topics-data";

export function TopicViewer({
  topic,
  words,
  total,
}: {
  topic: Topic;
  words: TopicWord[];
  total: number;
}) {
  const { t } = useI18n();
  const [order, setOrder] = useState(() => words.map((_, i) => i));
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [seen, setSeen] = useState(0);

  if (words.length === 0) {
    return (
      <main className="shell py-20 text-center">
        <div className="text-4xl mb-4">{topic.emoji}</div>
        <h1 className="display text-display-md mb-3">{t(`topics.names.${topic.slug}`)}</h1>
        <p className="text-soft mb-8">{t("topics.empty")}</p>
        <Link href="/topics" className="inline-flex items-center gap-1.5 text-sm text-soft hover:text-ink">
          <ArrowLeft size={15} /> {t("topics.topicsBack")}
        </Link>
      </main>
    );
  }

  const current = words[order[index]];

  const next = useCallback(() => {
    setFlipped(false);
    setTimeout(() => {
      setIndex((i) => (i + 1) % order.length);
      setSeen((s) => Math.min(order.length, s + 1));
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
  };

  // Keyboard nav
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        setFlipped((f) => !f);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [next, prev]);

  const card: Card = {
    cardId: current.id,
    id: current.id,
    word: current.word,
    cefr: current.cefr,
    typeEn: current.typeEn,
    typeVi: current.typeVi,
    ipaUk: current.ipaUk,
    ipaUs: current.ipaUs,
    definitionEn: current.definitionEn,
    definitionVi: current.definitionVi,
    extraDefs: [],
    example: current.example,
    exampleVi: current.exampleVi,
    synonyms: current.synonyms,
    antonyms: current.antonyms,
    imageUrl: current.imageUrl,
    audioUk: current.audioUk,
    audioUs: current.audioUs,
  };

  return (
    <main className="shell py-6 sm:py-8 pb-28 md:pb-10 min-h-[calc(100vh-4rem)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-5">
        <Link
          href="/topics"
          className="inline-flex items-center gap-1.5 text-sm text-soft hover:text-ink transition-colors"
        >
          <ArrowLeft size={15} /> {t("topics.topicsBack")}
        </Link>
        <div className="flex items-center gap-3">
          <span className="pill text-soft">
            <span className="h-1.5 w-1.5 rounded-full bg-cefr-a2" /> {t("topics.practiceTag")}
          </span>
          <button
            onClick={shuffle}
            className="inline-flex items-center gap-1.5 text-sm text-soft hover:text-ink transition-colors"
          >
            <Shuffle size={14} /> {t("topics.shuffle")}
          </button>
        </div>
      </div>

      <div className="mb-6">
        <div className="flex items-baseline gap-3 mb-1">
          <span className="text-4xl">{topic.emoji}</span>
          <h1 className="display text-display-md">{t(`topics.names.${topic.slug}`)}</h1>
        </div>
        <p className="text-soft text-sm">
          {t("topics.nOfTotal", { n: order.length, t: total })} · <span className="italic">{t("topics.practiceNote")}</span>
        </p>
      </div>

      {/* Progress dots */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex-1 h-1 rounded-full bg-ink/10 overflow-hidden">
          <motion.div
            className="h-full bg-ember rounded-full"
            animate={{ width: `${(seen / order.length) * 100}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
        <span className="text-xs font-mono text-soft tabular-nums whitespace-nowrap">
          {index + 1}/{order.length}
        </span>
      </div>

      {/* Card */}
      <div className="flex-1 flex flex-col justify-center max-w-4xl w-full mx-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={current.id}
            initial={{ opacity: 0, y: 16, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.99 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            <Flashcard
              card={card}
              flipped={flipped}
              onFlip={() => setFlipped((f) => !f)}
              previews={[]}
              onRate={() => {}}
              ratingDisabled
            />
          </motion.div>
        </AnimatePresence>

        {/* Nav controls (replaces rating buttons in practice mode) */}
        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            onClick={prev}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-line bg-surface py-3.5 font-medium hover:bg-paper-200/50 transition-colors"
          >
            <ChevronLeft size={18} /> {t("topics.previous")}
          </button>
          <button
            onClick={next}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-ink text-paper py-3.5 font-medium hover:opacity-90 transition-opacity"
          >
            {t("topics.next")} <ChevronRight size={18} />
          </button>
        </div>
        <p className="text-center text-xs text-soft mt-3">
          <kbd className="font-mono">←</kbd> <kbd className="font-mono">→</kbd> {t("topics.keyboardHint")}
        </p>
      </div>
    </main>
  );
}
