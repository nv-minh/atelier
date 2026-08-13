import { NextResponse } from "next/server";
import { getDailyQuote } from "@/lib/quote";

// Proxied rather than called from the browser for three reasons: ZenQuotes'
// rate limit is per IP (one server IP beats thousands of visitor IPs), the
// response can be cached at the edge for the whole day, and the page keeps
// working if ZenQuotes changes shape or goes down — getDailyQuote falls back.
export const dynamic = "force-dynamic";

export async function GET() {
  const quote = await getDailyQuote();

  return NextResponse.json(quote, {
    headers: {
      // A real quote is good for the day. A fallback is a transient outage —
      // hold it briefly so the real quote can take over.
      "Cache-Control":
        quote.source === "zenquotes"
          ? "public, max-age=1800, s-maxage=43200, stale-while-revalidate=86400"
          : "public, max-age=60, s-maxage=60",
    },
  });
}
