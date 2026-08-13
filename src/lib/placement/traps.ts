/**
 * Pseudowords for the placement test: shaped like English, but not words.
 *
 * They exist to measure GUESSING. A learner who answers "I know it" to words
 * that cannot be known is over-claiming, and `estimatePlacement` uses the rate
 * to discount their real-word hits. Without them the test would reward saying
 * yes to everything.
 *
 * Written by hand rather than generated: two dozen items is cheaper to write
 * than a generator is to build and tune, and the single real risk — a "trap"
 * that turns out to be a real word — is checked mechanically in traps.test.ts.
 *
 * What that check can and cannot prove: it scans everything the app teaches
 * (the A1–B2 core set and every committed pack), so no trap collides with a word
 * a learner could meet here. It cannot prove these are absent from English at
 * large. They were chosen from invented stems to keep that risk low; if one ever
 * turns out to be a real word, remove it — every learner's false-alarm rate is
 * biased upward until it goes.
 *
 * Morphology is deliberately varied (‑er, ‑ish, ‑ble, ‑ate, ‑ure, ‑ing, ‑ly) so
 * traps cannot be spotted by shape.
 */
export const TRAP_WORDS: readonly string[] = [
  "flimper",
  "reguble",
  "cortiate",
  "blenture",
  "tarnible",
  "mendrap",
  "plontish",
  "gorbate",
  "clundle",
  "frabbish",
  "storgle",
  "veltrine",
  "murbling",
  "praxen",
  "dworren",
  "shanterly",
  "blethick",
  "quorbin",
  "trantify",
  "glimberous",
  "narpick",
  "sundrel",
  "wispant",
  "kelther",
];
