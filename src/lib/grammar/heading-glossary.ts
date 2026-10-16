// Tier-0 glossary and classifier for lesson headings.
//
// The 2026-08-16 LLM round translated lesson bodies wholesale but skipped every
// heading that contained a protected span (234/292 lessons kept English
// headings; measured via scripts/grammar/audit-headings.ts). This module gives
// the deterministic half of the fix: the stock section labels — Form, Signal
// words, Use of the <tense>, Affirmative sentences… — that repeat across the
// corpus get fixed Vietnamese here, and the headings that are English STUDY
// MATERIAL (formulas, modal names, phrasal word-lists like "afraid of") are
// recognised as specimens so no translation round touches them.
//
// Terminology follows src/lib/grammar/catalog.ts (nameVi) and the i18n legend
// chips, so a heading says "Thì hiện tại đơn" everywhere the app does.
import { VI_DIACRITIC } from "./vi-repair";

// Tense names keep their catalog Vietnamese verbatim — catalog.ts is the
// product's single source for these spellings.
export const TENSE_NAMES_VI: Readonly<Record<string, string>> = {
  "Simple Present": "thì hiện tại đơn",
  "Present Continuous": "thì hiện tại tiếp diễn",
  "Present Progressive": "thì hiện tại tiếp diễn",
  "Present Perfect": "thì hiện tại hoàn thành",
  "Present Perfect Continuous": "thì hiện tại hoàn thành tiếp diễn",
  "Present Perfect Progressive": "thì hiện tại hoàn thành tiếp diễn",
  "Simple Past": "thì quá khứ đơn",
  "Past Continuous": "thì quá khứ tiếp diễn",
  "Past Progressive": "thì quá khứ tiếp diễn",
  "Past Perfect": "thì quá khứ hoàn thành",
  "Past Perfect Continuous": "thì quá khứ hoàn thành tiếp diễn",
  "Past Perfect Progressive": "thì quá khứ hoàn thành tiếp diễn",
  "will-future": "thì tương lai đơn (will)",
  "Simple Future": "thì tương lai đơn (will)",
  "going to-future": "thì tương lai với 'going to'",
  "Future Continuous": "thì tương lai tiếp diễn",
  "Future Progressive": "thì tương lai tiếp diễn",
  "Future Perfect": "thì tương lai hoàn thành",
  "Future Perfect Continuous": "thì tương lai hoàn thành tiếp diễn",
};

// Headings that are English study material, not prose about it. Numbering is
// stripped before matching ("10. should" ≡ "should"). Sourced from the real
// heading inventory (data/llm-runs/heading-inventory.json): modal/auxiliary
// names, quoted paradigms, function-word pairs, and the verb word-lists of
// the gerund lessons.
const SPECIMEN_EXACT = new Set([
  // modals & auxiliaries, with their slash/and combinations
  "can", "could", "may", "might", "must", "shall", "should", "will", "would",
  "ought to", "need", "need not", "needn't", "needn’t", "mustn't", "mustn’t",
  "cannot", "can't", "can’t", "do", "does", "did", "done", "be", "been",
  "am", "are", "is", "was", "were", "have", "has", "had",
  "can and could", "may and might", "must and ought",
  "will / won't", "will / won´t", "will / won’t",
  "should / shouldn't", "should / shouldn´t", "should / shouldn’t",
  "dare", "had better", "would rather", "would sooner", "would like",
  "used to", "let's", "let", "let + object", "there's", "it's (no) good",
  "there's no", "there's no point", "why not", "how about", "what about",
  "be afraid", "feel like", "go on", "carry on", "give up", "keep (on)",
  "can't/couldn't help", "worth", "not", "no", "without", "regret", "regret*",
  "spend one's time",
  // function words & pairs that ARE the lesson material
  "so", "too", "such", "enough", "since", "for", "when", "while", "if",
  "each", "every", "each, every", "half/quite", "each other",
  "i – me", "we – us", "since vs for", "since and for", "all vs. whole",
  "good / well", "so and too", "when / while", "when or if", "which or what",
  // conjugation paradigms quoted as headings
  "to be (am, are, is)", "to be (was, were)", "have (got)", "had (got)", "do",
  "5. do", "6. did", "7. need not", "1] be", "2] have", "3] do",
]);

