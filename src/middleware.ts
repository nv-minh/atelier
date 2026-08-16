import { NextResponse } from "next/server";
import { withAuth } from "next-auth/middleware";

// When AUTH_BYPASS=1 (AND not in production), no route protection — the app uses
// a shared local user. The NODE_ENV guard must stay in lockstep with the same
// flag in src/lib/session.ts and next.config.js: a prod build must NEVER honour
// AUTH_BYPASS even if the env var leaks into the deployed environment. (This
// can't import the session.ts constant — middleware runs on the edge and that
// module pulls in prisma + "server-only".)
const BYPASS = process.env.AUTH_BYPASS === "1" && process.env.NODE_ENV !== "production";

const guard = withAuth({
  pages: { signIn: "/login" },
}) as (req: any) => any;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function middleware(req: any) {
  // Block /dev routes in production. Middleware runs at request time (edge),
  // so this NODE_ENV check is not eliminated by the build compiler (unlike
  // the same check in src/app/dev/layout.tsx, which IS eliminated).
  if (
    process.env.NODE_ENV === "production" &&
    req.nextUrl.pathname.startsWith("/dev")
  ) {
    return new NextResponse(null, { status: 404 });
  }

  if (BYPASS) return NextResponse.next();
  return guard(req);
}

// Only /study is bounced to /login by the middleware. Every other gated route
// —/topics, /browse, /notebook, /stats, /word, /settings— now renders its own
// <AuthRequired> screen (or a partly-public page), and a middleware redirect
// would preempt that: the guest would be thrown back to /login before the page
// ever ran, which is exactly the "tapping the tab does nothing" bug, since
// /login is usually where they already were.
//
// This does not loosen data access. Those pages call getCurrentUser() and show
// the wall instead of user data, and every /api/* route enforces auth itself
// (the matcher never covered /api). /study keeps the redirect because a study
// session has no meaningful guest state to render at all.
export const config = {
  matcher: ["/study/:path*", "/dev/:path*"],
};
