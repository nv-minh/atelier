// Shared client/server types for grammar answer sessions. Plan 3 extends
// GrammarSource with "practice" and "confused" — the answer API whitelists
// against GRAMMAR_SOURCES so the union is the single source of truth.
export const GRAMMAR_SOURCES = ["topic_test"] as const;
export type GrammarSource = (typeof GRAMMAR_SOURCES)[number];

// One question as the session UI sees it. answerIndex deliberately ABSENT:
// grading happens server-side in /api/grammar/answer, so the payload can't be
// read out of devtools to cheat, and the server stays the XP authority.
export type GrammarSessionItem = {
  id: number;
  questionEn: string;
  questionVi: string | null;
  choices: string[];
  repeat: boolean; // already answered correctly before — replays earn 0 XP
};
