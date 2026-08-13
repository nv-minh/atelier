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
function peakInstant(rival: Rival, dateStr: string): Date {
  const minute = rngInt(makeRng(hashSeed("peakmin", rival.id, dateStr)), 0, 59);
  const utcHour = rival.peakHourVn - VN_UTC_OFFSET_HOURS; // may go negative
  return new Date(new Date(dateStr + "T00:00:00.000Z").getTime() + utcHour * 3600000 + minute * 60000);
}

export function lastActiveAt(rival: Rival, now: Date): Date {
  // Walk back up to 4 days: today's peak may not have arrived yet, and the
  // rival may have rested. Four days is enough that "3 ngày trước" is the
  // worst case shown.
  for (let back = 0; back < 4; back++) {
    const day = todayStr(addUtcDays(now, -back));
    if (isRestDay(rival, day)) continue;
    const at = peakInstant(rival, day);
    if (at.getTime() <= now.getTime()) return at;
  }
  return addUtcDays(now, -4);
}