const PREPS = new Set([
  "of", "on", "in", "at", "for", "with", "about", "to", "from", "against",
  "between", "without", "into", "over", "after", "before", "under", "by",
]);

// Reuses vi-repair's notion of "talks about grammar" so a heading naming a
// word class is treated as prose ("after auxiliaries/modals" → dịch) rather
// than as a prep-pattern specimen.
const METALANGUAGE =
  /\b(auxiliar(y|ies)|infinitives?|gerunds?|participles?|adverbs?|adjectives?|nouns?|pronouns?|verbs?|endings?|subjects?|objects?|prepositions?|articles?|modals?|tenses?|forms?|sentences?|clauses?|questions?|singular|plural|contracted|comparative|superlative|syllables?|vowels?|consonants?|apostrophes?|columns?)\b/i;

const NUMBERING = /^\s*\d+(?:[.\])]\d*)*[.\])]?\s*/;

/** "4.1. Affirmative sentences" → { num: "4.1. ", body: "Affirmative sentences" } */
export function splitHeadingNumber(text: string): { num: string; body: string } {
  const m = NUMBERING.exec(text);
  if (!m) return { num: "", body: text };
  return { num: m[0], body: text.slice(m[0].length) };
}

/**
 * True when a heading is English study material that must survive every
 * translation round verbatim: word-form recipes ("Past → Present", "Gerund +
 * Noun", "A=B"), modal/auxiliary names, function-word pairs, conjugation
 * paradigms, and short lowercase phrasal word-lists ("afraid of", "keen on").
 */
export function isSpecimenHeading(text: string): boolean {
  const { body } = splitHeadingNumber(text);
  const key = body.trim().replace(/\s+/g, " ");
  if (!key) return false;
  if (/[+→⇒=]/.test(key)) return true;
  if (SPECIMEN_EXACT.has(key) || SPECIMEN_EXACT.has(key.toLowerCase())) return true;
  // The glossary outranks the specimen heuristics: a heading it knows how to
  // translate ("instructions", "trends" — single lowercase words the rules
  // below would keep English) is prose by definition.
  if (translateHeadingGlossary(text) !== null) return false;
  const words = key.toLowerCase().split(" ").filter(Boolean);
  if (words.length === 0) return false;
  // Single lowercase word without grammar metalanguage: the gerund lessons'
  // verb lists (admit, avoid, enjoy…). "instructions"/"trends" are rescued by
  // the glossary, which runs before this check.
  if (words.length === 1 && !METALANGUAGE.test(key) && key[0] === key[0].toLowerCase()) {
    return true;
  }
  // Short all-lowercase prep pattern: "afraid of", "keen on", "in spite of".
  // Headings that describe a use case ("spontaneous actions") carry no
  // preposition and stay prose.
  if (
    words.length <= 4 &&
    key === key.toLowerCase() &&
    !METALANGUAGE.test(key) &&
    words.some((w) => PREPS.has(w.replace(/[().*]/g, "")))
  ) {
    return true;
  }
  return false;
}

// ── The glossary itself ────────────────────────────────────────────────────
//
// Keys are numbering-stripped heading text; placeholders {0}… appear when the
// segment extractor has masked a protected span (usually "<i>Tense</i>").
// Values keep the same placeholders in order.

