"use client";

// Grammar answer session. Borrows practice-shell's UX grammar (progress bar,
// reveal window, tap/key advance, sound+haptics) but is its own component:
// the practice shell is welded to FSRS cards/ratings and /api/study/review,
// while grammar questions are server-graded via /api/grammar/answer.
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { CheckCircle2, RotateCcw, XCircle } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Card } from "@/components/ui/card";
import { playSound } from "@/lib/sound";
import { vibrate } from "@/lib/haptics";
import type { GrammarSessionItem, GrammarSource } from "@/lib/grammar/session-types";

const LETTERS = ["A", "B", "C", "D"];
const REVEAL_MS = 1400;

function newSessionKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

type Answered = { item: GrammarSessionItem; chosen: number; answerIndex: number; correct: boolean };

export function GrammarSession({
  source,
  topicSlug,
  topicNameEn,
  topicNameVi,
  items,
}: {
  source: GrammarSource;
  topicSlug: string;
  topicNameEn: string;
  topicNameVi: string | null;
  items: GrammarSessionItem[];
}) {
  const { t, lang } = useI18n();
  const [queue, setQueue] = useState(items);
  const [index, setIndex] = useState(0);
  const [chosen, setChosen] = useState<number | null>(null);
  const [serverAnswer, setServerAnswer] = useState<number | null>(null);
  const [reveal, setReveal] = useState<"hidden" | "correct" | "wrong">("hidden");
  const [results, setResults] = useState<Answered[]>([]);
  const [xp, setXp] = useState(0);
  const [unsaved, setUnsaved] = useState(0);
  const [done, setDone] = useState(false);
  const [posting, setPosting] = useState(false);

  const sessionKeyRef = useRef(newSessionKey());
  const startedAtRef = useRef(Date.now());
  const endedRef = useRef(false);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear the reveal auto-advance timer when the session unmounts mid-reveal
  // (practice-shell has the same cleanup for the same reason).
  useEffect(() => () => { if (advanceTimer.current) clearTimeout(advanceTimer.current); }, []);

  const current = queue[index];
  const topicName = lang === "vi" && topicNameVi ? topicNameVi : topicNameEn;

  const advance = useCallback(() => {
    if (advanceTimer.current) {
      clearTimeout(advanceTimer.current);
      advanceTimer.current = null;
    }
    setChosen(null);
    setServerAnswer(null);
    setReveal("hidden");
    setIndex((i) => i + 1);
  }, []);

  const pick = useCallback(
    async (i: number) => {
      if (!current || chosen !== null || posting) return;
      setPosting(true);
      setChosen(i);
      const send = () =>
        fetch("/api/grammar/answer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ source, questionId: current.id, chosenIndex: i }),
        });
      let d: { correct: boolean; answerIndex: number; xpGained: number } | null = null;
      try {
        let res = await send();
        if (!res.ok) res = await send(); // one retry — the ledger makes replays XP-safe
        if (res.ok) d = await res.json();
      } catch {
        try {
          const res = await send();
          if (res.ok) d = await res.json();
        } catch {}
      }
      setPosting(false);
      // Offline fallback: grade locally is impossible (answer lives server-side)
      // — count it unsaved and move on rather than trapping the session.
      if (!d) {
        setUnsaved((n) => n + 1);
        advance();
        return;
      }
      const graded = d; // narrowed non-null
      setServerAnswer(graded.answerIndex);
      setReveal(graded.correct ? "correct" : "wrong");
      setResults((r) => [...r, { item: current, chosen: i, answerIndex: graded.answerIndex, correct: graded.correct }]);
      if (graded.xpGained > 0) setXp((x) => x + graded.xpGained);
      if (graded.correct) {
        playSound("correct");
        vibrate(10);
      } else {
        playSound("wrong");
        vibrate([20, 40, 20]);
      }
      advanceTimer.current = setTimeout(advance, REVEAL_MS);
    },
    [current, chosen, posting, source, advance]
  );

  // Tap/key advances immediately during the reveal (same affordance as the
  // practice shell, same aria-disabled carve-out for the option buttons).
  useEffect(() => {
    if (reveal === "hidden") return;
    const h = (e: Event) => {
      if (e instanceof KeyboardEvent && e.repeat) return;
      const el = e.target;
      const control =
        el instanceof Element ? el.closest("button,a,input,textarea,select,[role='button']") : null;
      if (control && control.getAttribute("aria-disabled") !== "true") return;
      advance();
    };
    window.addEventListener("pointerdown", h);
    window.addEventListener("keydown", h);
    return () => {
      window.removeEventListener("pointerdown", h);
      window.removeEventListener("keydown", h);
    };
  }, [reveal, advance]);

  // Keyboard 1-4 / A-D picks an option while unanswered.
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (reveal !== "hidden" || !current) return;
      const byDigit = Number.parseInt(e.key, 10) - 1;
      const byLetter = LETTERS.indexOf(e.key.toUpperCase());
      const i = Number.isInteger(byDigit) && byDigit >= 0 ? byDigit : byLetter;
      if (i >= 0 && i < current.choices.length) void pick(i);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [reveal, current, pick]);

  // Session end: report once, idempotent server-side by sessionKey.
  useEffect(() => {
    if (done || index < queue.length) return;
    if (endedRef.current) return;
    endedRef.current = true;
    setDone(true);
    playSound("complete");
    const correct = results.filter((r) => r.correct).length;
    fetch("/api/grammar/session-end", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionKey: sessionKeyRef.current,
        source,
        total: results.length,
        correct,
        durationSec: Math.round((Date.now() - startedAtRef.current) / 1000),
      }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d && typeof d.xpGained === "number" && d.xpGained > 0) setXp((x) => x + d.xpGained);
      })
      .catch(() => {});
  }, [index, queue.length, done, results, source]);

  const retryWrong = () => {
    const wrong = results.filter((r) => !r.correct).map((r) => ({ ...r.item }));
    if (wrong.length === 0) return;
    sessionKeyRef.current = newSessionKey();
    startedAtRef.current = Date.now();
    endedRef.current = false;
    setResults([]);
    setXp(0);
    setUnsaved(0);
    setPosting(false);
    setQueue(wrong);
    setIndex(0);
    setDone(false);
    setChosen(null);
    setServerAnswer(null);
    setReveal("hidden");
  };

  if (done) {
    const correct = results.filter((r) => r.correct).length;
    const pct = results.length > 0 ? Math.round((correct / results.length) * 100) : 0;
    const wrong = results.filter((r) => !r.correct);
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-6 py-10">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md">
          <motion.div
            initial={{ scale: 0, rotate: -30 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: 0.1, type: "spring", stiffness: 200 }}
            className="mx-auto mb-5 grid h-20 w-20 place-items-center rounded-full bg-moss-500/15 text-moss-500"
          >
            <CheckCircle2 size={40} strokeWidth={1.5} />
          </motion.div>
          <h2 className="display text-display-md mb-1 text-center">{t("grammar.test.summaryTitle")}</h2>
          {xp > 0 && (
            <p className="text-center mb-1 text-sm font-semibold text-ember">{t("gamify.xpEarned", { n: xp })}</p>
          )}
          {unsaved > 0 && (
            <p className="text-center mb-1 text-sm text-red-500">{t("grammar.test.unsavedN", { n: unsaved })}</p>
          )}
          <div className="grid grid-cols-2 gap-3 my-5">
            <Card variant="flat" className="p-4 text-center">
              <p className="display text-2xl text-moss-500 tabular-nums">{pct}%</p>
              <p className="text-[10px] uppercase tracking-wide text-fg-muted">{t("grammar.test.accuracy")}</p>
            </Card>
            <Card variant="flat" className="p-4 text-center">
              <p className="display text-2xl tabular-nums">
                {correct}/{results.length}
              </p>
              <p className="text-[10px] uppercase tracking-wide text-fg-muted">{topicName}</p>
            </Card>
          </div>
          {wrong.length > 0 && (
            <Card variant="flat" className="p-5 mb-6 max-h-60 overflow-y-auto">
              <p className="text-[11px] uppercase tracking-wider text-fg-muted font-semibold mb-3">
                {t("grammar.test.wrongList")}
              </p>
              <ul className="space-y-3">
                {wrong.map((w) => (
                  <li key={w.item.id} className="text-sm">
                    <p className="leading-snug">{w.item.questionEn}</p>
                    <p className="text-xs mt-0.5">
                      <span className="text-red-500 line-through">{w.item.choices[w.chosen]}</span>{" "}
                      <span className="text-moss-500 font-medium">→ {w.item.choices[w.answerIndex]}</span>
                    </p>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            {wrong.length > 0 && (
              <Button onClick={retryWrong} variant="primary" size="md">
                <RotateCcw size={16} /> {t("grammar.test.retryWrong", { n: wrong.length })}
              </Button>
            )}
            <Link
              href={`/grammar/${topicSlug}`}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-hairline/10 px-6 py-3 font-medium hover:bg-paper-200/50"
            >
              {t("grammar.test.backToTopic")}
            </Link>
          </div>
        </motion.div>
      </div>
    );
  }

  if (!current) return null;
  const question = lang === "vi" && current.questionVi ? current.questionVi : current.questionEn;

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col">
      <div className="sticky top-16 z-30 bg-paper/80 backdrop-blur-md border-b border-hairline/10">
        <div className="shell py-2.5 flex items-center gap-3">
          <span className="text-xs text-fg-muted tabular-nums whitespace-nowrap">
            {index + 1} <span className="opacity-50">/ {queue.length}</span>
          </span>
          <div className="flex-1 h-1.5 rounded-full bg-ink/10 overflow-hidden">
            <motion.div
              className="h-full bg-ember rounded-full"
              animate={{ width: `${(index / Math.max(queue.length, 1)) * 100}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
          <span className="text-xs font-mono text-fg-muted">
            {results.filter((r) => r.correct).length}/{results.length}
          </span>
        </div>
      </div>

      <div className="shell w-full flex-1 flex flex-col justify-center py-6 sm:py-10 pb-28 md:pb-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={`${current.id}-${index}`}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.2 }}
            className="max-w-2xl mx-auto w-full"
          >
            <div className="text-center mb-8">
              <p className="text-xs text-fg-muted font-mono mb-3">{t("grammar.test.title", { topic: topicName })}</p>
              {current.repeat && <p className="mb-3"><Chip className="text-fg-muted">{t("grammar.test.repeatPill")}</Chip></p>}
              <h2 className="display text-xl sm:text-2xl leading-relaxed break-words">{question}</h2>
              {lang === "vi" && current.questionVi && current.questionEn !== question && (
                <p className="text-sm text-fg-muted mt-2">{current.questionEn}</p>
              )}
              <p className="text-xs text-fg-muted mt-3">{t("grammar.test.pickAnswer")}</p>
            </div>

            <div className="grid sm:grid-cols-2 gap-2.5" data-nosound>
              {current.choices.map((opt, i) => {
                const shown = reveal !== "hidden";
                const isCorrect = serverAnswer === i;
                const isPicked = chosen === i;
                return (
                  <button
                    key={i}
                    aria-disabled={shown || posting}
                    onClick={() => void pick(i)}
                    className={`text-left rounded-2xl border p-4 transition-all flex items-start gap-3 ${
                      shown && isCorrect
                        ? "border-moss-500 bg-moss-500/10 cursor-default"
                        : shown && isPicked
                          ? "border-red-400 bg-red-400/10 cursor-default"
                          : shown
                            ? "border-hairline/10 opacity-60 cursor-default"
                            : "border-hairline/10 hover:border-ink/30 hover:bg-paper-200/40"
                    }`}
                  >
                    <span className="text-xs font-mono text-fg-muted mt-0.5">{LETTERS[i]}</span>
                    <span className="text-sm leading-snug">{opt}</span>
                    {shown && isCorrect && <CheckCircle2 size={16} className="ml-auto shrink-0 text-moss-500" />}
                    {shown && isPicked && !isCorrect && <XCircle size={16} className="ml-auto shrink-0 text-red-400" />}
                  </button>
                );
              })}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
