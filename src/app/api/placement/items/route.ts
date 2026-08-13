import { NextResponse } from "next/server";
import { buildItemBank } from "@/lib/placement/item-bank";

/**
 * Item bank for the placement test. OPEN — no auth.
 *
 * Deliberate: a guest takes the whole test before being asked to log in, so the
 * ask lands after they have seen their level rather than before. The response
 * carries only public reference data (word id, spelling, CEFR label, and the
 * pseudoword list) — no user rows are read and none are written, so there is
 * nothing here to leak.
 *
 * Not rate-limited. The exposure is query cost, not data, and adding a limiter
 * before there is any abuse would be guessing at a threshold. If it does get
 * hammered, that is the moment to add one.
 *
 * Not in the middleware matcher either — that only bounces /study.
 */
/**
 * REQUIRED. This handler reads no request input, so Next's static optimization
 * prerenders it at build time: the bank would be frozen at whatever the DB held
 * during the build, and every learner would receive the same one — a fixed quiz
 * that can be memorised and shared, which is precisely what the per-request
 * randomisation exists to prevent. The response header alone does not stop it;
 * the route has to opt out of prerendering.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const bank = await buildItemBank();
  return NextResponse.json(bank, {
    headers: { "Cache-Control": "no-store" },
  });
}
