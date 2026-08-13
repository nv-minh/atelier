import { describe, expect, it } from "vitest";
import { DRIFT, type DriftReview, computeDrift } from "./drift";

const NOW = new Date("2026-08-13T10:00:00.000Z");

/** `n` reviews of words at `cefrIndex`, all rated `rating`. */
function reviews(n: number, cefrIndex: number, rating: number, lapses = 0): DriftReview[] {
  return Array.from({ length: n }, () => ({ cefrIndex, rating, lapses }));
}

const input = (over: Partial<Parameters<typeof computeDrift>[0]> = {}) => ({
  reviews: [] as DriftReview[],
  band: 2,
  driftedAt: null as Date | null,
  now: NOW,
  ...over,
});

describe("the data gate", () => {
  it("does nothing below the minimum sample", () => {
    // Without this, the first three reviews of a session yank the band around.
    const r = computeDrift(input({ reviews: reviews(DRIFT.minReviews - 1, 2, 1) }));
    expect(r.delta).toBe(0);
  });

  it("acts once the sample is large enough", () => {
    const r = computeDrift(input({ reviews: reviews(DRIFT.minReviews, 2, 1) }));
    expect(r.delta).not.toBe(0);
  });

  it("does nothing with no reviews at all", () => {
    expect(computeDrift(input()).delta).toBe(0);
  });
});

describe("once per day", () => {
  it("does nothing when it already ran today", () => {
    const r = computeDrift(
      input({
        reviews: reviews(50, 2, 1),
        driftedAt: new Date("2026-08-13T01:00:00.000Z"),
      })
    );
    expect(r.delta).toBe(0);
  });

  it("runs again on a later day", () => {
    const r = computeDrift(
      input({
        reviews: reviews(50, 2, 1),
        driftedAt: new Date("2026-08-12T23:59:00.000Z"),
      })
    );
    expect(r.delta).not.toBe(0);
  });

  it("is not blocked by a future driftedAt", () => {
    // A clock skew must not freeze someone's band indefinitely.
    const r = computeDrift(
      input({ reviews: reviews(50, 2, 1), driftedAt: new Date("2027-01-01T00:00:00.000Z") })
    );
    expect(r.delta).not.toBe(0);
  });
});

describe("direction", () => {
  it("moves the band down when the learner keeps failing at their level", () => {
    const r = computeDrift(input({ reviews: reviews(50, 2, 1) }));
    expect(r.delta).toBeLessThan(0);
  });

  it("moves the band up when the material is consistently easy", () => {
    const r = computeDrift(input({ reviews: reviews(50, 2, 4) }));
    expect(r.delta).toBeGreaterThan(0);
  });

  it("stays put on a normal mix of ratings", () => {
    // Mostly Good with a few Again is what learning looks like; it is not
    // evidence the band is wrong.
    const mixed = [...reviews(40, 2, 3), ...reviews(6, 2, 1), ...reviews(4, 2, 4)];
    expect(computeDrift(input({ reviews: mixed })).delta).toBe(0);
  });

  it("does not move up when Easy answers come with a lapse history", () => {
    // Easy on a card already lapsed repeatedly means relearning, not headroom.
    const r = computeDrift(input({ reviews: reviews(50, 2, 4, DRIFT.maxLapsesForUp + 1) }));
    expect(r.delta).toBeLessThanOrEqual(0);
  });
});

describe("probe weighting", () => {
  it("treats failing a below-band word as a stronger signal than failing at band", () => {
    // A probe card is one the extrapolation assumed they knew. Failing it says
    // the assumption was wrong, which is the sharpest evidence available.
    //
    // Compared on a MIXED sample on purpose. In an all-probe sample the extra
    // weight appears in both the numerator and the denominator of the failure
    // share and cancels out, so the two cases would be identical — and at 100%
    // failure both saturate the clamp anyway. The weighting means "among these
    // reviews, the probe failures matter more", which only says anything when
    // there is something to compare them against.
    const same = reviews(30, 3, 3); // steady Good answers at band
    const failedAtBand = computeDrift(input({ band: 3, reviews: [...same, ...reviews(20, 3, 1)] }));
    const failedProbes = computeDrift(input({ band: 3, reviews: [...same, ...reviews(20, 0, 1)] }));

    expect(failedProbes.delta).toBeLessThan(failedAtBand.delta);
    // Both should still be real movements, not clamp saturation.
    expect(failedAtBand.delta).toBeGreaterThan(-DRIFT.maxStep);
    expect(failedProbes.delta).toBeGreaterThan(-DRIFT.maxStep);
  });

  it("identifies a probe by band distance, needing no extra column", () => {
    // Anything more than one band below target counts, so nothing has to be
    // marked when the card is handed out.
    const r = computeDrift(input({ band: 4, reviews: reviews(50, 1, 1) }));
    expect(r.probeShare).toBeGreaterThan(0);
    const notProbe = computeDrift(input({ band: 4, reviews: reviews(50, 4, 1) }));
    expect(notProbe.probeShare).toBe(0);
  });

  it("ignores reviews far above the band when judging difficulty", () => {
    // Failing C1 words as a B1 learner is expected and says nothing about
    // whether B1 is the right home band.
    const r = computeDrift(input({ band: 1, reviews: reviews(50, 4, 1) }));
    expect(r.delta).toBe(0);
  });
});

describe("the clamp", () => {
  it("never moves more than the per-run limit, however extreme the evidence", () => {
    const down = computeDrift(input({ band: 3, reviews: reviews(100, 0, 1) }));
    expect(down.delta).toBeGreaterThanOrEqual(-DRIFT.maxStep);
    const up = computeDrift(input({ reviews: reviews(100, 2, 4) }));
    expect(up.delta).toBeLessThanOrEqual(DRIFT.maxStep);
  });

  it("never pushes the band outside the scale", () => {
    const atTop = computeDrift(input({ band: 4, reviews: reviews(50, 4, 4) }));
    expect(4 + atTop.delta).toBeLessThanOrEqual(4);
    const atBottom = computeDrift(input({ band: 0, reviews: reviews(50, 0, 1) }));
    expect(0 + atBottom.delta).toBeGreaterThanOrEqual(0);
  });

  it("returns a finite delta for every rating value", () => {
    for (const rating of [1, 2, 3, 4]) {
      for (const band of [0, 2, 4]) {
        const r = computeDrift(input({ band, reviews: reviews(40, band, rating) }));
        expect(Number.isFinite(r.delta), `rating ${rating} band ${band}`).toBe(true);
      }
    }
  });
});

describe("explaining itself", () => {
  it("names why it did nothing, so a silent no-op is debuggable", () => {
    expect(computeDrift(input()).reason).toBe("too-few-reviews");
    expect(
      computeDrift(input({ reviews: reviews(50, 2, 1), driftedAt: NOW })).reason
    ).toBe("already-drifted-today");
  });
});
