import { describe, expect, it } from "vitest";
import {
  EXPECTED_COUNTS, GRAMMAR_TOPICS, MISTAKE_CATEGORIES, MISTAKE_CATEGORY_BY_CODE, TOPIC_BY_SOURCE_EN,
} from "./catalog";

describe("GRAMMAR_TOPICS", () => {
  it("has 33 topics with unique ids, slugs and source names", () => {
    expect(GRAMMAR_TOPICS).toHaveLength(33);
    expect(new Set(GRAMMAR_TOPICS.map((t) => t.id)).size).toBe(33);
    expect(new Set(GRAMMAR_TOPICS.map((t) => t.slug)).size).toBe(33);
    expect(new Set(GRAMMAR_TOPICS.map((t) => t.sourceTopicEn)).size).toBe(33);
  });
  it("clusters split 15/12/5/1", () => {
    const by = (c: string) => GRAMMAR_TOPICS.filter((t) => t.cluster === c).length;
    expect(by("tenses")).toBe(15);
    expect(by("word-classes")).toBe(12);
    expect(by("sentence")).toBe(5);
    expect(by("other")).toBe(1);
  });
  it("kebab slugs only, and every topic has a hand-written nameVi", () => {
    for (const t of GRAMMAR_TOPICS) {
      expect(t.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(t.nameVi.length).toBeGreaterThan(0);
    }
  });
  it("looks up by exact CSV topic string", () => {
    expect(TOPIC_BY_SOURCE_EN.get("Future with 'going to'")?.slug).toBe("going-to-future");
    expect(TOPIC_BY_SOURCE_EN.get("Modals and Modal Auxiliaries")?.cluster).toBe("word-classes");
  });
});

describe("MISTAKE_CATEGORIES", () => {
  it("covers codes 1..22 exactly once", () => {
    expect(MISTAKE_CATEGORIES).toHaveLength(22);
    expect(new Set(MISTAKE_CATEGORIES.map((c) => c.code)).size).toBe(22);
    for (let code = 1; code <= 22; code++) expect(MISTAKE_CATEGORY_BY_CODE.get(code)).toBeDefined();
  });
});

describe("EXPECTED_COUNTS", () => {
  it("matches the spec success criteria", () => {
    expect(EXPECTED_COUNTS).toEqual({
      topics: 33, lessons: 292, testQuestions: 9380,
      practiceQuestions: 10000, confusedPairs: 833, commonMistakes: 687,
    });
  });
});
