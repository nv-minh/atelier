/**
 * Every tunable number for new-word selection, in one place.
 *
 * These are STARTING POINTS chosen at design time, not measured results. They
 * live together so tuning later is one file to read and one file to change,
 * instead of a hunt through the scorer, the sampler and the widen policy.
 */
export const SELECTION = {
  /**
   * Width of the band-fit bell. 0.8 means one CEFR level away still scores
   * ~0.46 of the peak, two levels ~0.04 — soft enough that the neighbouring
   * band stays reachable, sharp enough that A1 is hopeless for a C1 learner.
   */
  bandSigma: 0.8,

  /**
   * Aim this far ABOVE the learner's current band. Deliberate: material at
   * exactly your level does not stretch you, and FSRS handles the failures.
   */
  bandSkew: 0.3,

  /**
   * Topic multipliers. The curated tier is only for slugs that can ONLY have
   * been written deliberately (curated topic with no keyword list). A topic that
   * also matches by keyword gets the lower tier even if it is marked curated,
   * because its slug does not prove intent — see topicTier().
   *
   * The gap is the point: 21 of the taxonomy's slugs are assigned by keyword
   * matching, which is measurably noisy (`cat` lands in legal, `html` in
   * finance). Boosting a noisy signal as hard as a clean one amplifies the
   * mis-assignment instead of the intent.
   */
  topicBoostCurated: 2.6,
  topicBoostKeyword: 1.8,
  topicBoostNone: 1.0,

  /**
   * Frequency score is `freqFloor + freqSpan * freqPct`. The floor is never 0
   * so a rare word that is otherwise a perfect fit keeps a real chance.
   */
  freqFloor: 0.25,
  freqSpan: 0.75,

  /**
   * Score for a word with no frequency data — deliberately mid-range. 4,871 of
   * 8,011 rows have `freqPct = null` (no general frequency list covers them),
   * so this is the common case, not an edge case. It must not push them behind
   * every ranked word, and must not invent a rank they do not have.
   */
  freqUnknown: 0.6,

  /**
   * Multiplier for a word the learner marked known. NOT zero: zero is removal,
   * and a removed word can never be probed back up, so a mistaken "I know this"
   * would hide that gap permanently.
   */
  knownPenalty: 0.02,

  /** Share of the new-card budget spent probing BELOW the learner's band. */
  probeShare: 0.05,
  /** Share reserved for on-band words scored WITHOUT any topic boost. */
  coreShare: 0.25,
} as const;
