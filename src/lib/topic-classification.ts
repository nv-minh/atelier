// Hand classification of words into the thematic topics. Keyword matching was
// retired (see scripts/topics/audit-topics.ts: ~20% precision); the result of the
// reviewed classification lives in data/topics/classification.json and is applied
// by prisma/assign-topics.ts.

export const MAX_TOPICS_PER_WORD = 2;

/** Lines "word<TAB>slug,slug"; an empty slug list means the word fits no topic. */
export function parseAnswers(text: string): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const line of text.split("\n")) {
    const tab = line.indexOf("\t");
    if (tab <= 0) continue;
    const slugs = line.slice(tab + 1).split(",").map((s) => s.trim()).filter(Boolean);
    out.set(line.slice(0, tab).trim(), slugs);
  }
  return out;
}

/** Problems that make an answer set unusable; empty when it is complete and valid. */
export function validateAnswers(sliceWords: string[], answers: Map<string, string[]>, allowed: ReadonlySet<string>): string[] {
  const problems: string[] = [];
  const inSlice = new Set(sliceWords);
  for (const w of sliceWords) if (!answers.has(w)) problems.push(`${w}: missing`);
  for (const [w, slugs] of answers) {
    if (!inSlice.has(w)) {
      problems.push(`${w}: not in slice`);
      continue;
    }
    for (const s of slugs) if (!allowed.has(s)) problems.push(`${w}: unknown topic "${s}"`);
    if (new Set(slugs).size !== slugs.length) problems.push(`${w}: duplicate topic`);
    if (slugs.length > MAX_TOPICS_PER_WORD) problems.push(`${w}: more than ${MAX_TOPICS_PER_WORD} topics`);
  }
  return problems;
}
