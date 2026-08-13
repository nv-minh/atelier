import { readFileSync, readdirSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";
import { TRAP_WORDS } from "./traps";

/**
 * Every real word the repo ships: the A1–B2 core set plus every committed pack.
 * Read from the committed artifacts so this test needs no database and no
 * network — `data/raw/` is gitignored and cannot be relied on.
 */
function realWords(): Set<string> {
  const root = process.cwd();
  const words = new Set<string>();

  const core = JSON.parse(readFileSync(resolve(root, "data/vocabulary.json"), "utf-8"));
  for (const w of core.vocabulary) words.add(String(w.word).toLowerCase());

  const packsDir = resolve(root, "data/packs");
  for (const file of readdirSync(packsDir)) {
    if (!file.endsWith(".json")) continue;
    const pack = JSON.parse(readFileSync(resolve(packsDir, file), "utf-8"));
    for (const w of pack.words ?? []) words.add(String(w.word).toLowerCase());
  }
  return words;
}

describe("TRAP_WORDS", () => {
  it("contains enough traps to measure guessing across a run", () => {
    // ~1 trap per 8 items over a run of up to 35 real items is ~4 traps, drawn
    // from this list without repeats.
    expect(TRAP_WORDS.length).toBeGreaterThanOrEqual(20);
  });

  it("has no duplicates", () => {
    expect(new Set(TRAP_WORDS).size).toBe(TRAP_WORDS.length);
  });

  it("contains no word the app actually teaches", () => {
    // A trap that is really a word inflates every learner's false-alarm rate,
    // which drags every corrected rate down — a silent, uniform bias with no
    // visible symptom. This is the one risk the handwritten list carries, so it
    // is the one thing checked mechanically.
    const real = realWords();
    const collisions = TRAP_WORDS.filter((t) => real.has(t.toLowerCase()));
    expect(collisions, `traps that are real words: ${collisions.join(", ")}`).toEqual([]);
  });

  it("contains no word that is a real word once inflection is stripped", () => {
    // `flimpers` would be caught above, but a trap must not be a plural or a
    // past tense of something we teach either.
    const real = realWords();
    const stems = (w: string) => {
      const out = new Set<string>();
      if (w.endsWith("s")) out.add(w.slice(0, -1));
      if (w.endsWith("es")) out.add(w.slice(0, -2));
      if (w.endsWith("ed")) out.add(w.slice(0, -2)), out.add(w.slice(0, -1));
      if (w.endsWith("ing")) out.add(w.slice(0, -3)), out.add(w.slice(0, -3) + "e");
      if (w.endsWith("ly")) out.add(w.slice(0, -2));
      return [...out].filter((s) => s.length >= 3);
    };
    const bad = TRAP_WORDS.filter((t) => stems(t.toLowerCase()).some((s) => real.has(s)));
    expect(bad, `traps that inflect from a real word: ${bad.join(", ")}`).toEqual([]);
  });

  it("looks like English, so a learner cannot spot traps by shape alone", () => {
    // If traps were obviously fake, nobody would ever claim one and the
    // false-alarm rate would measure nothing.
    for (const t of TRAP_WORDS) {
      expect(t, `${t} should be plain lowercase letters`).toMatch(/^[a-z]+$/);
      expect(t.length, `${t} length`).toBeGreaterThanOrEqual(5);
      expect(t.length, `${t} length`).toBeLessThanOrEqual(12);
      // A vowel somewhere, or it reads as a keyboard mash rather than a word.
      expect(t, `${t} needs a vowel`).toMatch(/[aeiou]/);
    }
  });
});
