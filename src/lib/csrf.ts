import "server-only";
import type { NextRequest } from "next/server";

// Defense-in-depth on top of NextAuth's SameSite=Lax session cookie, which
// already blocks the classic cross-site form-POST CSRF (the cookie simply
// isn't attached to a cross-site request). This guards the scenario where
// that stops being true — the cookie policy loosened to SameSite=None, a proxy
// rewrites cookies, a future embed needs cross-site auth — by checking the
// request's own Origin/Referer against the Host it arrived on.
//
// Fails OPEN (allows) when NEITHER header is present. A same-origin fetch()
// POST/PATCH/DELETE carries one of these in every evergreen browser, so their
// total absence is far more likely a privacy extension stripping headers, or a
// legitimate non-browser caller (the GitHub Actions cron, a health check, curl
// with an explicit bearer token) than a forged cross-site request — and given
// SameSite=Lax is already the primary defense, failing closed there would risk
// a worse outage than the CSRF it guards against.
export function isSameOrigin(req: NextRequest): boolean {
  const host = req.headers.get("host");
  if (!host) return true; // can't check at all — let the route's own auth decide

  const origin = req.headers.get("origin");
  if (origin) {
    try {
      return new URL(origin).host === host;
    } catch {
      return false;
    }
  }
  const referer = req.headers.get("referer");
  if (referer) {
    try {
      return new URL(referer).host === host;
    } catch {
      return false;
    }
  }
  return true;
}

export function forbiddenCrossOrigin() {
  return new Response(JSON.stringify({ error: "cross_origin_forbidden" }), {
    status: 403,
    headers: { "Content-Type": "application/json" },
  });
}
