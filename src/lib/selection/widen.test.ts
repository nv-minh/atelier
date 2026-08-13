import { describe, expect, it } from "vitest";
import { MAX_WIDEN_ATTEMPTS, bandWindowToLevels, widenPlan } from "./widen";

describe("widenPlan", () => {
  it("starts narrow and on-topic", () => {
    const p = widenPlan(0);
    expect(p.useTopicBoost).toBe(true);
    expect(p.requireBandWindow).toBe(true);
    expect(p.bandWindow).toEqual({ lo: -1, hi: 1 });
  });

  it("widens the band window before giving up on the learner's topics", () => {
    // Order matters: a learner who picked `medical` would rather see a B2
    // medical word than a C1 word from some unrelated field.
    const p = widenPlan(1);
    expect(p.useTopicBoost).toBe(true);
    expect(p.bandWindow).toEqual({ lo: -1.5, hi: 1.5 });
  });

  it("drops the topic boost only after widening the band failed", () => {
    const p = widenPlan(2);
    expect(p.useTopicBoost).toBe(false);
    expect(p.requireBandWindow).toBe(true);
  });

  it("drops the band window last, which is the step that can always deliver", () => {
    // The final attempt must return cards whenever the DB holds anything the
    // learner has not seen — otherwise an empty band-and-topic cell means an
    // empty session.
    const p = widenPlan(3);
    expect(p.requireBandWindow).toBe(false);
    expect(p.bandWindow).toBeNull();
    expect(p.useTopicBoost).toBe(false);
  });

  it("never narrows: each attempt is at least as permissive as the one before", () => {
    let prevSpan = -Infinity;
    let prevBoost = true;
    for (let a = 0; a < MAX_WIDEN_ATTEMPTS; a++) {
      const p = widenPlan(a);
      const span = p.bandWindow ? p.bandWindow.hi - p.bandWindow.lo : Infinity;
      expect(span, `attempt ${a} span`).toBeGreaterThanOrEqual(prevSpan);
      // Once the boost is off it must stay off.
      if (!prevBoost) expect(p.useTopicBoost, `attempt ${a} boost`).toBe(false);
      prevSpan = span;
      prevBoost = p.useTopicBoost;
    }
  });

  it("clamps an attempt past the last step to the last step", () => {
    expect(widenPlan(99)).toEqual(widenPlan(MAX_WIDEN_ATTEMPTS - 1));
  });

  it("treats a negative attempt as the first step", () => {
    expect(widenPlan(-3)).toEqual(widenPlan(0));
  });
});

describe("bandWindowToLevels", () => {
  // The offsets below are relative to target, matching what widenPlan emits.
  it("maps a mid-scale window to the CEFR levels it covers", () => {
    // B1 learner (band 2, target 2.3) +/-1 → [1.3, 3.3] → rounds to 1..3
    expect(bandWindowToLevels({ lo: -1, hi: 1 }, 2.3)).toEqual(["A2", "B1", "B2"]);
  });

  it("clamps a window running off the top of the scale", () => {
    // C1 learner (band 4, target 4.3) +/-1 → [3.3, 5.3]; C1 is the end.
    expect(bandWindowToLevels({ lo: -1, hi: 1 }, 4.3)).toEqual(["B2", "C1"]);
  });

  it("clamps a window running off the bottom of the scale", () => {
    // An A1 learner whose band drifted below zero.
    expect(bandWindowToLevels({ lo: -1, hi: 1 }, -1.7)).toEqual(["A1"]);
  });

  it("always yields at least one level, even for a collapsed window", () => {
    // A degenerate window must not produce `cefr: { in: [] }`, which matches
    // nothing and turns the whole pool empty.
    const levels = bandWindowToLevels({ lo: 0, hi: 0 }, 2.4);
    expect(levels.length).toBeGreaterThan(0);
    expect(levels).toEqual(["B1"]);
  });

  it("falls back to the target's own level when the window is inverted", () => {
    const levels = bandWindowToLevels({ lo: 3, hi: 1 }, 2.3);
    expect(levels).toEqual(["B1"]);
  });

  it("returns every level when there is no window at all", () => {
    expect(bandWindowToLevels(null, 2.3)).toEqual(["A1", "A2", "B1", "B2", "C1"]);
  });

  it("covers the whole scale for a target far outside it", () => {
    expect(bandWindowToLevels({ lo: -10, hi: 10 }, 2)).toEqual(["A1", "A2", "B1", "B2", "C1"]);
  });
});

describe("the empty (C1 x daily-life) cell", () => {
  it("reaches a band that has words by the time the boost is dropped", () => {
    // daily-life ships A1 2 / A2 16 / B1 74 / B2 103 and NO C1 at all, so a C1
    // learner who picks it has an empty on-band on-topic pool today. Attempt 0
    // and 1 only see B2/C1; attempt 2 stops requiring the topic, which is what
    // actually rescues the session.
    const target = 4.3;
    const a0 = bandWindowToLevels(widenPlan(0).bandWindow, target);
    const a1 = bandWindowToLevels(widenPlan(1).bandWindow, target);
    expect(a0).toContain("B2");
    expect(a1).toContain("B2");
    expect(widenPlan(2).useTopicBoost).toBe(false);
    expect(bandWindowToLevels(widenPlan(3).bandWindow, target)).toHaveLength(5);
  });
});
