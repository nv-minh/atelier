import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { CEFR_LEVELS } from "@/lib/export-format";
import { estimatePlacement } from "@/lib/placement/estimate";
import type { BlockResult } from "@/lib/placement/ladder";
import { TRAP_WORDS } from "@/lib/placement/traps";
import { requireUserId } from "@/lib/session";
import { topicBySlug } from "@/lib/topic-taxonomy";
import { isSameOrigin, forbiddenCrossOrigin } from "@/lib/csrf";

type Answer = { wordId: string; known: boolean };
type TrapAnswer = { word: string; known: boolean };

function answers(v: unknown): Answer[] {
  if (!Array.isArray(v)) return [];
  return v.filter(
    (x): x is Answer =>
      x !== null &&
      typeof x === "object" &&
      typeof (x as Answer).wordId === "string" &&
      typeof (x as Answer).known === "boolean"
  );
}

function trapAnswers(v: unknown): TrapAnswer[] {
  if (!Array.isArray(v)) return [];
  return v.filter(
    (x): x is TrapAnswer =>
      x !== null &&
      typeof x === "object" &&
      typeof (x as TrapAnswer).word === "string" &&
      typeof (x as TrapAnswer).known === "boolean"
  );
}

/**
 * Apply a placement result (a guest draft after login, or a Settings retake).
 *
 * The band and vocabulary estimate are RECOMPUTED here from the raw answers.
 * The client sends what it showed and what was tapped; it does not get to send
 * its own level. Trusting a posted `band` would let anyone set themselves to C1,
 * and would also silently drift out of sync the moment the estimator changes.
 *
 * Idempotent by `takenAt` vs the stored `placedAt`: two tabs applying the same
 * draft, or a retry after a flaky response, must not double-apply. An older
 * draft never overwrites a newer placement.
 */
export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) return forbiddenCrossOrigin();
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const takenAt = Number((body as Record<string, unknown>).takenAt);
  if (!Number.isFinite(takenAt) || takenAt <= 0) {
    return NextResponse.json({ error: "takenAt required" }, { status: 400 });
  }
  // A draft stamped in the future would win against every later placement.
  const stamped = new Date(Math.min(takenAt, Date.now()));

  const items = answers((body as Record<string, unknown>).items);
  if (!items.length) return NextResponse.json({ error: "no answers" }, { status: 400 });

  const existing = await prisma.learnerProfile.findUnique({
    where: { userId },
    select: { placedAt: true },
  });
  if (existing?.placedAt && stamped.getTime() <= existing.placedAt.getTime()) {
    return NextResponse.json({ ok: true, applied: false, reason: "stale draft" });
  }

  // Only count answers about words that exist, and take each word's band from
  // the DB rather than from the request.
  const rows = await prisma.word.findMany({
    where: { id: { in: items.map((i) => i.wordId) } },
    select: { id: true, cefr: true },
  });
  const bandOf = new Map(rows.map((r) => [r.id, (CEFR_LEVELS as readonly string[]).indexOf(r.cefr)]));

  const perBand = new Map<number, { known: number; total: number }>();
  for (const a of items) {
    const band = bandOf.get(a.wordId);
    if (band === undefined || band < 0) continue;
    const acc = perBand.get(band) ?? { known: 0, total: 0 };
    acc.total++;
    if (a.known) acc.known++;
    perBand.set(band, acc);
  }
  const blocks: BlockResult[] = [...perBand.entries()].map(([band, v]) => ({ band, ...v }));
  if (!blocks.length) return NextResponse.json({ error: "no usable answers" }, { status: 400 });

  // Only recognised pseudowords count, so a client cannot dilute its own
  // false-alarm rate by inventing extra "traps" it answered correctly.
  const trapSet = new Set(TRAP_WORDS);
  const traps = trapAnswers((body as Record<string, unknown>).traps).filter((t) =>
    trapSet.has(t.word)
  );

  const estimate = estimatePlacement({
    blocks,
    traps: { total: traps.length, known: traps.filter((t) => t.known).length },
  });

  // Drop slugs that have left the taxonomy — crawl batches rename topics.
  const rawTopics = (body as Record<string, unknown>).topics;
  const topics = (Array.isArray(rawTopics) ? rawTopics : [])
    .filter((t): t is string => typeof t === "string")
    .filter((t) => topicBySlug(t) !== undefined);

  const profileData = {
    band: estimate.band,
    vocabSizeEst: estimate.vocabSizeEst,
    topics: JSON.stringify(topics),
    source: "test",
    estimatorVersion: estimate.estimatorVersion,
    // Kept so the estimator can be re-tuned later without asking anyone to sit
    // the test again.
    lastTest: JSON.stringify({ takenAt: stamped.toISOString(), items, traps }),
    placedAt: stamped,
  };

  await prisma.learnerProfile.upsert({
    where: { userId },
    create: { userId, ...profileData },
    update: profileData,
  });

  // Seed "I know this" from the test — REAL items only, never traps. Marking a
  // pseudoword known would put a word that does not exist into the notebook.
  const knownIds = items.filter((a) => a.known && bandOf.has(a.wordId)).map((a) => a.wordId);
  if (knownIds.length) {
    const BATCH = 25;
    for (let i = 0; i < knownIds.length; i += BATCH) {
      await prisma.$transaction(
        knownIds.slice(i, i + BATCH).map((wordId) =>
          prisma.wordMark.upsert({
            where: { userId_wordId: { userId, wordId } },
            create: { userId, wordId, known: true },
            update: { known: true },
          })
        )
      );
    }
  }

  return NextResponse.json({
    ok: true,
    applied: true,
    band: estimate.band,
    vocabSizeEst: estimate.vocabSizeEst,
    falseAlarmRate: estimate.falseAlarmRate,
    seededKnown: knownIds.length,
  });
}
