import type { ModeView, PracticeMode } from "@/lib/practice/types";
import { QuizMode } from "./quiz";
import { TypingMode } from "./typing";
import { DictationMode } from "./dictation";
import { FlashcardMode } from "./flashcard";

// Cloze and image-word arrive in Plan 3; until then this stays Partial.
export const MODE_VIEWS: Partial<Record<PracticeMode, ModeView>> = {
  quiz: QuizMode,
  typing: TypingMode,
  dictation: DictationMode,
  flashcard: FlashcardMode,
};
