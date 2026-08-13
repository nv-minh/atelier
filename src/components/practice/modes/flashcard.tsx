"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Flashcard, type Card } from "@/components/study/flashcard";
import { getRatingPreviewsClient } from "@/components/study/preview-client";
import type { RatingPreview } from "@/components/study/rating-buttons";
import type { ModeViewProps, PracticeItem, Rating } from "@/lib/practice/types";
import { playSound } from "@/lib/sound";

// The Flashcard component predates PracticeItem and is shared with cram-session
// and topic-viewer, so its `Card` shape is left alone and adapted here. The only
// real difference: Card names the word id `id`, PracticeItem names it `wordId`.
function toCard(item: PracticeItem): Card {
  return {
    cardId: item.cardId,
    id: item.wordId,
    word: item.word,
    cefr: item.cefr,
    typeEn: item.typeEn,
    typeVi: item.typeVi,
    ipaUk: item.ipaUk,
    ipaUs: item.ipaUs,
    definitionEn: item.definitionEn,
    definitionVi: item.definitionVi,
    extraDefs: item.extraDefs,
    example: item.example,
    exampleVi: item.exampleVi,
    synonyms: item.synonyms,
    antonyms: item.antonyms,
    imageUrl: item.imageUrl,
    audioUk: item.audioUk,
    audioUs: item.audioUs,
    starred: item.starred,
  };
}

export function FlashcardMode({ item, reveal, onAnswer, direction = "forward" }: ModeViewProps) {
  const [flipped, setFlipped] = useState(false);
  const [previews, setPreviews] = useState<RatingPreview[]>([]);
  const startedAtRef = useRef(Date.now());
  const card = useMemo(() => toCard(item), [item]);

  useEffect(() => {
    setFlipped(false);
    startedAtRef.current = Date.now();
    setPreviews(getRatingPreviewsClient(item));
  }, [item]);

  // Declared with useCallback BEFORE the keydown effect that calls it — a plain
  // `const rate` declared after the effect works at runtime but reads as a
  // use-before-define and trips lint rules.
  const rate = useCallback(
    (rating: Rating) => {
      if (reveal !== "hidden") return;
      onAnswer({
        correct: rating >= 3,
        signals: {
          correct: rating >= 3,
          elapsedMs: Date.now() - startedAtRef.current,
          wordLength: item.word.length,
          cardState: item.state,
          wasHidden: false,
          selfRated: rating,
        },
      });
    },
    [reveal, onAnswer, item.word.length, item.state]
  );

  // Space/Enter flips; 1–4 rate. The shell's global advance listener only runs
  // while an answer is revealed, so it cannot swallow these.
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (reveal !== "hidden") return;
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        setFlipped((f) => {
          playSound("flip");
          return !f;
        });
        return;
      }
      if (!flipped) return;
      if (["1", "2", "3", "4"].includes(e.key)) rate(Number(e.key) as Rating);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [flipped, reveal, rate]);

  return (
    <div className="w-full max-w-4xl mx-auto">
      <Flashcard
        card={card}
        direction={direction}
        flipped={flipped}
        onFlip={() =>
          setFlipped((f) => {
            playSound("flip");
            return !f;
          })
        }
        previews={previews}
        onRate={(r) => rate(r as Rating)}
        ratingDisabled={reveal !== "hidden"}
      />
    </div>
  );
}
