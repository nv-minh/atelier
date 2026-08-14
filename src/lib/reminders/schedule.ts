// Reminder scheduling: turn "hour H on the learner's own clock" into a UTC instant.
//
// Why Intl rather than a stored minute offset: a hardcoded offset is wrong on
// exactly the day a zone switches DST. Intl.DateTimeFormat with a timeZone knows
// each zone's DST rules, and it ships with Node — no date library added.
//
// PURE module: no prisma, no server-only.

const HOUR_MS = 3_600_000;

function partsIn(instant: Date, tz: string) {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const map: Record<string, number> = {};
  for (const p of dtf.formatToParts(instant)) {
    if (p.type !== "literal") map[p.type] = Number(p.value);
  }
  // hour12:false reports midnight as "24" on some ICU versions — normalize to 0.
  map.hour = map.hour % 24;
  return map;
}

/** Offset of `tz` at the given instant, in ms (positive when ahead of UTC). */
export function tzOffsetMs(instant: Date, tz: string): number {
  let m;
  try {
    m = partsIn(instant, tz);
  } catch {
    return 0; // junk tz (it comes from the browser) — treat as UTC, don't kill the cron
  }
  const asIfUtc = Date.UTC(m.year, m.month - 1, m.day, m.hour, m.minute, m.second);
  return asIfUtc - instant.getTime();
}

export function localHourIn(instant: Date, tz: string): number {
  try {
    return partsIn(instant, tz).hour;
  } catch {
    return instant.getUTCHours();
  }
}

// UTC instant for "the local day of `ref`, plus `dayOffset` days, at `hour`:00".
function utcForLocalHour(ref: Date, tz: string, hour: number, dayOffset: number): Date {
  let m;
  try {
    m = partsIn(ref, tz);
  } catch {
    return new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), ref.getUTCDate() + dayOffset, hour));
  }
  const wall = Date.UTC(m.year, m.month - 1, m.day + dayOffset, hour);

  // Two passes: the offset depends on the instant, and the instant depends on the
  // offset. The second pass resolves every ordinary day exactly.
  const off1 = tzOffsetMs(new Date(wall), tz);
  const guess = new Date(wall - off1);
  const off2 = tzOffsetMs(guess, tz);
  if (off2 === off1) return guess;

  // The two passes disagree, so this is a DST transition day — and the two
  // transitions need opposite answers, which is why the requested hour is checked
  // instead of trusting the correction blindly:
  //   fall back — the hour exists twice, the correction lands on it, use it.
  //   spring forward — the hour does not exist at all, and the correction lands an
  //     hour EARLY (01:00 for a 02:00 reminder). Prefer `guess`, which lands on the
  //     next hour that does exist: a reminder an hour late beats one an hour early,
  //     because an early one can fire before the day's studying has happened.
  const corrected = new Date(wall - off2);
  return localHourIn(corrected, tz) === hour ? corrected : guess;
}

// The next time the learner's clock reads `remindHour`:00, counting from `now`.
// ALWAYS in the future — returning exactly `now` would let a cron run that just
// sent a reminder see `nextRemindAt <= now` and send again within the same minute.
export function nextRemindAt(now: Date, tz: string, remindHour: number): Date {
  const hour = Math.min(23, Math.max(0, Math.round(remindHour)));
  for (let day = 0; day <= 3; day++) {
    const at = utcForLocalHour(now, tz, hour, day);
    if (at.getTime() > now.getTime()) return at;
  }
  // Unreachable with valid data; kept so this never returns a past instant.
  return new Date(now.getTime() + 24 * HOUR_MS);
}
