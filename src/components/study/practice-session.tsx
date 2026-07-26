"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { CheckCircle2, XCircle, RotateCcw, Volume2 } from "lucide-react";
import { AudioButton } from "@/components/audio-button";
import { CefrBadge } from "@/components/cefr-badge";
import { useI18n } from "@/components/i18n-provider";
import { gradeTyping, normalizeWord } from "@/lib/utils";
import { playWord } from "@/lib/tts";
import { useAchievementToasts } from "@/components/gamification/achievement-toast";

export type PracticeCard = {
  cardId: string;
  wordId: string;
  word: string;
  cefr: string;
  typeEn: string | null;
  typeVi: string | null;
  ipaUk: string | null;
  ipaUs: string | null;
  definitionEn: string | null;
  definitionVi: string | null;
  example: string | null;
  exampleVi: string | null;
  synonyms: string[];
  audioUk: string | null;
  audioUs: string | null;
  state: number;
  reps: number;
  lapses: number;
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  due: string;
  lastReview: string | null;
};

type Feedback = { state: "idle" | "correct" | "wrong"; message?: string };

export function PracticeSession({
  cards,
  mode,
}: {
  cards: PracticeCard[];
  mode: "quiz" | "typing" | "dictation";
}) {
  const { t } = useI18n();
  const { push: pushToast, toaster } = useAchievementToasts();
  const [queue, setQueue] = useState(cards);
  const [index, setIndex] = useState(0);
  const [feedback, setFeedback] = useState<Feedback>({ state: "idle" });
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const [xpGained, setXpGained] = useState(0);
  const [busy, setBusy] = useState(false);

  const current = queue[index];
  const [quizOptions, setQuizOptions] = useState<string[] | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [typed, setTyped] = useState("");
  const [dictSpeed, setDictSpeed] = useState(1);

  // Load quiz options for the current card (handled in the quizOpts effect below)

  const submit = useCallback(
    async (correct: boolean, message?: string) => {
      if (!current || busy) return;
      setBusy(true);
      setScore((s) => ({ correct: s.correct + (correct ? 1 : 0), total: s.total + 1 }));
      setFeedback({ state: correct ? "correct" : "wrong", message });
      try {
        const res = await fetch("/api/study/review", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            cardId: current.cardId,
            rating: correct ? 3 : 1, // Good or Again
            correct,
          }),
        });
        const d = await res.json().catch(() => null);
        if (d) {
          if (typeof d.xpGained === "number") setXpGained((x) => x + d.xpGained);
          if (Array.isArray(d.unlocked) && d.unlocked.length) pushToast(d.unlocked);
        }
      } catch {}
      setTimeout(() => {
        setFeedback({ state: "idle" });
        setTyped("");
        setSelected(null);
        setIndex((i) => i + 1);
        setBusy(false);
      }, 1100);
    },
    [current, busy]
  );

  // ---- QUIZ ----
  const onQuiz = (i: number) => {
    if (selected !== null || !quizOpts) return;
    setSelected(i);
    const correct = i === quizOpts.correctIndex;
    submit(correct, correct ? "Well done." : `Answer: ${current.word}`);
  };

  // We fetch options from an API that knows the word. quizOpts resolved via effect:
  const [quizOpts, setQuizOpts] = useState<{ options: string[]; correctIndex: number } | null>(null);
  useEffect(() => {
    if (mode !== "quiz" || !current) return;
    setQuizOpts(null);
    fetch(`/api/study/quiz-options?wordId=${current.wordId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.options && d.options.length === 4) setQuizOpts(d);
      })
      .catch(() => {});
  }, [current, mode]);

  // ---- TYPING ----
  const onTypingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!typed.trim()) return;
    const res = gradeTyping(typed, current.word, current.synonyms);
    submit(res.correct, res.correct ? (res.acceptedAs ? `Accepted: ${current.word}` : "Correct") : `Answer: ${current.word}`);
  };

  // ---- DICTATION ----
  const playDict = () => {
    // real recording (us) -> TTS fallback, with speed control
    playWord(current.word, { accent: "us", rate: dictSpeed }).catch(() => {});
  };
  useEffect(() => {
    if (mode === "dictation" && current) {
      const t = setTimeout(playDict, 350);
      return () => clearTimeout(t);
    }
  }, [current, mode]);

  // keyboard: Enter to submit typing
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (mode === "typing" && e.key === "Enter") {
        // form handles it
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [mode]);

  // Completion
  if (index >= queue.length) {
    const pct = score.total ? Math.round((score.correct / score.total) * 100) : 0;
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-6">
        {toaster}
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center max-w-md">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.1, type: "spring", stiffness: 200 }}
            className={`mx-auto mb-6 grid h-20 w-20 place-items-center rounded-full ${pct >= 70 ? "bg-moss-500/15 text-moss-500" : "bg-ember/15 text-ember"}`}
          >
            {pct >= 70 ? <CheckCircle2 size={40} strokeWidth={1.5} /> : <RotateCcw size={40} strokeWidth={1.5} />}
          </motion.div>
          <h2 className="display text-display-md mb-1">{pct >= 70 ? t("practice.nicelyDone") : t("practice.keepGoing")}</h2>
          <p className="display text-5xl text-ember mb-2">{pct}%</p>
          <p className="text-soft mb-2">{t("practice.correctOf", { c: score.correct, t: score.total })}</p>
          {xpGained > 0 && (
            <p className="text-sm font-semibold text-ember mb-8">{t("gamify.xpEarned", { n: xpGained })}</p>
          )}
          {xpGained <= 0 && <div className="mb-6" />}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button onClick={() => window.location.reload()} className="inline-flex items-center justify-center gap-2 rounded-full bg-ink text-paper px-6 py-3 font-medium hover:opacity-90">
              <RotateCcw size={16} /> {t("practice.practiceAgain")}
            </button>
            <a href="/study" className="inline-flex items-center justify-center gap-2 rounded-full border border-line px-6 py-3 font-medium hover:bg-paper-200/50">
              {t("study.changeMode")}
            </a>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col">
      {toaster}
      <div className="sticky top-16 z-30 bg-paper/80 backdrop-blur-md border-b border-line">
        <div className="shell py-2.5 flex items-center gap-3">
          <span className="text-xs text-soft tabular-nums whitespace-nowrap">
            {index + 1} <span className="opacity-50">/ {queue.length}</span>
          </span>
          <div className="flex-1 h-1.5 rounded-full bg-ink/10 overflow-hidden">
            <motion.div className="h-full bg-cefr-b2 rounded-full" animate={{ width: `${(index / queue.length) * 100}%` }} transition={{ duration: 0.3 }} />
          </div>
          <span className="text-xs font-mono text-soft">
            {score.correct}/{score.total}
          </span>
        </div>
      </div>

      <div className="shell flex-1 flex flex-col justify-center py-6 sm:py-10 pb-28 md:pb-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={current.cardId}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.3 }}
          >
            {mode === "quiz" && (
              <QuizMode
                current={current}
                opts={quizOpts}
                selected={selected}
                onSelect={onQuiz}
                feedback={feedback}
              />
            )}
            {mode === "typing" && (
              <TypingMode current={current} typed={typed} setTyped={setTyped} onSubmit={onTypingSubmit} feedback={feedback} />
            )}
            {mode === "dictation" && (
              <DictationMode current={current} typed={typed} setTyped={setTyped} onSubmit={onTypingSubmit} feedback={feedback} onPlay={playDict} speed={dictSpeed} setSpeed={setDictSpeed} />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ---------- QUIZ ---------- */
function QuizMode({ current, opts, selected, onSelect, feedback }: any) {
  const { t } = useI18n();
  const letter = ["A", "B", "C", "D"];
  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <div className="flex items-center justify-center gap-2 mb-4">
          <CefrBadge level={current.cefr} />
          <AudioButton word={current.word} accent="us" size="sm" />
          <AudioButton word={current.word} accent="uk" size="sm" />
        </div>
        <h2 className="display text-display-md break-words">{current.word}</h2>
        {current.ipaUk && <p className="font-mono text-sm text-soft mt-2">{current.ipaUk}</p>}
        <p className="text-xs text-soft mt-3">{t("practice.whichMeaning")}</p>
      </div>
      {!opts ? (
        <div className="grid grid-cols-2 gap-2 animate-pulse">
          {[0, 1, 2, 3].map((i) => <div key={i} className="h-16 rounded-2xl bg-ink/5" />)}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-2.5">
          {opts.options.map((opt: string, i: number) => {
            const isCorrect = i === opts.correctIndex;
            const isPicked = selected === i;
            const reveal = selected !== null;
            return (
              <button
                key={i}
                disabled={reveal}
                onClick={() => onSelect(i)}
                className={`text-left rounded-2xl border p-4 transition-all flex items-start gap-3 ${
                  reveal && isCorrect
                    ? "border-moss-500 bg-moss-500/10"
                    : reveal && isPicked
                    ? "border-red-400 bg-red-400/10"
                    : "border-line hover:border-ink/30 hover:bg-paper-200/40"
                }`}
              >
                <span className="text-xs font-mono text-soft mt-0.5">{letter[i]}</span>
                <span className="text-sm leading-snug">{opt}</span>
                {reveal && isCorrect && <CheckCircle2 size={16} className="ml-auto text-moss-500" />}
                {reveal && isPicked && !isCorrect && <XCircle size={16} className="ml-auto text-red-400" />}
              </button>
            );
          })}
        </div>
      )}
      {feedback.state !== "idle" && (
        <FeedbackStrip state={feedback.state} message={feedback.message} example={current.example} />
      )}
    </div>
  );
}

/* ---------- TYPING ---------- */
function TypingMode({ current, typed, setTyped, onSubmit, feedback }: any) {
  const { t } = useI18n();
  const reveal = feedback.state !== "idle";
  return (
    <div className="max-w-xl mx-auto">
      <div className="text-center mb-8">
        <CefrBadge level={current.cefr} className="mb-4" />
        <p className="text-xs text-soft font-mono mb-2">{t("practice.typeFor")}</p>
        <p className="display text-xl sm:text-2xl leading-snug">{current.definitionEn}</p>
        {current.typeVi && <p className="text-xs text-soft mt-2">{current.typeVi}</p>}
      </div>
      <form onSubmit={onSubmit}>
        <input
          autoFocus
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          disabled={reveal}
          placeholder={t("practice.typeWord")}
          className={`w-full text-center text-2xl font-mono rounded-2xl border bg-surface px-4 py-4 outline-none transition-colors ${
            reveal
              ? feedback.state === "correct"
                ? "border-moss-500"
                : "border-red-400"
              : "border-line focus:border-ember"
          }`}
        />
        {!reveal && (
          <button type="submit" className="mt-3 w-full rounded-2xl bg-ink text-paper py-3 font-medium hover:opacity-90">
            {t("practice.check")} <span className="opacity-50 ml-1">↵</span>
          </button>
        )}
      </form>
      {reveal && (
        <div className="mt-4 text-center">
          <p className="text-sm text-soft">
            {t("practice.answer")} <span className="display text-xl text-ink">{current.word}</span>
            <span className="font-mono text-xs ml-2">{current.ipaUk}</span>
          </p>
          <div className="flex justify-center gap-1.5 mt-2">
            <AudioButton word={current.word} accent="us" size="sm" />
            <AudioButton word={current.word} accent="uk" size="sm" />
          </div>
          {current.definitionVi && <p className="text-xs text-soft/70 mt-2">{current.definitionVi}</p>}
        </div>
      )}
      {feedback.state !== "idle" && <FeedbackStrip state={feedback.state} message={feedback.message} example={current.example} exampleVi={current.exampleVi} />}
    </div>
  );
}

/* ---------- DICTATION ---------- */
function DictationMode({ current, typed, setTyped, onSubmit, feedback, onPlay, speed, setSpeed }: any) {
  const { t } = useI18n();
  const reveal = feedback.state !== "idle";
  return (
    <div className="max-w-xl mx-auto">
      <div className="text-center mb-8">
        <div className="flex items-center justify-center gap-2 mb-4">
          <CefrBadge level={current.cefr} />
        </div>
        <p className="text-xs text-soft font-mono mb-3">{t("practice.listenType")}</p>
        <button
          onClick={onPlay}
          className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-ink text-paper hover:opacity-90 transition-opacity"
        >
          <Volume2 size={28} />
        </button>
        <div className="flex justify-center gap-2 mt-4">
          {[1, 0.75, 0.5].map((s) => (
            <button
              key={s}
              onClick={() => setSpeed(s)}
              className={`text-xs rounded-full px-2.5 py-1 border transition-colors ${
                speed === s ? "border-ember text-ember" : "border-line text-soft"
              }`}
            >
              {s === 1 ? "1×" : `${s}×`}
            </button>
          ))}
        </div>
      </div>
      <form onSubmit={onSubmit}>
        <input
          autoFocus
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          disabled={reveal}
          placeholder={t("practice.spellHeard")}
          className={`w-full text-center text-2xl font-mono rounded-2xl border bg-surface px-4 py-4 outline-none transition-colors ${
            reveal ? (feedback.state === "correct" ? "border-moss-500" : "border-red-400") : "border-line focus:border-ember"
          }`}
        />
        {!reveal && (
          <button type="submit" className="mt-3 w-full rounded-2xl bg-ink text-paper py-3 font-medium hover:opacity-90">
            {t("practice.check")} <span className="opacity-50 ml-1">↵</span>
          </button>
        )}
      </form>
      {reveal && (
        <div className="mt-4 text-center">
          <p className="text-sm text-soft">
            <span className="display text-xl text-ink">{current.word}</span>
            <span className="font-mono text-xs ml-2">{current.ipaUs || current.ipaUk}</span>
          </p>
          {current.definitionEn && <p className="text-xs text-soft mt-1">{current.definitionEn}</p>}
          {current.definitionVi && <p className="text-xs text-soft/70 mt-0.5">{current.definitionVi}</p>}
        </div>
      )}
      {feedback.state !== "idle" && <FeedbackStrip state={feedback.state} message={feedback.message} example={current.example} exampleVi={current.exampleVi} />}
    </div>
  );
}

function FeedbackStrip({ state, message, example, exampleVi }: { state: string; message?: string; example?: string | null; exampleVi?: string | null }) {
  const { t } = useI18n();
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`mt-5 rounded-2xl p-4 border ${
        state === "correct" ? "bg-moss-500/8 border-moss-500/30" : "bg-red-400/8 border-red-400/30"
      }`}
    >
      <p className={`text-sm font-semibold ${state === "correct" ? "text-moss-600 dark:text-moss-400" : "text-red-500"}`}>
        {state === "correct" ? t("practice.correct") : t("practice.wrong")} {message && <span className="font-normal opacity-80">— {message}</span>}
      </p>
      {example && <p className="text-xs text-soft mt-1.5 italic">“{example}”</p>}
      {exampleVi && <p className="text-xs text-soft/70 mt-0.5">{exampleVi}</p>}
    </motion.div>
  );
}
