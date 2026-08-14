// Static grammar catalog. sourceTopicEn MUST match the CSV topic_en strings
// verbatim (the importer joins on it). nameVi is hand-written here because the
// CSV's machine-translated topic names are unusable ("Lũy tiến", …).
export type GrammarCluster = "tenses" | "word-classes" | "sentence" | "other";

export type TopicDef = {
  id: number;
  slug: string;
  sourceTopicEn: string;
  nameEn: string;
  nameVi: string;
  cluster: GrammarCluster;
  order: number;
};

const t = (
  id: number, slug: string, sourceTopicEn: string, nameEn: string, nameVi: string,
  cluster: GrammarCluster, order: number
): TopicDef => ({ id, slug, sourceTopicEn, nameEn, nameVi, cluster, order });

export const GRAMMAR_TOPICS: TopicDef[] = [
  // ── tenses ──────────────────────────────────────────────────────────
  t(1, "simple-present", "Simple Present", "Simple Present", "Thì hiện tại đơn", "tenses", 1),
  t(2, "present-continuous", "Present Continuous (Progressive)", "Present Continuous", "Thì hiện tại tiếp diễn", "tenses", 2),
  t(3, "present-perfect", "Present Perfect", "Present Perfect", "Thì hiện tại hoàn thành", "tenses", 3),
  t(4, "present-perfect-continuous", "Present Perfect Continuous (Progressive)", "Present Perfect Continuous", "Thì hiện tại hoàn thành tiếp diễn", "tenses", 4),
  t(5, "simple-past", "Simple Past", "Simple Past", "Thì quá khứ đơn", "tenses", 5),
  t(6, "past-continuous", "Past Continuous (Progressive)", "Past Continuous", "Thì quá khứ tiếp diễn", "tenses", 6),
  t(7, "past-perfect", "Past Perfect", "Past Perfect", "Thì quá khứ hoàn thành", "tenses", 7),
  t(8, "past-perfect-continuous", "Past Perfect Continuous (Progressive)", "Past Perfect Continuous", "Thì quá khứ hoàn thành tiếp diễn", "tenses", 8),
  t(9, "simple-future", "Simple Future (will-future)", "Simple Future (will)", "Thì tương lai đơn (will)", "tenses", 9),
  t(10, "going-to-future", "Future with 'going to'", "Future with 'going to'", "Tương lai với 'going to'", "tenses", 10),
  t(11, "future-continuous", "Future Continuous (Progressive)", "Future Continuous", "Thì tương lai tiếp diễn", "tenses", 11),
  t(12, "future-perfect", "Future Perfect", "Future Perfect", "Thì tương lai hoàn thành", "tenses", 12),
  t(13, "future-perfect-continuous", "Future Perfect Continuous (Progressive)", "Future Perfect Continuous", "Thì tương lai hoàn thành tiếp diễn", "tenses", 13),
  t(14, "other-tenses", "Other Tenses", "Other Tenses", "Các thì khác", "tenses", 14),
  t(15, "comparison-of-tenses", "Comparison of Tenses", "Comparison of Tenses", "So sánh các thì", "tenses", 15),
  // ── word-classes ────────────────────────────────────────────────────
  t(16, "nouns", "Nouns", "Nouns", "Danh từ", "word-classes", 1),
  t(17, "articles", "Articles", "Articles", "Mạo từ", "word-classes", 2),
  t(18, "pronouns", "Pronouns", "Pronouns", "Đại từ", "word-classes", 3),
  t(19, "adjectives", "Adjective", "Adjectives", "Tính từ", "word-classes", 4),
  t(20, "adverbs", "Adverb", "Adverbs", "Trạng từ", "word-classes", 5),
  t(21, "quantifiers", "Quantifiers", "Quantifiers", "Từ chỉ lượng", "word-classes", 6),
  t(22, "prepositions", "Prepositions", "Prepositions", "Giới từ", "word-classes", 7),
  t(23, "verbs", "Verbs", "Verbs", "Động từ", "word-classes", 8),
  t(24, "modals", "Modals and Modal Auxiliaries", "Modal Verbs", "Động từ khuyết thiếu", "word-classes", 9),
  t(25, "phrasal-verbs", "Phrasal verbs", "Phrasal Verbs", "Cụm động từ", "word-classes", 10),
  t(26, "gerund-infinitive", "Gerund and Infinitive", "Gerund & Infinitive", "Danh động từ & động từ nguyên thể", "word-classes", 11),
  t(27, "participles", "Participles", "Participles", "Phân từ", "word-classes", 12),
  // ── sentence ────────────────────────────────────────────────────────
  t(28, "sentences", "Sentences", "Sentences", "Câu", "sentence", 1),
  t(29, "questions", "Questions", "Questions", "Câu hỏi", "sentence", 2),
  t(30, "conditional-sentences", "Conditional sentences", "Conditional Sentences", "Câu điều kiện", "sentence", 3),
  t(31, "passive-voice", "Passive Voice", "Passive Voice", "Câu bị động", "sentence", 4),
  t(32, "reported-speech", "Reported Speech", "Reported Speech", "Câu tường thuật", "sentence", 5),
  // ── other ───────────────────────────────────────────────────────────
  t(33, "other-grammar", "Other Grammar", "Other Grammar", "Ngữ pháp khác", "other", 1),
];

