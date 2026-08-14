import "server-only";

// Best-effort, in-memory, per-instance fixed-window rate limiter. There is no
// shared store (Redis/Upstash) in this stack, so this is NOT a hard guarantee
// under multi-instance scale-out — a user can get `limit` requests PER warm
// lambda instance, not globally. It still closes the actual gap that mattered
// pre-launch: an unbounded curl loop hammering a single endpoint from one
// client no longer gets an unbounded number of tries against whichever
// instance answers it. Pair with the idempotency/atomicity fixes on the
// endpoints themselves (recordReview, endSession) — those are the real
// correctness guarantee; this is abuse-throttling on top.
type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

// Opportunistic sweep so `buckets` doesn't grow forever across a long-lived
// warm instance — triggered inline rather than on a timer, since serverless
// functions don't get a reliable background clock between invocations.
function sweep(now: number) {
  if (buckets.size < 5000) return;
  for (const [key, b] of buckets) {
    if (now >= b.resetAt) buckets.delete(key);
  }
}

/**
 * Returns true if `key` is still under `limit` requests per `windowMs`, and
 * counts this call toward the window. `key` should scope by BOTH user and
 * route (e.g. `${userId}:review`) — a shared key across routes would let
 * activity on a cheap endpoint burn a user's budget on an expensive one.
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): { allowed: boolean; retryAfterSec: number } {
  const now = Date.now();
  sweep(now);
  const b = buckets.get(key);
  if (!b || now >= b.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSec: 0 };
  }
  if (b.count >= limit) {
    return { allowed: false, retryAfterSec: Math.ceil((b.resetAt - now) / 1000) };
  }
  b.count += 1;
  return { allowed: true, retryAfterSec: 0 };
}

export function rateLimitResponse(retryAfterSec: number) {
  return new Response(JSON.stringify({ error: "rate_limited" }), {
    status: 429,
    headers: { "Content-Type": "application/json", "Retry-After": String(retryAfterSec) },
  });
}
