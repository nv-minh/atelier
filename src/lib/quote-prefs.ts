// Browser-side policy for the daily quote: which day it is for the reader,
// whether they already hid today's, and the copy of today's quote kept in
// localStorage so the second visit of the day costs no request at all.
//
// React-free and time-injected (callers pass `now`) so every rule is testable
// without a DOM — same shape as pwa-prefs.ts. The component in
// components/daily-quote.tsx owns the fetching and the markup.

export type CachedQuote = { text: string; author: string };

const KEY_DISMISSED = "atelier.quote.dismissed";
const KEY_CACHE = "atelier.quote.today";

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage blocked or full — the quote is simply fetched again next visit.
  }
}

/**
 * The reader's calendar day. Deliberately local time, not the UTC day the API
 * keys on: "a new day" has to mean what it means to the person looking at the
 * screen, and in UTC+7 those differ for seven hours every night.
 */
export function localDay(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function isDismissed(now: Date = new Date()): boolean {
  return read(KEY_DISMISSED) === localDay(now);
}

export function recordDismissed(now: Date = new Date()): void {
  write(KEY_DISMISSED, localDay(now));
}

/**
 * Today's quote if it was already fetched today, else null. A stored quote from
 * any other day is stale by definition — that is the whole point of a daily
 * quote — so it is ignored and the caller fetches a fresh one.
 */
export function readCachedQuote(now: Date = new Date()): CachedQuote | null {
  const raw = read(KEY_CACHE);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { day?: unknown; text?: unknown; author?: unknown };
    if (parsed?.day !== localDay(now)) return null;
    if (typeof parsed.text !== "string" || !parsed.text) return null;
    return { text: parsed.text, author: typeof parsed.author === "string" ? parsed.author : "" };
  } catch {
    // Hand-edited or half-written entry — treat as no cache.
    return null;
  }
}

/**
 * Store today's quote so the rest of the day is served from disk.
 *
 * A fallback quote (ZenQuotes down or rate-limiting us) is deliberately NOT
 * stored: caching it would pin the stand-in for the whole day even after
 * ZenQuotes recovers minutes later. Only a real quote is worth a day.
 */
export function writeCachedQuote(
  quote: { text: string; author: string; source?: string },
  now: Date = new Date()
): void {
  if (!quote?.text) return;
  if (quote.source && quote.source !== "zenquotes") return;
  write(KEY_CACHE, JSON.stringify({ day: localDay(now), text: quote.text, author: quote.author }));
}
