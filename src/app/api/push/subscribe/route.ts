import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const endpoint = body?.endpoint;
  const p256dh = body?.keys?.p256dh;
  const auth = body?.keys?.auth;
  if (typeof endpoint !== "string" || typeof p256dh !== "string" || typeof auth !== "string") {
    return NextResponse.json({ error: "invalid subscription" }, { status: 400 });
  }

  // endpoint is globally unique: the same device signing in as a different
  // account must MOVE the subscription rather than create a second row (without
  // that, the new person receives the old person's reminders on the same machine).
  await prisma.pushSubscription.upsert({
    where: { endpoint },
    update: { userId, p256dh, auth, userAgent: req.headers.get("user-agent") ?? undefined, failCount: 0 },
    create: { userId, endpoint, p256dh, auth, userAgent: req.headers.get("user-agent") ?? undefined },
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const endpoint = (await req.json().catch(() => null))?.endpoint;
  if (typeof endpoint !== "string") {
    return NextResponse.json({ error: "endpoint required" }, { status: 400 });
  }
  // Only ever delete your own subscription — endpoint is unique, so a deleteMany
  // carrying both conditions is what blocks a cross-account delete.
  await prisma.pushSubscription.deleteMany({ where: { endpoint, userId } });
  return NextResponse.json({ ok: true });
}
