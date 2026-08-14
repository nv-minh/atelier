import type { ReactElement } from "react";

export type PracticeMode = "quiz" | "typing" | "dictation" | "flashcard" | "cloze" | "image-word";

// Numeric FSRS grades. MUST stay identical to ts-fsrs's Rating enum — locked by a
// test in grading.test.ts. Declared locally (not imported from @/lib/fsrs) so this
// module stays free of ts-fsrs, which keeps lib/practice pure and cheap to test.
export const RATING = { Again: 1, Hard: 2, Good: 3, Easy: 4 } as const;
export type Rating = 1 | 2 | 3 | 4;

// One card as every mode sees it. Superset of what the old PracticeCard and the
// Flashcard `Card` type carried, so a single type serves all six modes.
export type PracticeItem = {
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
  extraDefs: string[];
  example: string | null;
  exampleVi: string | null;
  synonyms: string[];
  antonyms: string[];
  imageUrl: string | null;
  audioUk: string | null;
  audioUs: string | null;
  starred: boolean;
  isNew: boolean;
  // FSRS snapshot — flashcard needs it for interval previews, grading needs
  // `state` for the Relearning cap (spec §6).
  state: number;
  reps: number;
  lapses: number;
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  due: string; // ISO
  lastReview: string | null; // ISO
  // Precomputed at session-build time for quiz mode (see session-plan.ts) so
  // QuizMode doesn't fire one client round trip (+ 2 DB queries) per card.
  // Undefined for every non-quiz mode, and quiz falls back to the live
  // /api/study/quiz-options endpoint if this is missing (e.g. too few peer
  // words at this CEFR level to build 3 distractors).
  quizOptions?: { options: string[]; correctIndex: number };
};

// What a mode observes about how the answer was produced. Consumed only by
// gradeAnswer. Fields beyond `correct`/`elapsedMs`/`wordLength`/`cardState`/
// `wasHidden` are per-mode and optional.
export type GradeSignals = {
  correct: boolean;
  elapsedMs: number;
  wordLength: number;
  cardState: number;
  wasHidden: boolean;
  hintUsed?: boolean;
  typoAccepted?: boolean;
  replays?: number;
  slowedDown?: boolean;
  changedAnswer?: boolean;
  selfRated?: Rating;
};

export type ItemResult = {
  cardId: string;
  wordId: string;
  word: string;
  correct: boolean;
  rating: Rating;
};

export type SessionPlan = {
  items: PracticeItem[];
  remaining: { due: number; new: number };
  sizeUsed: number;
};

// The shell↔mode contract (spec §4). A mode renders ONE item and reports back.
// It never touches FSRS, never calls the review API, never keeps score.
// `onSkip` is a plan-level refinement of the spec contract: it is how a mode
// reports an item it cannot render (spec §11, defect D6).
export type ModeViewProps = {
  item: PracticeItem;
  reveal: "hidden" | "correct" | "wrong";
  onAnswer: (r: { correct: boolean; signals: GradeSignals }) => void;
  onSkip: (reason: string) => void;
  // Card face for the modes that have one (flashcard). Ignored by the others.
  // It lives here rather than as an extra prop on one mode because MODE_VIEWS is
  // typed as ModeView — a prop the type doesn't know about is a compile error at
  // the shell's render site.
  direction?: "forward" | "reverse" | "cloze";
};

export type ModeView = (p: ModeViewProps) => ReactElement;
