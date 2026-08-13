// The daily quote, from ZenQuotes (https://zenquotes.io) — no API key needed
// for the free tier.
//
// Three things about that API drive the shape of this file:
//   1. It answers with an ARRAY of one object: [{ q, a, h }].
//   2. Rate limiting (5 requests / 30s per IP) is NOT an HTTP error. It comes
//      back 200 OK as a normal-looking quote whose author is "zenquotes.io"
//      and whose text is "Too many requests…". Printing that to a learner
//      would be embarrassing, so parseZenQuote rejects it explicitly.
//   3. /api/today is the same quote for everyone all day, which is exactly the
//      "one quote per day" the feature wants and the friendliest use of the
//      rate limit. /api/random is the documented fallback if today is down.
//
// The quote is decoration. It must never delay or break a page, so every
// failure path ends in a curated local quote instead of an error.

export type DailyQuote = {
  text: string;
  author: string;
  /** YYYY-MM-DD the quote was served for. */
  day: string;
  source: "zenquotes" | "fallback";
};

const ENDPOINTS = [
  "https://zenquotes.io/api/today",
  "https://zenquotes.io/api/random",
] as const;

const FETCH_TIMEOUT_MS = 4000;
/** How long a fallback sticks before we try ZenQuotes again (outage cooldown). */
const FALLBACK_TTL_MS = 10 * 60 * 1000;

/**
 * Curated stand-ins, in the register of the app: learning, language, patience.
 * Chosen by day so the fallback is stable within a day and still rotates.
 */
const FALLBACK_QUOTES: ReadonlyArray<{ text: string; author: string }> = [
  { text: "The limits of my language mean the limits of my world.", author: "Ludwig Wittgenstein" },
  { text: "A different language is a different vision of life.", author: "Federico Fellini" },
  { text: "Little by little, one travels far.", author: "J. R. R. Tolkien" },
  { text: "He who learns but does not think, is lost.", author: "Confucius" },
  { text: "Patience is bitter, but its fruit is sweet.", author: "Aristotle" },
  { text: "Knowing is not enough; we must apply.", author: "Johann Wolfgang von Goethe" },
  { text: "The beautiful thing about learning is that no one can take it away from you.", author: "B. B. King" },
];

export function dayKey(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** Deterministic pick so the same day yields the same fallback. */
export function fallbackQuote(day: string): { text: string; author: string } {
  let h = 0;
  for (let i = 0; i < day.length; i++) h = (h * 31 + day.charCodeAt(i)) >>> 0;
  return FALLBACK_QUOTES[h % FALLBACK_QUOTES.length];
}

/**
 * Pull a usable quote out of a ZenQuotes payload, or null when the payload is
 * malformed, empty, or the throttling notice wearing a quote's clothes.
 */
export function parseZenQuote(payload: unknown): { text: string; author: string } | null {
  const first = Array.isArray(payload) ? payload[0] : payload;
  if (!first || typeof first !== "object") return null;

  const rec = first as Record<string, unknown>;
  const text = typeof rec.q === "string" ? rec.q.trim() : "";
  const author = typeof rec.a === "string" ? rec.a.trim() : "";
  if (!text) return null;

  // The throttle notice is attributed to the site itself.
  if (author.toLowerCase() === "zenquotes.io") return null;
  // Belt and braces: catch the notice even if they change the attribution.
  if (/^too many requests/i.test(text)) return null;

  return { text, author: author || "Unknown" };
}

async function fetchQuote(url: string): Promise<{ text: string; author: string } | null> {
  try {
    const res = await fetch(url, {
      // Caching is handled here (module memo) and at the route's HTTP headers;
      // Next's data cache would add a third, harder-to-reason-about layer.
      cache: "no-store",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    return parseZenQuote(await res.json());
  } catch {
    // Network error, timeout, or non-JSON body — all mean "use the fallback".
    return null;
  }
}

// One live quote per server instance per day. On serverless this is per warm
// instance, which the route's s-maxage header covers at the CDN edge.
let memo: { quote: DailyQuote; expires: number } | null = null;

export async function getDailyQuote(now: Date = new Date()): Promise<DailyQuote> {
  const day = dayKey(now);
  if (memo && memo.quote.day === day && memo.expires > now.getTime()) return memo.quote;

  for (const url of ENDPOINTS) {
    const hit = await fetchQuote(url);
    if (hit) {
      const quote: DailyQuote = { ...hit, day, source: "zenquotes" };
      // Hold a real quote until the end of the UTC day.
      memo = { quote, expires: Date.parse(`${day}T23:59:59.999Z`) };
      return quote;
    }
  }

  // ZenQuotes is down or throttling us: serve the curated quote, but only
  // hold it for a few minutes so the real one returns as soon as it can.
  const quote: DailyQuote = { ...fallbackQuote(day), day, source: "fallback" };
  memo = { quote, expires: now.getTime() + FALLBACK_TTL_MS };
  return quote;
}

/** Test seam — drops the in-process memo. */
export function resetQuoteCache() {
  memo = null;
}
