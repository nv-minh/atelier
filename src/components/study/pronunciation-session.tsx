"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Mic, MicOff, CheckCircle2, RotateCcw, Layers, SkipForward, ArrowRight } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { useAchievementToasts } from "@/components/gamification/achievement-toast";
import { AudioButton } from "@/components/audio-button";
import { CefrStamp } from "@/components/ui/cefr-stamp";
import { Button } from "@/components/ui/button";
import { buttonClasses, buttonVariantClasses } from "@/lib/ui/button-classes";
import { fmtTime, shuffle } from "@/lib/utils";
import {
  getSpeechRecognition,
  gradeSpeech,
  type SpeechRecognition,
  type SpeechRecognitionCtor,
  type SpeechRecognitionEvent,
  type SpeechRecognitionErrorEvent,
} from "@/lib/speech";

export type PronWord = {
  word: string;
  cefr: string;
  ipaUk: string | null;
  ipaUs: string | null;
  definitionEn: string | null;
  definitionVi: string | null;
};

type Phase = "idle" | "listening" | "correct" | "wrong";

export function PronunciationSession({ words }: { words: PronWord[] }) {
  // Feature-detect in an effect, NOT during render: SpeechRecognition is absent on
  // the server, so a render-time detect makes the server always emit
  // UnsupportedScreen while Chrome/Safari hydrate to SupportedSession — a
  // guaranteed hydration mismatch (React #418/#423) plus an "unsupported" flash.
  // `undefined` = not yet detected (matches the server's first paint → render null).
  const [SR, setSR] = useState<SpeechRecognitionCtor | null | undefined>(undefined);
  useEffect(() => {
    setSR(() => getSpeechRecognition());
  }, []);

  if (SR === undefined) return null; // pre-detect: render nothing (matches SSR)
  if (SR === null) return <UnsupportedScreen />;
  return <SupportedSession words={words} SR={SR} />;
}

