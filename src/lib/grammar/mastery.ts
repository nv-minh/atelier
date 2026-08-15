// Topic mastery (grammar design §7): 30% theory read + 70% recent test
// accuracy over a ring buffer of the last RECENT_WINDOW answers. Pure module —
// the answer API and the hub data lib both call it; tests never touch prisma.

export const RECENT_WINDOW = 20;
export const MASTERY_MIN_ANSWERED = 5;

// GrammarTopicProgress.recent is a Json column — treat whatever comes back as
// untrusted and coerce to boolean[].
export function sanitizeRecent(recent: unknown): boolean[] {
  if (!Array.isArray(recent)) return [];
  return recent.map(Boolean);
}

export function pushRecent(recent: unknown, correct: boolean): boolean[] {
  return [...sanitizeRecent(recent), correct].slice(-RECENT_WINDOW);
}

// null = "not enough signal yet" — the UI shows "Mới bắt đầu" instead of a
// number, so one lucky answer can never read as 70% mastery.
export function masteryPct(i: {
  lessonsRead: number;
  lessonsTotal: number;
  recent: unknown;
  answered: number;
}): number | null {
  if (i.answered < MASTERY_MIN_ANSWERED) return null;
  // No re-cap here: pushRecent is the only writer and always caps at RECENT_WINDOW.
  const readRatio = i.lessonsTotal > 0 ? Math.min(1, i.lessonsRead / i.lessonsTotal) : 0;
  const recent = sanitizeRecent(i.recent);
  const acc = recent.length > 0 ? recent.filter(Boolean).length / recent.length : 0;
  return Math.round((0.3 * readRatio + 0.7 * acc) * 100);
}
