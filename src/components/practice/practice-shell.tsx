"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useI18n } from "@/components/i18n-provider";
import { useAchievementToasts } from "@/components/gamification/achievement-toast";
import { initialSessionState, reduceSession, sessionSummary } from "@/lib/practice/session-state";
import { gradeAnswer } from "@/lib/practice/grading";
import { RATING } from "@/lib/practice/types";
import type { GradeSignals, PracticeItem, PracticeMode } from "@/lib/practice/types";
import { SessionSummary } from "./session-summary";
import { MODE_VIEWS } from "./modes";
import { playSound } from "@/lib/sound";
import { vibrate } from "@/lib/haptics";
import { recordSessionDone } from "@/lib/pwa-prefs";

// How long the answer stays revealed before auto-advancing, per mode. This is a
// LAZY PATH, not a lock: any pointer or key input advances immediately (D4).
// Flashcard is short (180ms): the card is already flipped and there is nothing
// new to read, so a long pause just reads as a frozen UI. The auto-graded modes
// keep 1200ms so the correct answer + FeedbackStrip stay readable.
const REVEAL_MS: Record<PracticeMode, number> = {
  flashcard: 180,
  quiz: 1200,
  typing: 1200,
  dictation: 1200,
  // Not yet implemented (Plan 3); filled so the Record is exhaustive.
  cloze: 1200,
  "image-word": 1200,
};

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

type PendingPost = { cardId: string; rating: number; correct: boolean; idempotencyKey: string };

