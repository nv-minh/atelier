import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/session";
import { topicBySlug } from "@/lib/topic-taxonomy";
import { parseJsonArray } from "@/lib/utils";
import { isSameOrigin, forbiddenCrossOrigin } from "@/lib/csrf";

/** The learner's own view of their profile. */
export async function GET() {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const p = await prisma.learnerProfile.findUnique({
    where: { userId },
    select: {
      band: true,
      vocabSizeEst: true,
      topics: true,
      source: true,
      placedAt: true,
      driftedAt: true,
    },
  });
  if (!p) return NextResponse.json({ profile: null });

  return NextResponse.json({
    profile: {
      band: p.band,
      vocabSizeEst: p.vocabSizeEst,
      // Stale slugs are filtered on the way out too, so a client never renders a
      // chip for a topic that no longer exists.
      topics: parseJsonArray(p.topics).filter((t) => topicBySlug(t) !== undefined),
      source: p.source,
      placedAt: p.placedAt,
      driftedAt: p.driftedAt,
    },
  });
}

/**
 * Change which fields the learner wants to study.
 *
 * Topics only. `band` is not writable here on purpose: it is a measurement, from
 * the placement test or from drift, and letting it be posted would make the
 * number mean nothing. Retaking the test is the way to change it.
 */
export async function PATCH(req: NextRequest) {
  if (!isSameOrigin(req)) return forbiddenCrossOrigin();
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body || !Array.isArray(body.topics)) {
    return NextResponse.json({ error: "topics array required" }, { status: 400 });
  }

  // Unknown slugs are dropped rather than rejected: the taxonomy changes with
  // each crawl batch, and a client holding an old list should not get a 400 for
  // the whole request because one chip went away.
  const topics = (body.topics as unknown[])
    .filter((t): t is string => typeof t === "string")
    .filter((t) => topicBySlug(t) !== undefined);

  const json = JSON.stringify([...new Set(topics)]);

  await prisma.learnerProfile.upsert({
    where: { userId },
    // A learner can pick interests before ever taking the test; the band keeps
    // its schema default and `source` stays "declared" until a test runs.
    create: { userId, topics: json },
    update: { topics: json },
  });

  return NextResponse.json({ ok: true, topics: JSON.parse(json) });
}
