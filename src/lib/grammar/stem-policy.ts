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
const QUOTE_START = /^["“‘`']/;
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

/** How many ": " separators the text has outside HTML tags. */
function colonCount(text: string): number {
  let n = 0;
  let from = 0;
  for (;;) {
    const at = firstColon(text.slice(from));
    if (at === -1) return n;
    n++;
    from += at + 1;
  }
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
  // "He said: `I'm here`." - reported-speech stems quote a short sentence, and
  // that quote is the specimen however few words it has.
  if (QUOTE_START.test(specimen) && wordCount(cue) >= 1 && wordCount(specimen) >= 1) return { cue, specimen };
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
    // The Vietnamese cue is whatever precedes the matching colon. A different
    // colon count means the translator added or dropped a separator ("Ví dụ:"),
    // and the first colon then no longer marks the cue/specimen boundary.
    if (colonCount(vi) !== colonCount(en)) return null;
    const colon = firstColon(vi);
    if (colon === -1) return null;
    let viCue = vi.slice(0, colon).trim();
    const cueQuotes = quotedSpans(hybrid.cue);
    if (cueQuotes.length > 0 && !hasExactSpans(cueQuotes, viCue)) {
      const restored = restoreQuotedSpans(cueQuotes, viCue);
      if (restored === null) return null;
      viCue = restored;
    }
    if (!VI_DIACRITIC.test(viCue)) return null;
    return `${viCue}: ${hybrid.specimen}`;
  }

  if (!VI_DIACRITIC.test(vi)) return null;
  const wanted = quotedSpans(en);
  let out = vi;
  if (!hasExactSpans(wanted, out)) {
    // The model translated a quoted target word ("mouse" -> "chuột"): put the
    // English back, but only when both sides quote the same number of spans so
    // each one has an unambiguous partner.
    const restored = restoreQuotedSpans(wanted, out);
    if (restored === null) return null;
    out = restored;
  }
  return VI_DIACRITIC.test(out) ? out : null;
}

const VI_QUOTE = /(["“])([^"”]+)(["”])/g;

/** Every English quoted span appears, as a whole quoted span, in the Vietnamese. */
function hasExactSpans(wanted: string[], vi: string): boolean {
  const have = [...vi.matchAll(VI_QUOTE)].map((m) => m[2].trim());
  return wanted.every((w) => have.includes(w));
}

/**
 * Replace the content of the n-th quoted span of `vi` with the n-th English
 * one. Refuses (null) when the counts differ, or when a Vietnamese span already
 * equals a DIFFERENT English span (the translator reordered them, so position
 * no longer pairs them up).
 */
function restoreQuotedSpans(wanted: string[], vi: string): string | null {
  const found = [...vi.matchAll(VI_QUOTE)];
  if (found.length !== wanted.length) return null;
  for (let i = 0; i < found.length; i++) {
    const have = found[i][2].trim();
    if (have !== wanted[i] && wanted.includes(have)) return null;
  }
  let i = 0;
  return vi.replace(VI_QUOTE, (_m, open: string, _inner: string, close: string) => `${open}${wanted[i++]}${close}`);
}

/** ok only for a stem the policy would leave exactly as it is. */
export function checkStemVi(en: string, vi: string): CheckResult {
  if (isBlankStem(en)) return { ok: false, reason: "a fill-in-the-blank stem must stay English" };
  const repaired = repairStemVi(en, vi);
  if (repaired === null) return { ok: false, reason: "no usable Vietnamese instruction or a quoted word was translated" };
  if (repaired !== vi) return { ok: false, reason: "the English sentence inside the stem was translated" };
  return { ok: true };
}
