/**
 * Pick `count` items spread evenly across the three frequency thirds of a pool.
 *
 * The pool must already be ordered most-frequent first (freqPct desc, nulls
 * last), so position in the list stands in for frequency. Splitting positionally
 * rather than by freqPct value is deliberate: 4,871 of 8,011 rows have no
 * frequency data at all, and any value-based cut would put them all in one
 * bucket or exclude them. Ordered last, they land in the bottom third, which is
 * where unranked specialist vocabulary belongs anyway.
 *
 * Why stratify at all: a band's items drawn straight off the top would all be
 * high-frequency words. The learner passes a band that is genuinely too hard for
 * them, the ladder climbs further than it should, and their measured level comes
 * out inflated — with nothing in the result to reveal it.
 *
 * `rng` is injected so tests are deterministic, and so two learners do not get
 * the same bank (a fixed quiz can be memorised and shared).
 */
export function stratifyByTercile<T>(rows: readonly T[], count: number, rng: () => number): T[] {
  const want = Math.floor(count);
  if (want <= 0 || rows.length === 0) return [];
  if (want >= rows.length) return [...rows];

  const third = Math.ceil(rows.length / 3);
  const buckets: T[][] = [
    rows.slice(0, third),
    rows.slice(third, third * 2),
    rows.slice(third * 2),
  ].filter((b) => b.length > 0);

  const out: T[] = [];
  // Round-robin across the buckets so any remainder is spread rather than piled
  // onto the most frequent third.
  const cursors = buckets.map((b) => {
    // Start each bucket at an rng-chosen offset and walk forward, so the choice
    // varies per learner without needing to shuffle whole arrays.
    return Math.floor(rng() * b.length);
  });
  const usedPerBucket = buckets.map(() => 0);

  while (out.length < want) {
    let progressed = false;
    for (let i = 0; i < buckets.length && out.length < want; i++) {
      if (usedPerBucket[i] >= buckets[i].length) continue;
      const idx = (cursors[i] + usedPerBucket[i]) % buckets[i].length;
      out.push(buckets[i][idx]);
      usedPerBucket[i]++;
      progressed = true;
    }
    if (!progressed) break;
  }

  return out;
}
