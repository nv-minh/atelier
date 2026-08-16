"use client";

import { useEffect, useRef, useState } from "react";
import { AudioButton } from "@/components/audio-button";
import { CefrStamp } from "@/components/ui/cefr-stamp";
import { useI18n } from "@/components/i18n-provider";
import { FeedbackStrip } from "@/components/practice/feedback-strip";
import { Button } from "@/components/ui/button";
import { gradeTyping } from "@/lib/utils";
import type { ModeViewProps } from "@/lib/practice/types";

export function TypingMode({ item, reveal, onAnswer }: ModeViewProps) {
  const { t } = useI18n();
  const [typed, setTyped] = useState("");
  const startedAtRef = useRef(Date.now());
  const shown = reveal !== "hidden";

  useEffect(() => {
    setTyped("");
    startedAtRef.current = Date.now();
  }, [item.cardId]);

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
        // A 1-char typo means the spelling was fuzzy; a synonym match is a fully
        // legitimate answer and must NOT be downgraded.
        typoAccepted: res.acceptedAs === "typo",
      },
    });
  };

  return (
    <div className="max-w-xl mx-auto">
      <div className="text-center mb-8">
        <CefrStamp level={item.cefr} className="mb-4" />
        <p className="text-xs text-fg-muted font-mono mb-2">{t("practice.typeFor")}</p>
        <p className="display text-xl sm:text-2xl leading-snug">{item.definitionEn}</p>
        {item.typeVi && <p className="text-xs text-fg-muted mt-2">{item.typeVi}</p>}
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
          placeholder={t("practice.typeWord")}
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
            {t("practice.answer")} <span className="display text-xl text-fg">{item.word}</span>
            <span className="font-mono text-xs ml-2">{item.ipaUk}</span>
          </p>
          <div className="flex justify-center gap-1.5 mt-2">
            <AudioButton word={item.word} accent="us" size="sm" />
            <AudioButton word={item.word} accent="uk" size="sm" />
          </div>
          {item.definitionVi && <p className="text-xs text-fg-muted/70 mt-2">{item.definitionVi}</p>}
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