export const TOPIC_BY_SOURCE_EN: Map<string, TopicDef> = new Map(
  GRAMMAR_TOPICS.map((d) => [d.sourceTopicEn, d])
);

// common_mistakes.csv only carries a numeric category code. Names were
// authored by reading each group's titles (import-time curation, spec §4.1).
export type MistakeCategoryDef = { code: number; slug: string; nameEn: string; nameVi: string };

const c = (code: number, slug: string, nameEn: string, nameVi: string): MistakeCategoryDef =>
  ({ code, slug, nameEn, nameVi });

export const MISTAKE_CATEGORIES: MistakeCategoryDef[] = [
  c(1, "adj-verb-preposition", "Adjective/verb + preposition", "Giới từ sau tính từ/động từ"),
  c(2, "preposition-gerund", "Preposition + gerund", "Giới từ + danh động từ"),
  c(3, "auxiliary-infinitive", "Auxiliaries & infinitive forms", "Trợ động từ & dạng nguyên thể"),
  c(4, "pronouns-possessives", "Pronouns & possessives", "Đại từ & sở hữu"),
  c(5, "word-choice-verbs", "Everyday verb & phrase choice", "Chọn từ: động từ & cụm thông dụng"),
  c(6, "verb-object-patterns", "Verb patterns with objects", "Mẫu động từ với tân ngữ"),
  c(7, "agreement-verb-forms", "Agreement & verb forms", "Hòa hợp & dạng động từ"),
  c(8, "transitive-verbs", "Verbs taking a direct object", "Động từ đi thẳng với tân ngữ"),
  c(9, "articles-nouns", "Articles with nouns", "Mạo từ với danh từ"),
  c(10, "bare-infinitive", "Bare infinitive constructions", "Nguyên thể không 'to'"),
  c(11, "redundant-words", "Redundant words & double subjects", "Từ thừa & lặp chủ ngữ"),
  c(12, "adverbial-order", "Word order of adverbials", "Trật tự trạng ngữ"),
  c(13, "sentence-inversion", "Sentence structure & inversion", "Cấu trúc câu & đảo ngữ"),
  c(14, "preposition-pairs", "Preposition pairs (to/at, in/into…)", "Cặp giới từ dễ nhầm"),
  c(15, "modal-pairs", "Modal pairs (shall/will, can/may…)", "Cặp động từ khuyết thiếu dễ nhầm"),
  c(16, "degree-word-pairs", "Degree & time word pairs (very/too…)", "Cặp từ mức độ & thời gian"),
  c(17, "quantifier-pairs", "Quantifier pairs (many/much…)", "Cặp từ chỉ lượng dễ nhầm"),
  c(18, "noun-pairs", "Noun pairs (home/house…)", "Cặp danh từ dễ nhầm"),
  c(19, "uncountable-nouns", "Uncountable nouns", "Danh từ không đếm được"),
  c(20, "invariable-plurals", "Invariable plurals", "Số nhiều bất biến"),
  c(21, "tricky-agreement-nouns", "Nouns with tricky agreement", "Danh từ hòa hợp đặc biệt"),
  c(22, "adj-adverb-pairs", "Adjective/adverb pairs (bad/badly…)", "Cặp tính từ/trạng từ dễ nhầm"),
];

export const MISTAKE_CATEGORY_BY_CODE: Map<number, MistakeCategoryDef> = new Map(
  MISTAKE_CATEGORIES.map((d) => [d.code, d])
);

// Import must land exactly these totals (spec success criteria) or exit non-zero.
export const EXPECTED_COUNTS = {
  topics: 33,
  lessons: 292,
  testQuestions: 9380,
  practiceQuestions: 10000,
  confusedPairs: 832,
  commonMistakes: 687,
} as const;
