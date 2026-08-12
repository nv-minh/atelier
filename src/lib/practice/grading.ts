import { RATING } from "./types";
import type { GradeSignals, PracticeMode, Rating } from "./types";

/**
 * Map how an answer was produced onto an FSRS grade.
 *
 * PLAN 1 SCOPE: this body deliberately reproduces the CURRENT behaviour of the
 * app — correct → Good, wrong → Again — so migrating the four modes onto the
 * shell changes nobody's review schedule. The signals beyond `correct` and
 * `selfRated` are already collected by the modes and simply unused here.
 *
 * PLAN 2 (spec §6) replaces this body with the two-tier rule (base rating from
 * signals, then a cap of Good for Relearning cards and for items where the tab
 * was hidden) and adds the tests for it. Nothing outside this function changes.
 */
export function gradeAnswer(_mode: PracticeMode, s: GradeSignals): Rating {
  if (s.selfRated) return s.selfRated;
  if (!s.correct) return RATING.Again;
  return RATING.Good;
}
