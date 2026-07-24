// Cloze helper — blank the target word (and simple inflections) in an example sentence.

function escapeReg(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Returns the example with the first occurrence of `word` (word + trailing letters,
// so plurals/-ed/-ing match) replaced by a blank. null if nothing to blank.
export function buildCloze(example: string | null | undefined, word: string | null | undefined): string | null {
  if (!example || !word) return null;
  const w = word.trim();
  if (!w) return null;
  try {
    const re = new RegExp(`\\b${escapeReg(w)}[\\w'-]*`, "i");
    if (re.test(example)) {
      return example.replace(re, "_______");
    }
  } catch {}
  return null; // word not present → caller falls back to forward direction
}