// One key per answered card, sent with every attempt (including the retry).
// The server dedupes on it (ReviewLog.idempotencyKey is unique), so a
// network-retried submit can't double-advance the card or double-award XP.
// crypto.randomUUID needs a secure context; every deployed origin is HTTPS, and
// the Math.random fallback only matters for the odd non-secure local dev URL.
function newIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

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
  const router = useRouter();
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
  // Guards against Strict Mode's dev-only double-invoke of the mount effect
  // below, which would otherwise POST /api/study/session twice per real mount
  // and leave an orphaned StudySession row (0 cards, no endedAt).
  const sessionStartedRef = useRef(false);
  // Was the tab hidden at any point during the CURRENT item? A phone call or an
  // app switch makes elapsedMs meaningless, so grading must not read it as fast.
  const hiddenRef = useRef(false);

  const current: PracticeItem | undefined = queue[state.index];
  const View = MODE_VIEWS[mode];

  // ---- session row (defect D1: quiz/typing/dictation never created one) ----
  // sessionStartedRef alone guarantees at most one POST per mounted shell, even
  // under Strict Mode's dev-only double-invoke (the ref persists across that
  // synthetic unmount+remount, so invocation #2 returns early before starting
  // its own request). There is deliberately no `cancelled` flag any more: a
  // `cancelled` guard on the response handler used to combine with this ref in
  // a way that meant the ONE POST that ever fired had its own response ignored
  // (invocation #1's cleanup — fired by Strict Mode's synthetic unmount — set
  // `cancelled = true` before invocation #1's fetch resolved, since invocation
  // #2 short-circuited and never created its own `cancelled = false`). That
  // left `sessionIdRef.current` permanently null in dev, so the completion
  // PATCH below could never fire. Writing these refs after a genuine unmount
  // is harmless — they are refs, not state, so there is nothing to warn about
  // and nothing observable happens.
  useEffect(() => {
    if (sessionStartedRef.current) return;
    sessionStartedRef.current = true;
    (async () => {
      try {
        const res = await fetch("/api/study/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode }),
        });
        const d = await res.json();
        if (d?.sessionId) {
          sessionIdRef.current = d.sessionId;
          startedAtRef.current = Date.now();
        }
      } catch {}
    })();
  }, [mode]);

  // ---- reset the per-item hidden flag whenever the item changes ----
  // Keyed on state.index, NOT current?.cardId: flashcard requeues the same
  // cardId later in the same run (Again), so keying on cardId would leave a
  // stale wasHidden flag from the FIRST attempt attached to the retry.
  useEffect(() => {
    hiddenRef.current = false;
  }, [state.index]);

  useEffect(() => {
    const h = () => {
      if (document.visibilityState === "hidden") hiddenRef.current = true;
    };
    document.addEventListener("visibilitychange", h);
    return () => document.removeEventListener("visibilitychange", h);
  }, []);

  // ---- review POST, one retry, then surfaced rather than swallowed ----
  // `apply` is shared by the first attempt AND the retry so a retry that
  // succeeds still feeds its xpGained/unlocked through — a successful retry
  // must not be worse than a normal success (spec §11: never silently drop).
  const postReview = useCallback(
    async (p: PendingPost, keepalive = false) => {
      const send = () =>
        fetch("/api/study/review", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(p),
          keepalive,
        });
      const apply = async (res: Response) => {
        if (!res.ok) throw new Error(String(res.status));
        const d = await res.json().catch(() => null);
        if (d) {
          if (typeof d.xpGained === "number") setXpGained((x) => x + d.xpGained);
          if (Array.isArray(d.unlocked) && d.unlocked.length) pushToast(d.unlocked);
        }
      };
      try {
        await apply(await send());
      } catch {
        try {
          await apply(await send());
        } catch {
          setUnsaved((n) => n + 1);
        }
      }
    },
    [pushToast]
  );

  // ---- advance: commit the pending review and move on ----
  // Idempotency guard: two advance() calls landing in the same task (a
  // two-finger tap during the reveal, or a tap that lands in the same frame
  // as the REVEAL_MS timeout) must only commit ONCE. The reducer intentionally
  // allows commit-with-no-pending (see session-state.ts), so without this guard
  // a second same-frame call silently skips a card — it never renders, and is
  // recorded in neither `results` nor `skipped`.
  //
  // advancedAtRef remembers which index was last committed. state.index MUST
  // be a dependency here: both calls in a same-frame double-fire share the
  // SAME `advance` closure (attached once by the reveal-advance effect below),
  // so the ref-vs-index comparison only works if that closure's `state.index`
  // is the value current at the time the listener was attached. Leaving
  // state.index out of the deps would freeze `advance` on a stale index after
  // the first render, and reveal/index update in the same batch (setReveal and
  // dispatch({type:"commit"}) below run together), so the reveal-advance
  // effect below only ever re-attaches its listener while reveal is "hidden" —
  // i.e. never mid-reveal — so this extra dependency does not cause a second
  // listener to be attached while one is already live.
  const advancedAtRef = useRef(-1);
  const advance = useCallback(() => {
    if (advancedAtRef.current === state.index) return;
    advancedAtRef.current = state.index;
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
  }, [postReview, state.index]);

  const onAnswer = useCallback(
    (r: { correct: boolean; signals: GradeSignals }) => {
      if (!current || pendingRef.current) return;
      const rating = gradeAnswer(mode, {
        ...r.signals,
        wasHidden: r.signals.wasHidden || hiddenRef.current,
      });
      pendingRef.current = {
        cardId: current.cardId,
        rating,
        correct: r.correct,
        idempotencyKey: newIdempotencyKey(),
      };
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
      // One wiring point covers all four modes: every mode reports its result
      // through onAnswer (the shell↔mode contract, practice-modes spec §4).
      if (r.correct) {
        playSound("correct");
        vibrate(10);
      } else {
        playSound("wrong");
        vibrate([20, 40, 20]);
      }
      if (rating === RATING.Again && REQUEUE_ON_AGAIN[mode]) {
        setExtra((e) => [...e, current]);
      }
      advanceTimer.current = setTimeout(advance, REVEAL_MS[mode]);
    },
    [current, mode, advance]
  );

  // ---- exit: the only way out of a session on a phone ----
  // During a session the app chrome is gone: the header is opacity-0, the
  // bottom tab bar slides away, and StandaloneBack deliberately returns null
  // under /study/*. In a standalone PWA there is no browser back either, so
  // without this button the user is trapped until the queue runs dry. Spec
  // §8.2 asks for a confirm sheet after >3 answered cards; window.confirm is
  // the hotfix stand-in — the real sheet lands with the Plan 5 session shell.
  const onExit = useCallback(() => {
    if (state.results.length > 3 && !window.confirm(t("practice.exitConfirm", { n: state.results.length }))) return;
    router.push("/study");
  }, [state.results.length, t, router]);

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
  // Target filter: genuinely interactive controls (audio buttons, dictation's
  // replay/speed buttons, typing/dictation's `disabled`-locked input) must
  // handle their own click and NOT also advance the card — without this,
  // tapping typing/dictation's answer-audio buttons (which render ONLY during
  // the reveal) plays audio and instantly advances past the answer the user
  // just tapped to hear. `closest()` matches any
  // <button>/<a>/<input>/<textarea>/<select>/[role=button], so a future
  // in-reveal control (e.g. a rating-adjust chip) needs no stopPropagation of
  // its own by construction — but the match is only honoured when that
  // control is not `aria-disabled` (see below): quiz's revealed answer
  // options are `<button>`s too, yet must still advance on tap/key.
  //
  // e.repeat filter: a held Enter/Space auto-repeats keydown, so without this
  // a user holding the submit key never sees the reveal at all.
  useEffect(() => {
    if (reveal === "hidden") return;
    const h = (e: Event) => {
      if (e instanceof KeyboardEvent && e.repeat) return;
      const el = e.target;
      const control =
        el instanceof Element ? el.closest("button,a,input,textarea,select,[role='button']") : null;
      // A matched control only earns the exemption if it is actually
      // interactive. `aria-disabled="true"` is quiz's revealed-option state
      // (it deliberately avoids the `disabled` attribute so the option still
      // emits pointerdown — see the comment on that button) and is inert by
      // contract, so tapping/keying it should fall through and advance, same
      // as tapping empty space. Do NOT also gate on `disabled` here: a truly
      // `disabled` control emits no pointerdown at all, and can never hold
      // focus, so it can never be `e.target` for a keydown either — there is
      // no path through which one could reach this handler as `control`.
      if (control && control.getAttribute("aria-disabled") !== "true") {
        return;
      }
      advance();
    };
    window.addEventListener("pointerdown", h);
    window.addEventListener("keydown", h);
    return () => {
      window.removeEventListener("pointerdown", h);
      window.removeEventListener("keydown", h);
    };
  }, [reveal, advance]);

  // ---- flush a pending review rather than lose it: shared by the tab-close
  // path (pagehide) and the in-app-navigation path (unmount) below. Clears
  // pendingRef BEFORE sending, same as advance(), so neither path can double-send.
  const flushPending = useCallback(() => {
    const p = pendingRef.current;
    if (!p) return;
    pendingRef.current = null;
    void postReview(p, true);
  }, [postReview]);

  // ---- flush a pending review if the tab goes away mid-reveal ----
  useEffect(() => {
    window.addEventListener("pagehide", flushPending);
    return () => window.removeEventListener("pagehide", flushPending);
  }, [flushPending]);

  // ---- flush a pending review if the shell unmounts mid-reveal via ordinary
  // in-app <Link> navigation (defect: pagehide does NOT fire for client-side
  // routing, so a review answered just before a nav click was silently lost).
  // Deliberately an empty dep array: this must run on UNMOUNT only, not on
  // every re-render, and flushPending is itself stable (its only changing
  // input, pendingRef, is a ref and always current).
  useEffect(() => {
    return () => {
      flushPending();
      // Also clear the REVEAL_MS auto-advance timer: harmless today (it only
      // calls advance(), which is a no-op on an unmounted shell's refs), but
      // left running it fires up to ~1.2s after unmount for no reason.
      if (advanceTimer.current) {
        clearTimeout(advanceTimer.current);
        advanceTimer.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    playSound("complete");
    // Counted here rather than on the summary screen's render: endedRef makes
    // this run exactly once per finished session, and a remount of the summary
    // must not inflate the count.
    recordSessionDone();

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
    // -mt-16 reclaims the 64px the (invisible, opacity-0 but still in-flow)
    // nav header wastes above the progress bar — that empty strip was the
    // "trống" top section, and together with pb-28 it pushed the card area
    // past the viewport, making the OUTER container scroll on phones.
    // 100dvh, not 100vh: the latter includes the iOS URL-bar area.
    <div className="-mt-16 min-h-[100dvh] flex flex-col">
      {toaster}

      <div className="sticky top-0 z-30 bg-paper/80 backdrop-blur-md border-b border-line pt-[env(safe-area-inset-top)]">
        <div className="shell py-2.5 flex items-center gap-3">
          <button
            onClick={onExit}
            aria-label={t("practice.exit")}
            data-nosound
            // h-11 keeps the 44px touch floor; -my-2.5 cancels most of it
            // against the row's py-2.5 so the bar grows by ~8px, not 28px.
            className="-my-2.5 h-11 w-11 shrink-0 grid place-items-center rounded-full text-soft hover:text-ink hover:bg-ink/5 transition-colors"
          >
            <X size={20} />
          </button>
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

      {/* `w-full` is load-bearing: .shell sets `margin-inline: auto`, and on a flex
          item auto cross-axis margins absorb the free space and override
          `align-items: stretch`, leaving the box content-sized. Without this the
          flashcard collapses to a ~150px strip (its front face's in-flow text is
          short and breakable, so min-content is tiny) and the other three modes
          render narrower than they should. The superseded study-session.tsx carried
          the same `w-full` for exactly this reason. */}
      {/* pb: the bottom tab bar is `fixed` (out of flow) AND hidden during a
          session, so the old pb-28 clearance was 112px of nothing — the main
          reason this page scrolled on phones. 1rem + safe-area is enough. */}
      <div className="shell w-full flex-1 flex flex-col justify-center py-4 sm:py-8 pb-[calc(1rem+env(safe-area-inset-bottom))] md:pb-10">
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