const LABELS: Array<[RegExp, string]> = [
  [/^Form$/i, "Cấu trúc"],
  [/^Use$/i, "Cách dùng"],
  [/^Examples?$/i, "Ví dụ"],
  [/^(?:Eg|Ex)\.?\s*(?::[\-–]?|[\-–])?\s*$/i, "Ví dụ"],
  [/^Answers?\s*:?$/i, "Đáp án:"],
  [/^Note\s*:?$/i, "Lưu ý:"],
  [/^Tip\s*:?$/i, "Mẹo:"],
  [/^Conclusion\s*:?$/i, "Kết luận:"],
  [/^Exceptions?\s*:?$/i, "Ngoại lệ:"],
  [/^Introduction$/i, "Giới thiệu"],
  [/^Types$/i, "Các loại"],
  [/^Spelling$/i, "Chính tả"],
  [/^Rules$/i, "Quy tắc"],
  [/^Special cases$/i, "Trường hợp đặc biệt"],
  [/^Special points$/i, "Những điểm đặc biệt"],
  [/^Points to remember$/i, "Những điểm cần nhớ"],
  [/^Remember this!?$/i, "Hãy nhớ điều này!"],
  [/^(?:Be careful|Careful)!?$/i, "Chú ý!"],
  [/^Difference$/i, "Sự khác biệt"],
  [/^things in general$/i, "sự việc nói chung"],
  [/^instructions$/i, "chỉ dẫn"],
  [/^trends$/i, "xu hướng"],
  [/^spontaneous actions$/i, "hành động tự phát"],
  [/^temporary actions$/i, "hành động tạm thời"],
  [/^planned actions in the future$/i, "hành động đã định sẵn trong tương lai"],
  [/^predictions, assumptions$/i, "dự đoán, phỏng đoán"],
  [/^repeated actions?(?: \([^)]*\))?$/i, "hành động lặp lại"],
  [/^Adding -(ed|s|ing)$/i, "Thêm -$1"],
  [/^Signal words$/i, "Từ tín hiệu"],
  [/^Affirmative sentences$/i, "Câu khẳng định"],
  [/^Negative sentences$/i, "Câu phủ định"],
  [/^Affirmative (?:forms|commands)$/i, "Dạng khẳng định"],
  [/^Negative (?:forms|commands)$/i, "Dạng phủ định"],
  [/^Negative$/i, "Phủ định"],
  [/^Affirmative$/i, "Khẳng định"],
  [/^Simple Present$/i, "Thì hiện tại đơn"],
  [/^going to-future and will-future in a diagram$/i, "going to-future và will-future trong sơ đồ"],
  [/^Word order in English questions – Summary$/i, "Trật tự từ trong câu hỏi tiếng Anh – Tóm tắt"],
];

// Substitute every EN tense name inside a heading fragment, longest names
// first so "Present Perfect Continuous" wins over "Present Perfect". TENSE
// values already begin with "thì", so "the X" and a bare "X" both become the
// same phrase (a masked placeholder counts as a tense mention: "the {0}" →
// "thì {0}"); they sit lowercase in running text — the capitalized standalone
// spellings live in LABELS above.
function tenseSub(fragment: string): string {
  let out = fragment.replace(/\bthe\s+\{(\d+)\}/g, "thì {$1}");
  const names = Object.keys(TENSE_NAMES_VI).sort((a, b) => b.length - a.length);
  for (const en of names) {
    const esc = en.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    out = out.replace(new RegExp(`\\b(?:the\\s+)?${esc}\\b`, "gi"), TENSE_NAMES_VI[en]);
  }
  return out;
}

// A fragment is only glossary-translatable when substitution actually changed
// it (a known tense name) or it is a masked placeholder the LLM round fills.
// "Use of Modal Verbs of Obligation" changes nothing → the LLM takes over.
function tenseSubOrNone(fragment: string): string | null {
  const sub = tenseSub(fragment);
  if (sub !== fragment) return sub;
  if (/\{\d+\}/.test(fragment)) return fragment;
  return null;
}

