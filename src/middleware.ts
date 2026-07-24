import { NextResponse } from "next/server";
import { withAuth } from "next-auth/middleware";

// When AUTH_BYPASS=1, no route protection — the app uses a shared local user.
const BYPASS = process.env.AUTH_BYPASS === "1";

const guard = withAuth({
  pages: { signIn: "/login" },
}) as (req: any) => any;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function middleware(req: any) {
  if (BYPASS) return NextResponse.next();
  return guard(req);
}

export const config = {
  matcher: ["/study/:path*", "/stats/:path*", "/browse/:path*", "/settings/:path*", "/topics/:path*"],
};
