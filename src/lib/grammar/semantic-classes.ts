// The 16 semantic span classes present in the imported lesson HTML (measured
// across all 292 lessons × 2 languages in Plan 1). Client-safe, zero-dep:
// the lesson reader's legend and the import-time sanitizer whitelist both
// read this list. It lives OUTSIDE lesson-html.ts on purpose — that module
// imports sanitize-html (a devDependency) and must never reach a client bundle.
export const SEMANTIC_SPAN_CLASSES = [
  "adjective", "adverb", "verb", "subject", "object", "auxiliary",
  "infinitive", "negation", "signal-word", "ending", "irregular-past",
  "irregular-participle", "place", "mistake", "consonant", "vowel",
] as const;

export type SemanticSpanClass = (typeof SEMANTIC_SPAN_CLASSES)[number];

// The classes worth a legend chip, in display order. The conjugation-table
// helpers (ending, irregular-*) and the rare phonetics pair are colored in CSS
// but not chipped — an 8-chip legend already covers what a reader must decode.
export const SEMANTIC_LEGEND: { cls: SemanticSpanClass; labelKey: string }[] = [
  { cls: "subject", labelKey: "grammar.legend.subject" },
  { cls: "verb", labelKey: "grammar.legend.verb" },
  { cls: "auxiliary", labelKey: "grammar.legend.auxiliary" },
  { cls: "infinitive", labelKey: "grammar.legend.infinitive" },
  { cls: "object", labelKey: "grammar.legend.object" },
  { cls: "adjective", labelKey: "grammar.legend.adjective" },
  { cls: "adverb", labelKey: "grammar.legend.adverb" },
  { cls: "negation", labelKey: "grammar.legend.negation" },
];
