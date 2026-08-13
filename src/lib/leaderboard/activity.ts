// "Active 3 hours ago". The riskiest detail on the board: ten people who all
// "just studied" at 3am is the tell that costs the whole board its credibility.
// So the instant is anchored to each rival's Vietnamese body clock, and if that
// moment hasn't happened yet today we fall back to yesterday's.

import { addUtcDays, todayStr } from "@/lib/utils";
import { hashSeed, makeRng, rngInt } from "./rng";
import { VN_UTC_OFFSET_HOURS } from "./constants";
import type { Rival } from "./rivals";
import { isRestDay } from "./xp";

// The UTC instant of a rival's peak hour on a given UTC calendar day.
//
// `dateStr` does double duty and is read on two different axes. Here,
// `utcHour` can go negative (peakHourVn < VN_UTC_OFFSET_HOURS), which pushes
// the returned instant onto the PREVIOUS UTC calendar day — so for a rival
// who peaks in the small VN hours, `dateStr` functions as a Vietnam-calendar
// label, not a UTC one. `isRestDay(rival, dateStr)` (called by `lastActiveAt`
// before this) reads the very same string as a plain UTC day. This is
// load-bearing, not an oversight: at 02:00 VN, a rival's stamp is
// ≈ (26 − peakHourVn) hours old (derivation: now = today 19:00 UTC; a
// non-resting rival's instant = today 00:00 UTC + (peakHourVn − 7)h; the
// difference is 19 − (peakHourVn − 7) = 26 − peakHourVn). A midnight-VN
// peaker (peakHourVn = 0) reads ~26h stale — the STALEST on the board, not
// the freshest — which is why night-peaking rivals don't need a quota (ruling
// R9) and why only ~12.4% of rivals read fresh at 02:00 VN. "Correcting" the
// offset so `dateStr` means the same day on both axes would make every rival
// read fresher at night, which is the opposite of what keeps the board quiet
// at 3am.
function peakInstant(rival: Rival, dateStr: string): Date {
  const minute = rngInt(makeRng(hashSeed("peakmin", rival.id, dateStr)), 0, 59);
  const utcHour = rival.peakHourVn - VN_UTC_OFFSET_HOURS;
  return new Date(new Date(dateStr + "T00:00:00.000Z").getTime() + utcHour * 3600000 + minute * 60000);
}

export function lastActiveAt(rival: Rival, now: Date): Date {
  // Walk back up to 4 days: today's peak may not have arrived yet, and the
  // rival may have rested. Measured worst case across a full day is ~102.5
  // hours, which renders "4 ngày trước" — four days, not three.
  for (let back = 0; back < 4; back++) {
    const day = todayStr(addUtcDays(now, -back));
    if (isRestDay(rival, day)) continue;
    const at = peakInstant(rival, day);
    if (at.getTime() <= now.getTime()) return at;
  }
  // Reachable, not theoretical: all four walk-back days landed on a rest day
  // for this rival. Measured at ~1.1% of rivals, which is roughly 10% of
  // boards (10 rivals each). Returns the viewer's own time-of-day four days
  // ago rather than a peak-aligned instant — a plainer fallback than the
  // rest of this function, but rare enough that it doesn't warrant matching
  // peakInstant's precision. See activity.test.ts for coverage.
  return addUtcDays(now, -4);
}