const TEMPLATES: Array<[RegExp, (m: RegExpMatchArray) => string | null]> = [
  [/^Use of (.+)$/, (m) => withTense(m[1], (t) => `Cách dùng ${t}`)],
  [/^What are signal words for (.+?)\??$/, (m) => withTense(m[1], (t) => `Từ tín hiệu của ${t} là những từ nào?`)],
  [/^Signal words for (.+)$/, (m) => withTense(m[1], (t) => `Từ tín hiệu của ${t}`)],
  [/^(Affirmative|Negative) sentences in (?:the )?(.+)$/, (m) =>
    withTense(m[2], (t) => `Câu ${m[1] === "Affirmative" ? "khẳng định" : "phủ định"} trong ${t}`)],
  [/^Questions in (?:the )?(.+?)(?:, Questions with (.+))?$/, (m) =>
    withTense(m[1], (t) => `Câu hỏi trong ${t}${m[2] ? ` (câu hỏi với ${m[2]})` : ""}`)],
  [/^Questions (without|with) question words in (?:the )?(.+)$/, (m) =>
    withTense(m[2], (t) => `Câu hỏi ${m[1] === "without" ? "không có" : "có"} từ hỏi trong ${t}`)],
  [/^Questions (without|with) question words and (be|have|do)$/, (m) =>
    `Câu hỏi ${m[1] === "without" ? "không có" : "có"} từ hỏi với ${m[2]}`],
  [/^(be|do|have) as a main verb in (?:the )?(.+)$/, (m) =>
    withTense(m[2], (t) => `${m[1]} với tư cách động từ chính trong ${t}`)],
  [/^(be|do|have) as a main verb$/, (m) => `${m[1]} với tư cách động từ chính`],
  [/^The introductory sentence in (?:the )?(.+)$/, (m) => withTense(m[1], (t) => `Câu mở đầu trong ${t}`)],
  [/^The introductory sentence$/, () => "Câu mở đầu"],
  [/^Types of introductory sentences$/, () => "Các loại câu mở đầu"],
  [/^(Subject|Object) questions?$/, (m) => `Câu hỏi ${m[1] === "Subject" ? "đối với chủ ngữ" : "đối với tân ngữ"}`],
  [/^A diagram to visualize (.+)$/, (m) => withTense(m[1], (t) => `Sơ đồ minh họa ${t}`)],
  [/^(.+) in a diagram$/, (m) => withTense(m[1], (t) => `${t} trong sơ đồ`)],
  [/^The Imperative with let's$/i, () => "Câu mệnh lệnh với let's"],
  [/^The Imperative in English$/i, () => "Câu mệnh lệnh trong tiếng Anh"],
  [/^The form of the Imperative$/i, () => "Cấu trúc câu mệnh lệnh"],
  [/^How do we form (.+)\?$/, (m) => withTense(m[1], (t) => `${t} được hình thành như thế nào?`)],
  [/^How to form (.+)$/, (m) => withTense(m[1], (t) => `Cách hình thành ${t}`)],
  [/^Modals \((.+)\)$/, (m) => `Động từ khuyết thiếu (${m[1]})`],
  [/^Comparison with (-er\/-est|more – most)$/, (m) => `So sánh với ${m[1]}`],
  [/^Long forms, contracted forms \(short forms\) of auxiliaries$/i,
    () => "Dạng dài và dạng rút gọn của trợ động từ"],
  [/^Possessive s – mostly for people and animals$/i,
    () => "Possessive s – chủ yếu cho người và động vật"],
  [/^s -Genitive – mostly for people and animals$/i,
    () => "S-genitive – chủ yếu cho người và động vật"],
  [/^of-phrase – mostly for things$/i, () => "Cụm of – chủ yếu cho sự vật"],
];

function withTense(fragment: string, build: (t: string) => string): string | null {
  const t = tenseSubOrNone(fragment);
  return t === null ? null : build(t);
}

/**
 * Deterministic Vietnamese for a stock heading segment, or null when the
 * glossary has no opinion (the LLM round takes over). Numbering prefixes are
 * preserved. A result that carries no Vietnamese diacritics is treated as "no
 * opinion" — a template that failed to translate its material (e.g. "Use of
 * …" over an unknown term) must not masquerade as a translation.
 */
export function translateHeadingGlossary(segment: string): string | null {
  const { num, body } = splitHeadingNumber(segment);
  const key = body.trim().replace(/\s+/g, " ");
  if (!key) return null;

  for (const [re, vi] of LABELS) {
    const m = re.exec(key);
    if (m) {
      const out = vi.replace(/\$1/g, m[1] ?? "");
      return num + out;
    }
  }
  for (const [re, build] of TEMPLATES) {
    const m = re.exec(key);
    if (m) {
      const out = build(m);
      if (!out || !VI_DIACRITIC.test(out)) continue; // no real translation → LLM path
      return num + out;
    }
  }
  return null;
}