// The real session — only mounted when SpeechRecognition is available, so its
// effects (session-start POST, timer) never run in an unsupported browser.
function SupportedSession({
  words,
  SR,
}: {
  words: PronWord[];
  SR: SpeechRecognitionCtor;
}) {
  const { t } = useI18n();
  const { push: pushToast, toaster } = useAchievementToasts();

  // The words for this run, held in state so "Practice again" can reshuffle their
  // order (buildCramQueue hands back a deterministic cefr/word-sorted list, and the
  // page's random pick only varies across visits, not across replays in one mount).
  const [order, setOrder] = useState<PronWord[]>(words);

  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState<Phase>("idle");
  const [heard, setHeard] = useState<string>(""); // best transcript to display on a miss
  // Persistent (non-transient) error banner: mic denied / needs network. Cleared
  // when the user advances or retries successfully.
  const [errorKind, setErrorKind] = useState<"denied" | "network" | "noSpeech" | null>(null);

  const [done, setDone] = useState(false);
  const [xpGained, setXpGained] = useState(0);

  // Scoring: a word counts correct only if the FIRST attempt was correct. Once a
  // word is answered wrong, it stays wrong for scoring even if a retry succeeds —
  // the simplest honest rule. `resultForIdx` locks the first outcome per word.
  const resultForIdx = useRef<Map<number, boolean>>(new Map());
  const [correctCount, setCorrectCount] = useState(0);

  const current = order[idx];

  // Timer.
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef<number>(Date.now());

  // The live recognition instance for the current attempt. Held in a ref so the
  // unmount cleanup can stop it, and so a second mic press can bail if one is
  // already running (guards against InvalidStateError on double start()).
  const recRef = useRef<SpeechRecognition | null>(null);
  // Tracks whether the component is still mounted, so async recognition callbacks
  // never setState after unmount.
  const mountedRef = useRef(true);

  // ── Session lifecycle (mirrors matching-game.tsx, the canonical pattern) ──
  const sessionStartRef = useRef<Promise<string | null> | null>(null);
  const endedRef = useRef(false);
  const startSession = useCallback((): Promise<string | null> => {
    const p = fetch("/api/study/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "pronunciation" }),
    })
      .then((r) => r.json())
      .then((d) => (d?.sessionId as string) ?? null)
      .catch(() => null);
    sessionStartRef.current = p;
    return p;
  }, []);

  // Mount: mark mounted, start the timer baseline, POST session start once. The
  // return cleanup stops any in-flight recognition and blocks further setState.
  useEffect(() => {
    mountedRef.current = true;
    startRef.current = Date.now();
    startSession();
    return () => {
      mountedRef.current = false;
      const rec = recRef.current;
      if (rec) {
        try {
          // abort() (not stop()) discards any pending result immediately — we're
          // tearing down, so we don't want a late onresult firing mid-unmount.
          rec.abort();
        } catch {
          // already stopped / never started — ignore
        }
        recRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Ticking timer — stops once done. Cleared on unmount.
  useEffect(() => {
    if (done) return;
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [done]);

  // End the session exactly once. Snapshots totals BEFORE awaiting the start POST
  // (so a fast finish racing the start still ends with a session id). The endedRef
  // guard is set synchronously up front.
  const endSession = useCallback(
    async (finalCorrect: number) => {
      if (endedRef.current) return;
      endedRef.current = true;
      const durationSec = Math.round((Date.now() - startRef.current) / 1000);
      const cardsReviewed = order.length;
      const sid = await (sessionStartRef.current ?? Promise.resolve(null));
      if (!sid) return; // start POST failed — award is best-effort
      try {
        const res = await fetch("/api/study/session", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: sid,
            cardsReviewed,
            correctCount: finalCorrect,
            durationSec,
          }),
        });
        const d = await res.json();
        if (!mountedRef.current) return;
        if (d && typeof d.xpGained === "number") setXpGained(d.xpGained);
        if (d && Array.isArray(d.unlocked) && d.unlocked.length) pushToast(d.unlocked);
      } catch {}
    },
    [order.length, pushToast]
  );

  // Advance to the next word, or finish. Takes the final correct tally so the
  // last-word case ends the session with the up-to-date count (no stale closure).
  const advance = useCallback(
    (finalCorrect: number) => {
      const next = idx + 1;
      if (next >= order.length) {
        setDone(true);
        setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
        endSession(finalCorrect);
        return;
      }
      setIdx(next);
      setPhase("idle");
      setHeard("");
      setErrorKind(null);
    },
    [idx, order.length, endSession]
  );

  // Record the graded outcome for the current word. First outcome per index is
  // locked for scoring; retries after a wrong stay wrong. The Next button reads
  // the settled `correctCount` on the following render, so no return is needed.
  const scoreAttempt = useCallback(
    (isCorrect: boolean) => {
      if (!resultForIdx.current.has(idx)) {
        resultForIdx.current.set(idx, isCorrect);
        if (isCorrect) setCorrectCount((c) => c + 1);
      }
    },
    [idx]
  );

  const startListening = useCallback(() => {
    // Guard: never start a second recognition while one is live (InvalidStateError).
    if (recRef.current || phase === "listening") return;

    setErrorKind(null);
    setHeard("");

    let rec: SpeechRecognition;
    try {
      rec = new SR();
    } catch {
      return;
    }
    rec.lang = "en-US";
    rec.maxAlternatives = 5;
    rec.interimResults = false;
    rec.continuous = false;

    rec.onresult = (ev: SpeechRecognitionEvent) => {
      if (!mountedRef.current) return;
      const res = ev.results[0];
      const alts: string[] = [];
      if (res) {
        for (let i = 0; i < res.length; i++) alts.push(res[i].transcript);
      }
      const { correct, best } = gradeSpeech(alts, current.word);
      scoreAttempt(correct);
      if (correct) {
        setPhase("correct");
      } else {
        setHeard(best);
        setPhase("wrong");
      }
    };

    rec.onerror = (ev: SpeechRecognitionErrorEvent) => {
      if (!mountedRef.current) return;
      recRef.current = null;
      switch (ev.error) {
        case "aborted":
          // Programmatic stop (unmount / navigation) — ignore silently.
          setPhase("idle");
          return;
        case "no-speech":
          setErrorKind("noSpeech");
          setPhase("idle");
          return;
        case "not-allowed":
        case "service-not-allowed":
          setErrorKind("denied");
          setPhase("idle");
          return;
        case "network":
          setErrorKind("network");
          setPhase("idle");
          return;
        default:
          // audio-capture, language-not-supported, etc. — treat as a soft retry.
          setPhase("idle");
          return;
      }
    };

    rec.onend = () => {
      recRef.current = null;
      // If recognition ended without a result or a handled error, fall back to
      // idle so the mic is pressable again. (onresult/onerror already set phase.)
      if (!mountedRef.current) return;
      setPhase((p) => (p === "listening" ? "idle" : p));
    };

    try {
      rec.start();
      recRef.current = rec;
      setPhase("listening");
    } catch {
      // InvalidStateError or a Safari user-gesture issue — reset.
      recRef.current = null;
      setPhase("idle");
    }
  }, [SR, phase, current, scoreAttempt]);

  const stopListening = useCallback(() => {
    const rec = recRef.current;
    if (rec) {
      try {
        rec.stop();
      } catch {
        // ignore
      }
    }
  }, []);

  const onNext = useCallback(() => {
    advance(correctCount);
  }, [advance, correctCount]);

  const onRetry = useCallback(() => {
    setPhase("idle");
    setHeard("");
    setErrorKind(null);
  }, []);

  const playAgain = useCallback(() => {
    endedRef.current = false;
    resultForIdx.current = new Map();
    startRef.current = Date.now();
    setOrder((prev) => shuffle(prev)); // fresh order so the replay isn't identical
    setIdx(0);
    setPhase("idle");
    setHeard("");
    setErrorKind(null);
    setCorrectCount(0);
    setXpGained(0);
    setElapsed(0);
    setDone(false);
    startSession();
  }, [startSession]);

  if (done) {
    return (
      <>
        {toaster}
        <SummaryScreen
          elapsed={elapsed}
          correctCount={correctCount}
          total={order.length}
          xpGained={xpGained}
          onPlayAgain={playAgain}
        />
      </>
    );
  }

  const ipa = current.ipaUk || current.ipaUs;

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col">
      {toaster}
      {/* HUD */}
      <div className="sticky top-16 z-30 bg-paper/80 backdrop-blur-md border-b border-hairline/10">
        <div className="shell py-2.5 flex items-center justify-between gap-3 text-sm">
          <span className="text-fg-muted tabular-nums whitespace-nowrap" aria-live="polite">
            {t("study.pronProgress", { n: idx + 1, total: order.length })}
          </span>
          <div className="flex items-center gap-4 tabular-nums">
            <span className="text-fg-muted">
              <span className="text-fg font-semibold">{fmtTime(elapsed)}</span>
            </span>
            <span className="text-fg-muted">
              {t("study.pronCorrectLabel")}{" "}
              <span className="text-moss-500 font-semibold">{correctCount}</span>
            </span>
          </div>
        </div>
      </div>

      <div className="shell w-full flex-1 flex flex-col items-center justify-center py-6 sm:py-10 pb-28 md:pb-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="w-full max-w-lg text-center"
          >
            <div className="mb-4 flex justify-center">
              <CefrStamp level={current.cefr} />
            </div>

            <p className="text-fg-muted text-sm mb-3">{t("study.pronListenPrompt")}</p>

            <h2 className="display text-display-md sm:text-display-lg break-words mb-3">
              {current.word}
            </h2>

            {ipa && <p className="font-mono text-sm sm:text-base text-fg-muted mb-4">{ipa}</p>}

            <div className="flex items-center justify-center gap-1.5 mb-6">
              <AudioButton word={current.word} accent="uk" size="sm" />
              <AudioButton word={current.word} accent="us" size="sm" />
            </div>

            {(current.definitionVi || current.definitionEn) && (
              <p className="text-fg-muted text-sm leading-relaxed mb-8 max-w-md mx-auto">
                {current.definitionVi || current.definitionEn}
              </p>
            )}

            {/* Persistent error banner (mic denied / network) */}
            {errorKind === "denied" && (
              <div className="mb-6 rounded-2xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-fg">
                {t("study.pronMicDenied")}
              </div>
            )}
            {errorKind === "network" && (
              <div className="mb-6 rounded-2xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-fg">
                {t("study.pronNeedsNetwork")}
              </div>
            )}

            {/* Mic + result area */}
            <MicArea
              phase={phase}
              heard={heard}
              noSpeech={errorKind === "noSpeech"}
              blocked={errorKind === "denied" || errorKind === "network"}
              onStart={startListening}
              onStop={stopListening}
              onRetry={onRetry}
              onNext={onNext}
            />
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

function MicArea({
  phase,
  heard,
  noSpeech,
  blocked,
  onStart,
  onStop,
  onRetry,
  onNext,
}: {
  phase: Phase;
  heard: string;
  noSpeech: boolean;
  blocked: boolean; // mic denied / network — can't listen, so offer a way past the word
  onStart: () => void;
  onStop: () => void;
  onRetry: () => void;
  onNext: () => void;
}) {
  const { t } = useI18n();
  const listening = phase === "listening";

  return (
    // aria-live so screen readers announce result transitions on this speech feature.
    <div className="flex flex-col items-center gap-5" aria-live="polite">
      {phase === "correct" ? (
        <>
          <motion.div
            initial={{ scale: 0, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 220 }}
            className="grid h-20 w-20 place-items-center rounded-full bg-moss-500/15 text-moss-500"
          >
            <CheckCircle2 size={40} strokeWidth={1.5} />
          </motion.div>
          <p className="text-moss-500 font-semibold">{t("study.pronCorrect")}</p>
          <Button onClick={onNext} variant="primary" size="md">
            {t("study.pronNext")} <ArrowRight size={16} />
          </Button>
        </>
      ) : phase === "wrong" ? (
        <>
          <div className="grid h-16 w-16 place-items-center rounded-full bg-red-400/12 text-red-400">
            <MicOff size={30} strokeWidth={1.5} />
          </div>
          {heard ? (
            <p className="text-sm text-fg-muted">
              {t("study.pronHeard")}{" "}
              <span className="text-fg font-semibold">“{heard}”</span>
            </p>
          ) : (
            <p className="text-sm text-fg-muted">{t("study.pronNoSpeech")}</p>
          )}
          <div className="flex flex-col sm:flex-row gap-3">
            <Button onClick={onRetry} variant="primary" size="md">
              <RotateCcw size={16} /> {t("study.pronTryAgain")}
            </Button>
            <button
              onClick={onNext}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-hairline/10 px-6 py-3 font-medium hover:bg-paper-200/50 transition-colors"
            >
              <SkipForward size={16} /> {t("study.pronSkip")}
            </button>
          </div>
        </>
      ) : (
        <>
          <motion.button
            type="button"
            onClick={listening ? onStop : onStart}
            aria-label={listening ? t("study.pronListening") : t("study.pronSpeakPrompt")}
            className={`relative grid h-24 w-24 place-items-center rounded-full transition-colors cursor-pointer ${
              listening ? "bg-ember text-paper" : buttonVariantClasses("primary")
            }`}
          >
            {/* Pulsing ring while listening */}
            {listening && (
              <motion.span
                aria-hidden
                className="absolute inset-0 rounded-full border-2 border-ember"
                initial={{ opacity: 0.6, scale: 1 }}
                animate={{ opacity: 0, scale: 1.6 }}
                transition={{ duration: 1.2, repeat: Infinity, ease: "easeOut" }}
              />
            )}
            <Mic size={38} strokeWidth={1.75} className={listening ? "animate-pulse" : ""} />
          </motion.button>
          <p className="text-sm text-fg-muted min-h-[1.25rem]">
            {listening
              ? t("study.pronListening")
              : noSpeech
                ? t("study.pronNoSpeech")
                : t("study.pronSpeakPrompt")}
          </p>
          {/* Mic denied / network can't be retried by pressing the mic again
              (browsers won't re-prompt after a hard deny), so offer Skip to avoid
              a dead-end on the current word. Unscored → counts as a miss. */}
          {blocked && (
            <button
              onClick={onNext}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-hairline/10 px-6 py-3 font-medium hover:bg-paper-200/50 transition-colors"
            >
              <SkipForward size={16} /> {t("study.pronSkip")}
            </button>
          )}
        </>
      )}
    </div>
  );
}

// Fallback screen for browsers without SpeechRecognition (Firefox). No session is
// started — this component's parent returns before mounting the real session.
function UnsupportedScreen() {
  const { t } = useI18n();
  return (
    <main className="shell py-20">
      <div className="mx-auto max-w-md text-center">
        <div className="mx-auto mb-6 grid h-16 w-16 place-items-center rounded-full bg-ink/5 text-fg-muted">
          <MicOff size={32} strokeWidth={1.5} />
        </div>
        <h1 className="display text-display-md mb-3">{t("study.pronUnsupportedTitle")}</h1>
        <p className="text-fg-muted mb-8 leading-relaxed">{t("study.pronUnsupportedBody")}</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <a href="/study/dictation" className={buttonClasses("primary", "md")}>
            {t("study.pronTryDictation")}
          </a>
          <a
            href="/study"
            className="inline-flex items-center justify-center gap-2 rounded-full border border-hairline/10 px-6 py-3 font-medium hover:bg-paper-200/50 transition-colors"
          >
            <Layers size={16} /> {t("study.changeMode")}
          </a>
        </div>
      </div>
    </main>
  );
}

function SummaryScreen({
  elapsed,
  correctCount,
  total,
  xpGained,
  onPlayAgain,
}: {
  elapsed: number;
  correctCount: number;
  total: number;
  xpGained: number;
  onPlayAgain: () => void;
}) {
  const { t } = useI18n();
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
          <Mic size={38} strokeWidth={1.5} />
        </motion.div>
        <h2 className="display text-display-md mb-1 text-center">{t("study.pronComplete")}</h2>
        <p className="text-fg-muted text-center mb-2">
          {t("study.pronCorrectOf", { c: correctCount, t: total })}
        </p>
        {xpGained > 0 && (
          <p className="text-center mb-6 text-sm font-semibold text-ember">
            {t("gamify.xpEarned", { n: xpGained })}
          </p>
        )}
        {xpGained <= 0 && <div className="mb-4" />}

        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="card-atelier p-4 text-center">
            <p className="display text-2xl tabular-nums">{fmtTime(elapsed)}</p>
            <p className="text-[10px] uppercase tracking-wide text-fg-muted">{t("study.pronTime")}</p>
          </div>
          <div className="card-atelier p-4 text-center">
            <p className="display text-2xl tabular-nums text-moss-500">
              {correctCount}/{total}
            </p>
            <p className="text-[10px] uppercase tracking-wide text-fg-muted">
              {t("study.pronCorrectLabel")}
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button onClick={onPlayAgain} variant="primary" size="md">
            <RotateCcw size={16} /> {t("study.pronPracticeAgain")}
          </Button>
          <a
            href="/study"
            className="inline-flex items-center justify-center gap-2 rounded-full border border-hairline/10 px-6 py-3 font-medium hover:bg-paper-200/50"
          >
            <Layers size={16} /> {t("study.changeMode")}
          </a>
        </div>
      </motion.div>
    </div>
  );
}
