import { describe, expect, it } from "vitest";
import { TOPICS, assignTopics, topicBySlug } from "./topic-taxonomy";

const CRAWL_2026_08_13 = ["medical", "legal", "finance", "daily-life", "social", "office-skills"];

describe("taxonomy shape", () => {
  it("has no duplicate slugs", () => {
    // The 2026-08-13 taxonomy proposal redefined `travel`, which already
    // existed. Two entries with one slug means a duplicate chip in the UI and
    // an ambiguous topicBySlug lookup.
    const slugs = TOPICS.map((t) => t.slug);
    expect(slugs).toHaveLength(new Set(slugs).size);
  });

  it("gives every topic the fields the UI reads", () => {
    for (const t of TOPICS) {
      expect(t.slug, `${t.slug} slug`).toMatch(/^[a-z][a-z0-9-]*$/);
      expect(t.name.length, `${t.slug} name`).toBeGreaterThan(0);
      expect(t.emoji.length, `${t.slug} emoji`).toBeGreaterThan(0);
      expect(t.blurb.length, `${t.slug} blurb`).toBeGreaterThan(0);
      expect(t.accent, `${t.slug} accent`).toMatch(/^text-/);
    }
  });

  it("registers every pack topic from the 2026-08-13 crawl", () => {
    // A pack whose slug has no taxonomy entry still writes that slug into
    // Word.topics, but db:topics then strips it (only curated slugs survive)
    // and no UI chip ever shows it — the words become unreachable by topic.
    for (const slug of CRAWL_2026_08_13) {
      const t = topicBySlug(slug);
      expect(t, `${slug} missing from TOPICS`).toBeDefined();
      expect(t!.curated, `${slug} must be curated or db:topics will wipe its tags`).toBe(true);
    }
  });

  it("marks travel curated so the merged pack tags survive db:topics", () => {
    // travel is the one hybrid topic: keyword-matched AND pack-tagged.
    const travel = topicBySlug("travel")!;
    expect(travel.curated).toBe(true);
    expect(travel.keywords.length).toBeGreaterThan(0);
  });

  it("keeps the domain packs keyword-free so their tags mean 'deliberate'", () => {
    for (const slug of CRAWL_2026_08_13) {
      expect(topicBySlug(slug)!.keywords, `${slug} should have no keywords`).toEqual([]);
    }
  });

  it("does not register logistics or daily-communication as topics", () => {
    // 15 logistics words fold into `business`; daily-communication is a general
    // frequency band, not a domain, so it ships with no slug at all.
    expect(topicBySlug("logistics")).toBeUndefined();
    expect(topicBySlug("daily-communication")).toBeUndefined();
  });
});

describe("assignTopics", () => {
  it("never assigns a keyword-less topic to everything", () => {
    // A topic with keywords: [] would build the regex \b() which matches any
    // string, so every curated topic would be assigned to every word.
    const matched = assignTopics({ word: "zzzz", definitionEn: "qqqq", example: null, synonyms: [] });
    for (const t of TOPICS) {
      if (t.keywords.length === 0) expect(matched).not.toContain(t.slug);
    }
  });

  it("returns nothing for a word that matches no keyword", () => {
    expect(assignTopics({ word: "xyzzy", definitionEn: "plugh", example: null, synonyms: [] })).toEqual([]);
  });

  it("matches on the word, its definition, its example and its synonyms", () => {
    expect(assignTopics({ word: "airport", definitionEn: null, example: null, synonyms: [] })).toContain("travel");
    expect(assignTopics({ word: "xyzzy", definitionEn: "a kind of restaurant", example: null, synonyms: [] })).toContain("food");
    expect(assignTopics({ word: "xyzzy", definitionEn: null, example: "she ate breakfast", synonyms: [] })).toContain("food");
    expect(assignTopics({ word: "xyzzy", definitionEn: null, example: null, synonyms: ["suitcase"] })).toContain("travel");
  });

  it("picks up the keywords merged in from the travel pack", () => {
    expect(assignTopics({ word: "itinerary", definitionEn: null, example: null, synonyms: [] })).toContain("travel");
    expect(assignTopics({ word: "souvenir", definitionEn: null, example: null, synonyms: [] })).toContain("travel");
  });

  it("leaves out the proposal keywords that would match any definition", () => {
    // "corner", "straight" and "opposite" were dropped on purpose: they appear
    // in ordinary definitions and would flood travel with unrelated words.
    expect(assignTopics({ word: "xyzzy", definitionEn: "a straight line", example: null, synonyms: [] })).not.toContain("travel");
    expect(assignTopics({ word: "xyzzy", definitionEn: "the opposite view", example: null, synonyms: [] })).not.toContain("travel");
  });
});
