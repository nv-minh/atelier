"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useI18n } from "@/components/i18n-provider";
import { useAchievementToasts } from "@/components/gamification/achievement-toast";
import { initialSessionState, reduceSession, sessionSummary } from "@/lib/practice/session-state";
import { gradeAnswer } from "@/lib/practice/grading";
import { RATING } from "@/lib/practice/types";
import type { GradeSignals, PracticeItem, PracticeMode } from "@/lib/practice/types";
import { SessionSummary } from "./session-summary";
import { MODE_VIEWS } from "./modes";

// How long the answer stays revealed before auto-advancing. This is a LAZY PATH,
// not a lock: any pointer or key input advances immediately (defect D4).
const REVEAL_MS = 1200;

// Only flashcard requeues an Again card inside the same run — that is its
// learning-step behaviour. The auto-graded modes move on, as they do today.
const REQUEUE_ON_AGAIN: Record<PracticeMode, boolean> = {
  flashcard: true,
  quiz: false,
  typing: false,
  dictation: false,
  cloze: false,
  "image-word": false,
};

type PendingPost = { cardId: string; rating: number; correct: boolean };

export function PracticeShell({
  items,
  mode,
  remaining,
  direction,
}: {
  items: PracticeItem[];
  mode: PracticeMode;
  remaining: { due: number; new: number };
  // Forwarded to the mode view. Only flashcard reads it (Task 7); quiz, typing
  // and dictation ignore it. Declared here from the start so Task 7 does not have
  // to reopen the shell.
  direction?: "forward" | "reverse" | "cloze";
}) {
  const { t } = useI18n();
  const { push: pushToast, toaster } = useAchievementToasts();
  const [state, dispatch] = useReducer(reduceSession, initialSessionState);

  const [queue, setQueue] = useState<PracticeItem[]>(items);
  const [extra, setExtra] = useState<PracticeItem[]>([]);
  const [reveal, setReveal] = useState<"hidden" | "correct" | "wrong">("hidden");
  const [xpGained, setXpGained] = useState(0);
  const [unsaved, setUnsaved] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const sessionIdRef = useRef<string | null>(null);
  const startedAtRef = useRef(Date.now());
  const endedRef = useRef(false);
  const pendingRef = useRef<PendingPost | null>(null);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipCountRef = useRef<Map<string, number>>(new Map());
  // Was the tab hidden at any point during the CURRENT item? A phone call or an
  // app switch makes elapsedMs meaningless, so grading must not read it as fast.
  const hiddenRef = useRef(false);

  const current: PracticeItem | undefined = queue[state.index];
  const View = MODE_VIEWS[mode];

  // ---- session row (defect D1: quiz/typing/dictation never created one) ----
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/study/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode }),
        });
        const d = await res.json();
        if (!cancelled && d?.sessionId) {
          sessionIdRef.current = d.sessionId;
          startedAtRef.current = Date.now();
        }
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, [mode]);

  // ---- reset the per-item hidden flag whenever the item changes ----
  useEffect(() => {
    hiddenRef.current = false;
  }, [current?.cardId]);

  useEffect(() => {
    const h = () => {
      if (document.visibilityState === "hidden") hiddenRef.current = true;
    };
    document.addEventListener("visibilitychange", h);
    return () => document.removeEventListener("visibilitychange", h);
  }, []);

  // ---- review POST, one retry, then surfaced rather than swallowed ----
  const postReview = useCallback(
    async (p: PendingPost, keepalive = false) => {
      const send = () =>
        fetch("/api/study/review", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(p),
          keepalive,
        });
      try {
        const res = await send();
        if (!res.ok) throw new Error(String(res.status));
        const d = await res.json().catch(() => null);
        if (d) {
          if (typeof d.xpGained === "number") setXpGained((x) => x + d.xpGained);
          if (Array.isArray(d.unlocked) && d.unlocked.length) pushToast(d.unlocked);
        }
      } catch {
        try {
          const retry = await send();
          if (!retry.ok) throw new Error(String(retry.status));
        } catch {
          setUnsaved((n) => n + 1);
        }
      }
    },
    [pushToast]
  );

  // ---- advance: commit the pending review and move on ----
  const advance = useCallback(() => {
    if (advanceTimer.current) {
      clearTimeout(advanceTimer.current);
      advanceTimer.current = null;
    }
    const p = pendingRef.current;
    pendingRef.current = null;
    if (p) void postReview(p);
    setReveal("hidden");
    setNotice(null);
    dispatch({ type: "commit" });
  }, [postReview]);

  const onAnswer = useCallback(
    (r: { correct: boolean; signals: GradeSignals }) => {
      if (!current || pendingRef.current) return;
      const rating = gradeAnswer(mode, {
        ...r.signals,
        wasHidden: r.signals.wasHidden || hiddenRef.current,
      });
      pendingRef.current = { cardId: current.cardId, rating, correct: r.correct };
      dispatch({
        type: "answer",
        result: {
          cardId: current.cardId,
          wordId: current.wordId,
          word: current.word,
          correct: r.correct,
          rating,
        },
      });
      setReveal(r.correct ? "correct" : "wrong");
      if (rating === RATING.Again && REQUEUE_ON_AGAIN[mode]) {
        setExtra((e) => [...e, current]);
      }
      advanceTimer.current = setTimeout(advance, REVEAL_MS);
    },
    [current, mode, advance]
  );

  // ---- skip (defect D6): first failure retries at the end, second drops it ----
  const onSkip = useCallback(
    (reason: string) => {
      if (!current) return;
      if (process.env.NODE_ENV !== "production") console.warn("[practice] skip:", reason);
      const seen = (skipCountRef.current.get(current.cardId) ?? 0) + 1;
      skipCountRef.current.set(current.cardId, seen);
      if (seen === 1) setExtra((e) => [...e, current]);
      pendingRef.current = null;
      setNotice(t("practice.itemSkipped"));
      setReveal("hidden");
      dispatch({ type: "skip", cardId: current.cardId });
    },
    [current, t]
  );

  // ---- tap or key advances immediately while an answer is revealed (D4) ----
  useEffect(() => {
    if (reveal === "hidden") return;
    const h = () => advance();
    window.addEventListener("pointerdown", h);
    window.addEventListener("keydown", h);
    return () => {
      window.removeEventListener("pointerdown", h);
      window.removeEventListener("keydown", h);
    };
  }, [reveal, advance]);

  // ---- flush a pending review if the tab goes away mid-reveal ----
  useEffect(() => {
    const h = () => {
      const p = pendingRef.current;
      if (!p) return;
      pendingRef.current = null;
      void postReview(p, true);
    };
    window.addEventListener("pagehide", h);
    return () => window.removeEventListener("pagehide", h);
  }, [postReview]);

  // ---- completion: drain requeued/retried items, then end the session ----
  useEffect(() => {
    if (done || state.index < queue.length) return;
    if (extra.length > 0) {
      setQueue((q) => [...q, ...extra]);
      setExtra([]);
      return;
    }
    if (endedRef.current) return;
    endedRef.current = true;
    setDone(true);

    const sid = sessionIdRef.current;
    if (!sid) return;
    const sum = sessionSummary(state);
    fetch("/api/study/session", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: sid,
        cardsReviewed: sum.total,
        correctCount: sum.correct,
        durationSec: Math.round((Date.now() - startedAtRef.current) / 1000),
      }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d && Array.isArray(d.unlocked) && d.unlocked.length) pushToast(d.unlocked);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.index, queue.length, extra, done]);

  if (done) {
    return (
      <>
        {toaster}
        <SessionSummary
          data={sessionSummary(state)}
          remaining={remaining}
          durationSec={Math.round((Date.now() - startedAtRef.current) / 1000)}
          xpGained={xpGained}
          unsaved={unsaved}
        />
      </>
    );
  }

  if (!current || !View) return <>{toaster}</>;

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col">
      {toaster}

      <div className="sticky top-16 z-30 bg-paper/80 backdrop-blur-md border-b border-line">
        <div className="shell py-2.5 flex items-center gap-3">
          <span className="text-xs text-soft tabular-nums whitespace-nowrap">
            {state.index + 1} <span className="opacity-50">/ {queue.length}</span>
          </span>
          <div className="flex-1 h-1.5 rounded-full bg-ink/10 overflow-hidden">
            <motion.div
              className="h-full bg-cefr-b2 rounded-full"
              animate={{ width: `${(state.index / Math.max(queue.length, 1)) * 100}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
          <span className="text-xs font-mono text-soft">
            {sessionSummary(state).correct}/{state.results.length}
          </span>
        </div>
      </div>

      <div className="shell flex-1 flex flex-col justify-center py-6 sm:py-10 pb-28 md:pb-10">
        {notice && <p className="text-center text-xs text-soft mb-4">{notice}</p>}
        <AnimatePresence mode="wait">
          <motion.div
            key={`${current.cardId}-${state.index}`}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.2 }}
          >
            <View
              item={current}
              reveal={reveal}
              onAnswer={onAnswer}
              onSkip={onSkip}
              direction={direction}
            />
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
