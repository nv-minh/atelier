"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { AudioButton } from "@/components/audio-button";
import { CefrBadge } from "@/components/cefr-badge";
import { useI18n } from "@/components/i18n-provider";
import { FeedbackStrip } from "@/components/practice/feedback-strip";
import type { ModeViewProps } from "@/lib/practice/types";

const LETTERS = ["A", "B", "C", "D"];

export function QuizMode({ item, reveal, onAnswer, onSkip }: ModeViewProps) {
  const { t } = useI18n();
  const [opts, setOpts] = useState<{ options: string[]; correctIndex: number } | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const readyAtRef = useRef<number | null>(null);

  useEffect(() => {
    setOpts(null);
    setSelected(null);
    readyAtRef.current = null;
    let cancelled = false;

    fetch(`/api/study/quiz-options?wordId=${encodeURIComponent(item.wordId)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d) => {
        if (cancelled) return;
        if (d && Array.isArray(d.options) && d.options.length === 4) {
          setOpts({ options: d.options, correctIndex: d.correctIndex });
          readyAtRef.current = Date.now();
        } else {
          onSkip(`quiz-options returned ${d?.options?.length ?? 0} options`);
        }
      })
      .catch((e) => {
        if (!cancelled) onSkip(`quiz-options failed: ${String(e)}`);
      });

    return () => {
      cancelled = true;
    };
  }, [item.wordId, onSkip]);

  const pick = (i: number) => {
    if (selected !== null || !opts) return;
    setSelected(i);
    const correct = i === opts.correctIndex;
    onAnswer({
      correct,
      signals: {
        correct,
        elapsedMs: readyAtRef.current ? Date.now() - readyAtRef.current : 0,
        wordLength: item.word.length,
        cardState: item.state,
        wasHidden: false,
        changedAnswer: false,
      },
    });
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <div className="flex items-center justify-center gap-2 mb-4">
          <CefrBadge level={item.cefr} />
          <AudioButton word={item.word} accent="us" size="sm" />
          <AudioButton word={item.word} accent="uk" size="sm" />
        </div>
        <h2 className="display text-display-md break-words">{item.word}</h2>
        {item.ipaUk && <p className="font-mono text-sm text-soft mt-2">{item.ipaUk}</p>}
        <p className="text-xs text-soft mt-3">{t("practice.whichMeaning")}</p>
      </div>

      {!opts ? (
        <div className="grid grid-cols-2 gap-2 animate-pulse">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-2xl bg-ink/5" />
          ))}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-2.5">
          {opts.options.map((opt, i) => {
            const isCorrect = i === opts.correctIndex;
            const isPicked = selected === i;
            const shown = selected !== null;
            return (
              // No `disabled` attribute here on purpose: a genuinely disabled
              // control emits no `pointerdown` at all, which would make this —
              // the largest tap target on screen — unable to satisfy "tap
              // anywhere to advance" during the reveal. `pick()` already
              // guards re-submission internally (`if (selected !== null...)
              // return`), so `aria-disabled` + a reveal-only style branch that
              // drops the hover affordance stands in for it: still reads as
              // locked, still cannot be re-submitted, but a tap still reaches
              // window and advances the card.
              <button
                key={i}
                aria-disabled={shown}
                onClick={() => pick(i)}
                className={`text-left rounded-2xl border p-4 transition-all flex items-start gap-3 ${
                  shown && isCorrect
                    ? "border-moss-500 bg-moss-500/10 cursor-default"
                    : shown && isPicked
                      ? "border-red-400 bg-red-400/10 cursor-default"
                      : shown
                        ? "border-line opacity-60 cursor-default"
                        : "border-line hover:border-ink/30 hover:bg-paper-200/40"
                }`}
              >
                <span className="text-xs font-mono text-soft mt-0.5">{LETTERS[i]}</span>
                <span className="text-sm leading-snug">{opt}</span>
                {shown && isCorrect && <CheckCircle2 size={16} className="ml-auto text-moss-500" />}
                {shown && isPicked && !isCorrect && (
                  <XCircle size={16} className="ml-auto text-red-400" />
                )}
              </button>
            );
          })}
        </div>
      )}

      {reveal !== "hidden" && (
        <FeedbackStrip reveal={reveal} example={item.example} exampleVi={item.exampleVi} />
      )}
    </div>
  );
}
