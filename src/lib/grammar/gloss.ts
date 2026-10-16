// "EN - VI" gloss for English study sentences: the Vietnamese translation is
// stored apart from the English text (glossVi columns) and joined only for
// display, so the protected-zone gates on contentViHtml / choicesEn never see it.
// Pure on purpose: no prisma, covered by vitest, reused by the export/import scripts.
import { VI_DIACRITIC, isBlankStem, type CheckResult } from "./vi-repair";
import { splitHybridStem } from "./stem-policy";

const BLANK_RUNS = /_{2,}|\.{4,}|…/g;
const wordCount = (s: string): number => s.replace(/<[^>]+>/g, " ").replace(BLANK_RUNS, " ").split(/\s+/).filter((w) => /[A-Za-z]/.test(w)).length;

/** "English - Vietnamese", or the English alone when there is no gloss. */
export function joinGloss(en: string, vi: string | null | undefined): string {
  const gloss = (vi ?? "").trim();
  return gloss ? `${en} - ${gloss}` : en;
}

/** A gloss must be Vietnamese plain text that keeps the English blanks intact. */
export function checkGloss(en: string, vi: string): CheckResult {
  const text = vi.trim();
  if (!text) return { ok: false, reason: "empty" };
  if (/<[^>]*>/.test(text)) return { ok: false, reason: "contains markup" };
  if (!VI_DIACRITIC.test(text)) return { ok: false, reason: "no Vietnamese diacritic" };
  const enBlanks = en.match(BLANK_RUNS) ?? [];
  const viBlanks = text.match(BLANK_RUNS) ?? [];
  if (enBlanks.join("|") !== viBlanks.join("|")) return { ok: false, reason: "blanks differ from the English" };
  if (en.length >= 12 && (text.length < en.length * 0.3 || text.length > en.length * 3)) {
    return { ok: false, reason: "length is implausible for a translation" };
  }
  return { ok: true };
}

/**
 * The English sentence of a stem that needs a gloss, or null when there is
 * nothing to translate: a stem of only blanks, or an instruction that is
 * already Vietnamese. A hybrid stem ("<cue>: <sentence>") yields the sentence.
 */
export function stemGlossTarget(questionEn: string, questionVi: string | null): string | null {
  if (wordCount(questionEn) < 3) return null;
  const hybrid = splitHybridStem(questionEn);
  // A blank before the colon means the cue IS the exercise sentence.
  if (hybrid && !isBlankStem(hybrid.cue)) return wordCount(hybrid.specimen) >= 1 ? hybrid.specimen : null;
  if (isBlankStem(questionEn) || questionVi === null) return questionEn;
  return null;
}

/**
 * Per choice: the sentence to translate, or null. Words, word forms
 * ("more hotter / most hottest") and adjective lists have no translation worth
 * showing; a sentence ends in terminal punctuation or runs to six words.
 */
export function choiceGlossTargets(choices: string[]): Array<string | null> {
  return choices.map((c) => {
    const n = wordCount(c);
    if (n < 3) return null;
    return /[.!?]["')]?\s*$/.test(c) || n >= 6 ? c : null;
  });
}

/** What the session shows as the question: Vietnamese mode adds " - <gloss>" after the stem. */
export function buildStemDisplay(
  questionEn: string,
  questionVi: string | null,
  stemGlossVi: string | null,
  lang: "vi" | "en"
): string {
  if (lang !== "vi") return questionEn;
  return joinGloss(questionVi ?? questionEn, stemGlossVi);
}

/** What an answer button shows: the English choice, plus " - <gloss>" in Vietnamese mode. */
export function buildChoiceDisplay(choice: string, gloss: string | null | undefined, lang: "vi" | "en"): string {
  return lang === "vi" ? joinGloss(choice, gloss) : choice;
}

/**
 * Choice glosses are all-or-nothing per question: if a sentence choice has no
 * translation while its siblings do, the lone glossed choice marks the answer
 * (the unglossed ones were skipped as ungrammatical distractors). Returns the
 * glosses to show, or null when they must all be hidden.
 */
export function normalizeChoiceGlosses(
  choices: string[],
  glosses: Array<string | null> | null
): Array<string | null> | null {
  const targets = choiceGlossTargets(choices);
  if (!targets.some((t) => t !== null)) return null;
  if (!glosses) return null;
  for (let i = 0; i < targets.length; i++) {
    if (targets[i] !== null && !(glosses[i] ?? "").trim()) return null;
  }
  return glosses;
}
