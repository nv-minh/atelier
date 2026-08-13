import { describe, expect, it } from "vitest";
import { explicitWordWhere, resolveSelection } from "./resolve";

const profileC1 = { band: 4, topics: ["medical"] };

describe("resolveSelection", () => {
  it("uses the learner's profile when they applied no filters", () => {
    const r = resolveSelection({ profile: profileC1, filter: {} });
    expect(r.strategy).toBe("profile");
    expect(r.band).toBe(4);
    expect(r.topics).toEqual(["medical"]);
  });

  it("obeys an explicit CEFR filter even when it contradicts the profile", () => {
    // Spec criterion 5: a C1 learner who clicks cefr=A1 gets A1 words. Their
    // level is an inference; the click is a statement.
    const r = resolveSelection({ profile: profileC1, filter: { cefr: "A1" } });
    expect(r.band).toBe(0);
    expect(r.applyBandWindow).toBe(false);
  });

  it("does not let the profile band shrink an explicit CEFR selection", () => {
    // If the band window still applied, a C1 profile would intersect [B2,C1]
    // with the requested A1 and return nothing at all.
    const r = resolveSelection({ profile: profileC1, filter: { cefr: "A1" } });
    expect(r.applyBandWindow).toBe(false);
  });

  it("replaces the profile's topics with an explicitly chosen topic", () => {
    const r = resolveSelection({ profile: profileC1, filter: { topic: "legal" } });
    expect(r.topics).toEqual(["legal"]);
  });

  it("treats ALL as no filter, matching studyWordFilter", () => {
    const r = resolveSelection({ profile: profileC1, filter: { cefr: "ALL", topic: "ALL" } });
    expect(r.strategy).toBe("profile");
    expect(r.band).toBe(4);
    expect(r.topics).toEqual(["medical"]);
    expect(r.applyBandWindow).toBe(true);
  });

  it("falls back to frequency order for a learner with no profile", () => {
    // Guests and everyone who existed before placement shipped. Frequency order
    // is already better than alphabetical, so skipping onboarding is not a
    // punishment.
    const r = resolveSelection({ profile: null, filter: {} });
    expect(r.strategy).toBe("frequency");
    expect(r.band).toBeNull();
    expect(r.applyBandWindow).toBe(false);
  });

  it("still honours an explicit CEFR filter without a profile", () => {
    const r = resolveSelection({ profile: null, filter: { cefr: "B2" } });
    expect(r.band).toBe(3);
    expect(r.strategy).toBe("explicit");
  });

  it("ignores an unrecognized CEFR value rather than targeting a bogus band", () => {
    const r = resolveSelection({ profile: profileC1, filter: { cefr: "Z9" } });
    expect(r.strategy).toBe("profile");
    expect(r.band).toBe(4);
  });

  it("drops profile topics that have left the taxonomy", () => {
    // Crawl batches rename and remove slugs; a stale one must not silently
    // become a filter that matches nothing.
    const r = resolveSelection({
      profile: { band: 2, topics: ["medical", "gone", "legal"] },
      filter: {},
    });
    expect(r.topics).toEqual(["medical", "legal"]);
  });

  it("falls back to frequency when every profile topic is stale and none was chosen", () => {
    const r = resolveSelection({ profile: { band: 2, topics: ["gone"] }, filter: {} });
    expect(r.topics).toEqual([]);
    // A band is still known, so this is not the no-profile case.
    expect(r.band).toBe(2);
    expect(r.strategy).toBe("profile");
  });

  it("clamps a stored band that drifted outside the scale", () => {
    expect(resolveSelection({ profile: { band: 99, topics: [] }, filter: {} }).band).toBe(4);
    expect(resolveSelection({ profile: { band: -7, topics: [] }, filter: {} }).band).toBe(0);
  });

  it("keeps an explicit topic even when the profile has none", () => {
    const r = resolveSelection({ profile: { band: 2, topics: [] }, filter: { topic: "finance" } });
    expect(r.topics).toEqual(["finance"]);
  });
});

describe("explicitWordWhere", () => {
  // Regression: the selector used to rely on its caller having already compiled
  // the learner's filter into the query. fetchNewCards did, but calling the
  // selector directly with `{ cefr: "A1" }` returned A2/B1/B2 words too — the
  // one rule that must never break, broken by a caller's omission. The selector
  // now compiles the clause itself, from here.
  it("constrains the CEFR level the learner picked", () => {
    expect(explicitWordWhere({ cefr: "A1" })).toEqual({ cefr: "A1" });
  });

  it("constrains the topic the learner picked, matching the JSON array encoding", () => {
    expect(explicitWordWhere({ topic: "medical" })).toEqual({
      topics: { contains: '"medical"' },
    });
  });

  it("constrains both at once", () => {
    expect(explicitWordWhere({ cefr: "B2", topic: "legal" })).toEqual({
      cefr: "B2",
      topics: { contains: '"legal"' },
    });
  });

  it("treats ALL and absent as no constraint", () => {
    expect(explicitWordWhere({})).toEqual({});
    expect(explicitWordWhere({ cefr: "ALL", topic: "ALL" })).toEqual({});
    expect(explicitWordWhere({ cefr: undefined, topic: undefined })).toEqual({});
  });
});
