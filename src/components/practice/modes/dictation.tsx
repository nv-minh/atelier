"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Volume2 } from "lucide-react";
import { CefrBadge } from "@/components/cefr-badge";
import { useI18n } from "@/components/i18n-provider";
import { FeedbackStrip } from "@/components/practice/feedback-strip";
import { Button } from "@/components/ui/button";
import { gradeTyping } from "@/lib/utils";
import { playWord } from "@/lib/tts";
import type { ModeViewProps } from "@/lib/practice/types";

const SPEEDS = [1, 0.75, 0.5];

export function DictationMode({ item, reveal, onAnswer }: ModeViewProps) {
  const { t } = useI18n();
  const [typed, setTyped] = useState("");
  const [speed, setSpeed] = useState(1);
  const startedAtRef = useRef(Date.now());
  const playsRef = useRef(0);
  const slowedRef = useRef(false);
  const shown = reveal !== "hidden";

  const play = useCallback(() => {
    playsRef.current += 1;
    playWord(item.word, { accent: "us", rate: speed }).catch(() => {});
  }, [item.word, speed]);

  useEffect(() => {
    setTyped("");
    setSpeed(1);
    startedAtRef.current = Date.now();
    playsRef.current = 0;
    slowedRef.current = false;
    const timer = setTimeout(() => {
      playsRef.current += 1;
      playWord(item.word, { accent: "us", rate: 1 }).catch(() => {});
    }, 350);
    return () => clearTimeout(timer);
  }, [item.cardId, item.word]);

  const setSpeedTracked = (s: number) => {
    if (s < 1) slowedRef.current = true;
    setSpeed(s);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (shown || !typed.trim()) return;
    const res = gradeTyping(typed, item.word, item.synonyms);
    onAnswer({
      correct: res.correct,
      signals: {
        correct: res.correct,
        elapsedMs: Date.now() - startedAtRef.current,
        wordLength: item.word.length,
        cardState: item.state,
        wasHidden: false,
        typoAccepted: res.acceptedAs === "typo",
        // The auto-play on mount counts as play 1, so "replayed" means > 1.
        replays: playsRef.current,
        slowedDown: slowedRef.current,
      },
    });
  };

  return (
    <div className="max-w-xl mx-auto">
      <div className="text-center mb-8">
        <div className="flex items-center justify-center gap-2 mb-4">
          <CefrBadge level={item.cefr} />
        </div>
        <p className="text-xs text-fg-muted font-mono mb-3">{t("practice.listenType")}</p>
        <Button
          onClick={play}
          data-nosound
          variant="primary"
          size="lg"
          // Overrides the lg preset's height/padding: this is a large
          // icon-only "play audio" control, not a text CTA — same 80px
          // square it always was, just the primary color role now.
          className="mx-auto h-20 w-20 p-0"
        >
          <Volume2 size={28} />
        </Button>
        <div className="flex justify-center gap-2 mt-4">
          {SPEEDS.map((s) => (
            <button
              key={s}
              onClick={() => setSpeedTracked(s)}
              className={`text-xs rounded-full px-2.5 py-1 border transition-colors ${
                speed === s ? "border-ember text-ember" : "border-hairline/10 text-fg-muted"
              }`}
            >
              {s === 1 ? "1×" : `${s}×`}
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={submit}>
        <input
          autoFocus
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          disabled={shown}
          placeholder={t("practice.spellHeard")}
          className={`w-full text-center text-2xl font-mono rounded-2xl border bg-surface px-4 py-4 outline-none transition-colors ${
            shown
              ? reveal === "correct"
                ? "border-moss-500"
                : "border-red-400"
              : "border-hairline/10 focus:border-ember"
          }`}
        />
        {!shown && (
          <Button type="submit" data-nosound variant="primary" size="md" className="mt-3 w-full">
            {t("practice.check")} <span className="opacity-50 ml-1">↵</span>
          </Button>
        )}
      </form>

      {shown && (
        <div className="mt-4 text-center">
          <p className="text-sm text-fg-muted">
            <span className="display text-xl text-fg">{item.word}</span>
            <span className="font-mono text-xs ml-2">{item.ipaUs || item.ipaUk}</span>
          </p>
          {item.definitionEn && <p className="text-xs text-fg-muted mt-1">{item.definitionEn}</p>}
          {item.definitionVi && <p className="text-xs text-fg-muted/70 mt-0.5">{item.definitionVi}</p>}
        </div>
      )}

      {reveal !== "hidden" && (
        <FeedbackStrip
          reveal={reveal === "correct" ? "correct" : "wrong"}
          example={item.example}
          exampleVi={item.exampleVi}
        />
      )}
    </div>
  );
}
