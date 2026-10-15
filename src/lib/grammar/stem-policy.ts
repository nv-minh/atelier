// Language policy for exercise stems (questionVi), the rule the learner sees:
//   - a fill-in-the-blank stem IS the exercise, so it stays English (no VI at all);
//   - a hybrid stem "<instruction>: <sentence>" is Vietnamese instruction plus the
//     English sentence verbatim ("Chuyển câu này sang câu Bị động: Britain kept ...");
//   - an instruction-only stem is Vietnamese, but any word the EN stem quotes
//     ("Aircraft") must survive in it untranslated.
// Pure on purpose: no prisma, so vitest covers it and the repair script reuses it.
import { VI_DIACRITIC, isBlankStem, type CheckResult } from "./vi-repair";

export type StemParts = { cue: string; specimen: string };

const TAGS = /<[^>]+>/g;
const wordCount = (s: string): number => s.replace(TAGS, " ").split(/\s+/).filter(Boolean).length;

/** Index of the first ": " (colon + whitespace) that is not inside an HTML tag, or -1. */
function firstColon(text: string): number {
  let inTag = false;
  for (let i = 0; i < text.length - 1; i++) {
    const ch = text[i];
    if (ch === "<") inTag = true;
    else if (ch === ">") inTag = false;
    else if (!inTag && ch === ":" && /\s/.test(text[i + 1])) return i;
  }
  return -1;
}

/**
 * Split "<instruction>: <sentence>". Needs a cue of at least 2 words and a
 * sentence of at least 3, otherwise it is not a hybrid ("Note: yes").
 */
export function splitHybridStem(en: string): StemParts | null {
  const at = firstColon(en);
  if (at === -1) return null;
  const cue = en.slice(0, at).trim();
  const specimen = en.slice(at + 1).trim();
  if (wordCount(cue) < 2 || wordCount(specimen) < 3) return null;
  return { cue, specimen };
}

/** The words an EN stem puts in quotes ("..." or “...”), without the quote marks. */
export function quotedSpans(en: string): string[] {
  const out: string[] = [];
  for (const m of en.matchAll(/"([^"]+)"|“([^”]+)”/g)) out.push((m[1] ?? m[2]).trim());
  return out;
}

/**
 * The questionVi value the policy wants stored for this stem: null when the
 * stem must stay English or the Vietnamese cannot be trusted.
 */
export function repairStemVi(en: string, vi: string | null): string | null {
  if (isBlankStem(en)) return null;
  if (vi === null) return null;

  const hybrid = splitHybridStem(en);
  if (hybrid) {
    const colon = firstColon(vi);
    if (colon === -1) return null;
    const viCue = vi.slice(0, colon).trim();
    if (!VI_DIACRITIC.test(viCue)) return null;
    return `${viCue}: ${hybrid.specimen}`;
  }

  if (!VI_DIACRITIC.test(vi)) return null;
  if (quotedSpans(en).some((span) => !vi.includes(span))) return null;
  return vi;
}

/** ok only for a stem the policy would leave exactly as it is. */
export function checkStemVi(en: string, vi: string): CheckResult {
  if (isBlankStem(en)) return { ok: false, reason: "a fill-in-the-blank stem must stay English" };
  const repaired = repairStemVi(en, vi);
  if (repaired === null) return { ok: false, reason: "no usable Vietnamese instruction or a quoted word was translated" };
  if (repaired !== vi) return { ok: false, reason: "the English sentence inside the stem was translated" };
  return { ok: true };
}
