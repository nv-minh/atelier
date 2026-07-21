"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { CheckCircle2, X, Flame, Layers, RotateCcw } from "lucide-react";
import { Flashcard, type Card } from "./flashcard";
import type { RatingPreview } from "./rating-buttons";
import { getRatingPreviewsClient } from "./preview-client";
import { useI18n } from "@/components/i18n-provider";

type QueueItem = Card & {
  isNew: boolean;
  state: number;
  reps: number;
  lapses: number;
  stability: number;
  difficulty: number;
  due: string;
  elapsedDays: number;
  scheduledDays: number;
  lastReview: string | null;
};

export function StudySession({ initialQueue, direction = "forward" }: { initialQueue: QueueItem[]; direction?: "forward" | "reverse" | "cloze" }) {
  const { t } = useI18n();
  const [queue, setQueue] = useState<QueueItem[]>(initialQueue);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [done, setDone] = useState(false);
  const [reviewed, setReviewed] = useState(0);
  const [againQueue, setAgainQueue] = useState<QueueItem[]>([]);
  const [previews, setPreviews] = useState<RatingPreview[]>([]);
  const [reviewing, setReviewing] = useState(false);

  // session tracking
  const sessionIdRef = useRef<string | null>(null);
  const startTimeRef = useRef<number>(Date.now());
  const [counts, setCounts] = useState({ 1: 0, 2: 0, 3: 0, 4: 0 });
  const [typeCounts, setTypeCounts] = useState({ new: 0, review: 0 });

  const current = queue[index];

  useEffect(() => {
    if (!current) return;
    setPreviews(getRatingPreviewsClient(current));
  }, [current]);

  // start a session record once
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/study/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: "flashcard" }),
        });
        const d = await res.json();
        sessionIdRef.current = d.sessionId;
        startTimeRef.current = Date.now();
      } catch {}
    })();
  }, []);

  const submitRating = useCallback(
    async (rating: number) => {
      if (!current || reviewing) return;
      setReviewing(true);
      try {
        await fetch("/api/study/review", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cardId: current.cardId, rating }),
        });
      } catch {}

      setReviewed((r) => r + 1);
      setCounts((c) => ({ ...c, [rating]: c[rating as 1 | 2 | 3 | 4] + 1 }));
      setTypeCounts((tc) =>
        current.isNew ? { ...tc, new: tc.new + 1 } : { ...tc, review: tc.review + 1 }
      );
      setFlipped(false);

      // If "Again", requeue the card at the end
      if (rating === 1) {
        setAgainQueue((q) => [...q, current]);
      }

      // advance
      setTimeout(() => {
        setReviewing(false);
        setIndex((i) => i + 1);
      }, 180);
    },
    [current, reviewing]
  );

  const flip = useCallback(() => setFlipped((f) => !f), []);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (done) return;
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        if (!flipped) flip();
        return;
      }
      if (!flipped) return;
      if (["1", "2", "3", "4"].includes(e.key)) {
        submitRating(Number(e.key));
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [flipped, submitRating, done]);

  // Completion: when we run out of primary queue, drain the again-queue
  useEffect(() => {
    if (index >= queue.length) {
      if (againQueue.length > 0) {
        setQueue((q) => [...q, ...againQueue]);
        setAgainQueue([]);
      } else {
        setDone(true);
        // record session end
        const sid = sessionIdRef.current;
        if (sid) {
          const durationSec = Math.round((Date.now() - startTimeRef.current) / 1000);
          const correct = counts[3] + counts[4];
          fetch("/api/study/session", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionId: sid, cardsReviewed: reviewed, correctCount: correct, durationSec }),
          }).catch(() => {});
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, queue.length, againQueue]);

  const restart = () => {
    setIndex(0);
    setDone(false);
    setReviewed(0);
    setAgainQueue([]);
    setFlipped(false);
    // reload fresh queue
    window.location.reload();
  };

  if (done) {
    return (
      <CompleteScreen
        count={reviewed}
        counts={counts}
        typeCounts={typeCounts}
        durationSec={Math.round((Date.now() - startTimeRef.current) / 1000)}
        onRestart={restart}
      />
    );
  }

  if (!current) {
    return <EmptyState onRestart={restart} />;
  }

  const progress = Math.min(100, (index / Math.max(queue.length, 1)) * 100);

  return (
    <div className="min-h-[calc(100vh-4rem)] md:min-h-[calc(100vh-4rem)] flex flex-col">
      {/* Progress bar */}
      <div className="sticky top-16 z-30 bg-paper/80 backdrop-blur-md border-b border-line">
        <div className="shell py-2.5 flex items-center gap-3">
          <span className="text-xs text-soft tabular-nums whitespace-nowrap">
            {index + 1} <span className="opacity-50">/ {queue.length}</span>
          </span>
          <div className="flex-1 h-1.5 rounded-full bg-ink/10 overflow-hidden">
            <motion.div
              className="h-full bg-ember rounded-full"
              animate={{ width: `${progress}%` }}
              transition={{ ease: "easeOut", duration: 0.3 }}
            />
          </div>
          {current.isNew && (
            <span className="pill text-cefr-a2 border-cefr-a2/30 bg-cefr-a2/10">{t("common.new")}</span>
          )}
        </div>
      </div>

      <div className="shell w-full flex-1 flex flex-col justify-center py-6 sm:py-10 pb-28 md:pb-10">
        <div className="w-full max-w-4xl mx-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={current.cardId}
            initial={{ opacity: 0, y: 16, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.99 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          >
            <Flashcard
              card={current}
              direction={direction}
              flipped={flipped}
              onFlip={flip}
              previews={previews}
              onRate={submitRating}
              ratingDisabled={reviewing}
            />
          </motion.div>
        </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function CompleteScreen({
  count,
  counts,
  typeCounts,
  durationSec,
  onRestart,
}: {
  count: number;
  counts: { 1: number; 2: number; 3: number; 4: number };
  typeCounts: { new: number; review: number };
  durationSec: number;
  onRestart: () => void;
}) {
  const { t } = useI18n();
  const correct = counts[3] + counts[4];
  const accuracy = count > 0 ? Math.round((correct / count) * 100) : 0;
  const mm = String(Math.floor(durationSec / 60)).padStart(2, "0");
  const ss = String(durationSec % 60).padStart(2, "0");
  const rows = [
    { label: t("study.again"), n: counts[1], color: "text-red-400", dot: "bg-red-400" },
    { label: t("study.hard"), n: counts[2], color: "text-ember", dot: "bg-ember-400" },
    { label: t("study.good"), n: counts[3], color: "text-moss-500", dot: "bg-moss-500" },
    { label: t("study.easy"), n: counts[4], color: "text-cefr-a2", dot: "bg-cefr-a2" },
  ];
  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-6 py-10">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md"
      >
        <motion.div
          initial={{ scale: 0, rotate: -30 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ delay: 0.1, type: "spring", stiffness: 200 }}
          className="mx-auto mb-5 grid h-20 w-20 place-items-center rounded-full bg-moss-500/15 text-moss-500"
        >
          <CheckCircle2 size={40} strokeWidth={1.5} />
        </motion.div>
        <h2 className="display text-display-md mb-1 text-center">{t("study.sessionComplete")}</h2>
        <p className="text-soft text-center mb-6">{t("study.youReviewed", { n: count })}</p>

        {/* headline stats */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="card-atelier p-4 text-center">
            <p className="display text-2xl text-moss-500 tabular-nums">{accuracy}%</p>
            <p className="text-[10px] uppercase tracking-wide text-soft">{t("study.accLabel")}</p>
          </div>
          <div className="card-atelier p-4 text-center">
            <p className="display text-2xl tabular-nums">{mm}:{ss}</p>
            <p className="text-[10px] uppercase tracking-wide text-soft">{t("study.timeLabel")}</p>
          </div>
          <div className="card-atelier p-4 text-center">
            <p className="display text-2xl tabular-nums">{typeCounts.new}</p>
            <p className="text-[10px] uppercase tracking-wide text-soft">{t("study.newLabel")}</p>
          </div>
        </div>

        {/* rating breakdown */}
        <div className="card-atelier p-5 mb-6">
          <p className="text-[11px] uppercase tracking-wider text-soft font-semibold mb-3">{t("study.breakdown")}</p>
          <div className="space-y-2.5">
            {rows.map((r) => {
              const pct = count > 0 ? (r.n / count) * 100 : 0;
              return (
                <div key={r.label} className="flex items-center gap-3">
                  <span className="flex items-center gap-2 w-16 shrink-0">
                    <span className={`h-2 w-2 rounded-full ${r.dot}`} />
                    <span className="text-sm">{r.label}</span>
                  </span>
                  <div className="flex-1 h-2 rounded-full bg-ink/8 overflow-hidden">
                    <motion.div className={`h-full ${r.dot}`} initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ delay: 0.2, duration: 0.5 }} />
                  </div>
                  <span className={`text-sm font-semibold tabular-nums w-6 text-right ${r.color}`}>{r.n}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={onRestart}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-ink text-paper px-6 py-3 font-medium hover:opacity-90"
          >
            <RotateCcw size={16} /> {t("study.studyMore")}
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center gap-2 rounded-full border border-line px-6 py-3 font-medium hover:bg-paper-200/50"
          >
            {t("study.backToStudio")}
          </a>
        </div>
      </motion.div>
    </div>
  );
}

function EmptyState({ onRestart }: { onRestart: () => void }) {
  const { t } = useI18n();
  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-6">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="text-center max-w-md">
        <div className="mx-auto mb-6 grid h-20 w-20 place-items-center rounded-full bg-ember/15 text-ember">
          <Flame size={36} strokeWidth={1.5} />
        </div>
        <h2 className="display text-display-md mb-2">{t("study.allCaughtUp")}</h2>
        <p className="text-soft mb-8">{t("study.noCardsDue")}</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <a
            href="/study"
            className="inline-flex items-center justify-center gap-2 rounded-full border border-line px-6 py-3 font-medium hover:bg-paper-200/50"
          >
            <Layers size={16} /> {t("study.changeMode")}
          </a>
          <a
            href="/"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-ink text-paper px-6 py-3 font-medium hover:opacity-90"
          >
            {t("study.backToStudio")}
          </a>
        </div>
      </motion.div>
    </div>
  );
}
