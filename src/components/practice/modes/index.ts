import type { ModeView, PracticeMode } from "@/lib/practice/types";
import { QuizMode } from "./quiz";
import { TypingMode } from "./typing";

// Partial while the migration is in flight — Task 7 fills in the remaining modes
// and this becomes a complete Record.
export const MODE_VIEWS: Partial<Record<PracticeMode, ModeView>> = {
  quiz: QuizMode,
  typing: TypingMode,
};
