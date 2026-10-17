import { describe, expect, it } from "vitest";
import { MAX_TOPICS_PER_WORD, parseAnswers, validateAnswers } from "./topic-classification";

const allowed = new Set(["food", "body", "animals"]);

describe("parseAnswers", () => {
  it("reads word<TAB>slugs lines, an empty slug list meaning no topic", () => {
    const m = parseAnswers("kitten\tanimals\nthe\t\nsoup\tfood,body\n");
    expect(m.get("kitten")).toEqual(["animals"]);
    expect(m.get("the")).toEqual([]);
    expect(m.get("soup")).toEqual(["food", "body"]);
  });
  it("keeps a multi-word headword intact", () => {
    expect(parseAnswers("ice cream\tfood\n").get("ice cream")).toEqual(["food"]);
  });
});

describe("validateAnswers", () => {
  const words = ["kitten", "the", "soup"];
  it("accepts a complete, valid answer set", () => {
    expect(validateAnswers(words, parseAnswers("kitten\tanimals\nthe\t\nsoup\tfood"), allowed)).toEqual([]);
  });
  it("reports missing words, unknown slugs, duplicates and too many topics", () => {
    const problems = validateAnswers(words, parseAnswers("kitten\tpets\nsoup\tfood,food"), allowed);
    expect(problems.join("|")).toMatch(/the: missing/);
    expect(problems.join("|")).toMatch(/kitten: unknown topic "pets"/);
    expect(problems.join("|")).toMatch(/soup: duplicate topic/);
    expect(validateAnswers(["a"], parseAnswers("a\tfood,body,animals"), allowed).join("|")).toMatch(new RegExp(`more than ${MAX_TOPICS_PER_WORD}`));
  });
  it("reports answers for words that are not in the slice", () => {
    expect(validateAnswers(["a"], parseAnswers("a\t\nzzz\tfood"), allowed).join("|")).toMatch(/zzz: not in slice/);
  });
});
