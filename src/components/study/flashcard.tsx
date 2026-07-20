"use client";

import { motion } from "motion/react";
import { AudioButton } from "@/components/audio-button";
import { CefrBadge } from "@/components/cefr-badge";
import { RatingButtons, type RatingPreview } from "./rating-buttons";
import { useI18n } from "@/components/i18n-provider";
import { buildCloze } from "@/lib/cloze";
import { WordImage, ImageSearchLink } from "@/components/word-image";

export type Card = {
  cardId: string;
  word: string;
  cefr: string;
  typeEn: string | null;
  typeVi: string | null;
  ipaUk: string | null;
  ipaUs: string | null;
  definitionEn: string | null;
  definitionVi: string | null;
  extraDefs: string[];
  example: string | null;
  exampleVi: string | null;
  synonyms: string[];
  antonyms: string[];
  imageUrl: string | null;
  audioUk: string | null;
  audioUs: string | null;
};

export function Flashcard({
  card,
  direction = "forward",
  flipped,
  onFlip,
  previews,
  onRate,
  ratingDisabled,
}: {
  card: Card;
  direction?: "forward" | "reverse" | "cloze";
  flipped: boolean;
  onFlip: () => void;
  previews: RatingPreview[];
  onRate: (r: number) => void;
  ratingDisabled?: boolean;
}) {
  const { t } = useI18n();
  // cloze only works if we can blank the word in the example; else fall back to forward
  const clozeText = buildCloze(card.example, card.word);
  const dir: "forward" | "reverse" | "cloze" = direction === "cloze" && clozeText ? "cloze" : direction === "reverse" ? "reverse" : "forward";
  return (
    <div className="w-full">
      <div className="perspective-1000 select-none">
        <motion.div
          className="relative preserve-3d cursor-pointer w-full"
          style={{ minHeight: "min(64vh, 520px)" }}
          animate={{ rotateY: flipped ? 180 : 0 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          onClick={() => !flipped && onFlip()}
        >
          {/* FRONT */}
          <FrontFace card={card} dir={dir} clozeText={clozeText} />
          {/* BACK */}
          <BackFace card={card} dir={dir} clozeText={clozeText} />
        </motion.div>
      </div>

      <div className="mt-6 sm:mt-8">
        {!flipped ? (
          <motion.button
            key="flip"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onClick={onFlip}
            className="w-full rounded-2xl bg-ink text-paper py-3.5 font-medium hover:opacity-90 transition-opacity"
          >
            {t("study.revealAnswer")} <span className="opacity-50 ml-1">↵</span>
          </motion.button>
        ) : (
          <RatingButtons previews={previews} onRate={onRate} disabled={ratingDisabled} />
        )}
      </div>
    </div>
  );
}

function FrontFace({ card, dir, clozeText }: { card: Card; dir: "forward" | "reverse" | "cloze"; clozeText: string | null }) {
  const { t } = useI18n();
  return (
    <div className="backface-hidden absolute inset-0 card-atelier p-6 sm:p-10 flex flex-col">
      <div className="flex items-center justify-between">
        <CefrBadge level={card.cefr} />
        {dir === "forward" && (
          <div className="flex gap-1.5">
            <AudioButton word={card.word} accent="uk" size="sm" />
            <AudioButton word={card.word} accent="us" size="sm" />
          </div>
        )}
        {dir !== "forward" && <span className="pill text-soft">{dir === "reverse" ? t("study.dirReverse") : t("study.dirCloze")}</span>}
      </div>

      <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 px-2">
        {dir === "forward" && (
          <>
            <motion.h2
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="display text-display-md sm:text-display-lg break-words"
            >
              {card.word}
            </motion.h2>
            {(card.ipaUk || card.ipaUs) && (
              <p className="font-mono text-sm sm:text-base text-soft">{card.ipaUk || card.ipaUs}</p>
            )}
            {card.typeVi && <span className="pill text-soft mt-1">{card.typeVi}</span>}
          </>
        )}
        {dir === "reverse" && (
          <>
            <p className="text-lg sm:text-2xl leading-relaxed text-ink max-w-lg">{card.definitionEn}</p>
            {card.definitionVi && <p className="text-sm text-soft max-w-md">{card.definitionVi}</p>}
            {card.typeVi && <span className="pill text-soft mt-1">{card.typeVi}</span>}
          </>
        )}
        {dir === "cloze" && clozeText && (
          <p className="display text-xl sm:text-3xl leading-relaxed text-ink max-w-lg">{clozeText}</p>
        )}
      </div>

      <p className="text-center text-xs text-soft/70">
        {t("study.tapToReveal")} · <span className="font-mono">↵</span>
      </p>
    </div>
  );
}

function BackFace({ card, dir, clozeText }: { card: Card; dir: "forward" | "reverse" | "cloze"; clozeText: string | null }) {
  const { t } = useI18n();
  return (
    <div className="backface-hidden rotate-y-180 absolute inset-0 card-atelier p-6 sm:p-10 overflow-y-auto scrollbar-hide">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-baseline gap-2">
          <span className="display text-xl sm:text-2xl">{card.word}</span>
          {card.ipaUk && <span className="font-mono text-xs text-soft">{card.ipaUk}</span>}
        </div>
        <CefrBadge level={card.cefr} />
      </div>

      {card.definitionEn && (
        <p className="text-base sm:text-lg leading-relaxed text-ink mb-1.5">
          {card.definitionEn}
        </p>
      )}
      {card.definitionVi && (
        <p className="text-sm sm:text-base leading-relaxed text-soft mb-4">
          {card.definitionVi}
        </p>
      )}

      {card.example && (
        <blockquote className="border-l-2 border-ember/40 pl-3 my-4">
          <p className="display display-it text-base sm:text-lg text-soft leading-snug">
            “{card.example}”
          </p>
          {card.exampleVi && (
            <p className="text-xs sm:text-sm text-soft/70 leading-snug mt-1.5 not-italic">
              {card.exampleVi}
            </p>
          )}
        </blockquote>
      )}

      <div className="grid sm:grid-cols-2 gap-3 mt-4">
        {card.synonyms.length > 0 && (
          <div>
            <p className="text-[10px] uppercase tracking-wider text-soft font-semibold mb-1.5">{t("study.synonyms")}</p>
            <div className="flex flex-wrap gap-1.5">
              {card.synonyms.filter((s) => s.toLowerCase() !== card.word.toLowerCase()).slice(0, 5).map((s) => (
                <span key={s} className="text-xs rounded-full bg-moss-500/10 text-moss-600 dark:text-moss-400 px-2 py-0.5">
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}
        {card.antonyms.length > 0 && (
          <div>
            <p className="text-[10px] uppercase tracking-wider text-soft font-semibold mb-1.5">{t("study.antonyms")}</p>
            <div className="flex flex-wrap gap-1.5">
              {card.antonyms.slice(0, 4).map((s) => (
                <span key={s} className="text-xs rounded-full bg-red-500/10 text-red-500 px-2 py-0.5">
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {card.extraDefs.length > 0 && (
        <details className="mt-4 group">
          <summary className="text-xs text-soft cursor-pointer hover:text-ink list-none flex items-center gap-1">
            <span className="transition-transform group-open:rotate-90">▸</span> {t("study.moreDefs")}
          </summary>
          <ul className="mt-2 space-y-1 text-sm text-soft pl-4">
            {card.extraDefs.slice(0, 3).map((d, i) => (
              <li key={i} className="leading-relaxed">{d}</li>
            ))}
          </ul>
        </details>
      )}

      {/* inline image when a real one exists */}
      <div className="mt-4">
        <WordImage imageUrl={card.imageUrl} word={card.word} maxH="max-h-44" />
      </div>

      <div className="flex gap-2 mt-5 pt-4 border-t border-line">
        <AudioButton word={card.word} accent="uk" size="sm" />
        <AudioButton word={card.word} accent="us" size="sm" />
        <ImageSearchLink imageUrl={card.imageUrl} className="ml-auto" />
      </div>
    </div>
  );
}
