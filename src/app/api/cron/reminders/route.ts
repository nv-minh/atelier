import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { nextRemindAt } from "@/lib/reminders/schedule";
import { getReminderState } from "@/lib/reminders/state-server";
import { sendReminderTo } from "@/lib/reminders/send-server";

// REQUIRED: Next once prerendered an API route of this app as Static, which made
// every user receive one identical payload. A no-store header does NOT save you.
export const dynamic = "force-dynamic";
// Default Vercel function timeout is 10s (Hobby) / 60s cap unless raised. This
// loop used to run BATCH users fully sequentially — 200 users x several DB
// round trips x a serial per-device webpush.sendNotification each — easily
// >60s, so the function got killed mid-batch. The slot for each unprocessed row
// was already claimed (see the CAS below), so a killed run went silent for
// those users for the rest of the day with no retry. Now the per-user work is
// chunked and parallelized (below) AND given real headroom here. 300s requires
// a Pro plan; Hobby caps at 60 regardless of this value.
export const maxDuration = 300;

const BATCH = 200;
// How many users' claim+send run concurrently. Bounded (not BATCH-wide) so one
// cron tick doesn't open hundreds of simultaneous DB connections + webpush
// sends against Neon's pooled connection limit.
const CONCURRENCY = 10;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const rows = await prisma.settings.findMany({
    where: { remindHour: { not: null }, nextRemindAt: { lte: now } },
    orderBy: { nextRemindAt: "asc" },
    take: BATCH,
    select: { id: true, userId: true, remindHour: true, tz: true, nextRemindAt: true },
  });

  let sent = 0;
  let silent = 0;
  let skipped = 0;
  let pruned = 0;

  // Claim+send one row. Independent per user — the CAS below is scoped to a
  // single Settings row, so running many of these concurrently is exactly as
  // safe as running them in series; only the wall-clock changes.
  async function processRow(row: (typeof rows)[number]) {
    // CLAIM THE SLOT FIRST, SEND SECOND. The `nextRemindAt: row.nextRemindAt`
    // condition is the anchor: if another run (a retry, two overlapping crons)
    // already claimed it, count === 0 and we move on without sending. Writing
    // after sending means one retry is one duplicate notification, and the
    // "once a day" cap drops to being a promise.
    const claimed = await prisma.settings.updateMany({
      where: { id: row.id, nextRemindAt: row.nextRemindAt },
      data: { nextRemindAt: nextRemindAt(now, row.tz, row.remindHour!) },
    });
    if (claimed.count === 0) {
      skipped++;
      return;
    }

    const reminder = await getReminderState(row.userId, now);
    if (!reminder) {
      // Nothing worth saying: the pointer already moved to tomorrow above, and
      // staying silent must never leave that pointer stuck.
      silent++;
      return;
    }

    const result = await sendReminderTo(row.userId, reminder);
    sent += result.sent;
    pruned += result.pruned;
  }

  // Bounded-concurrency fan-out: CONCURRENCY rows in flight at a time instead
  // of one at a time (was the C3 timeout risk) or all BATCH at once (would
  // spike DB connections + webpush sends).
  for (let i = 0; i < rows.length; i += CONCURRENCY) {
    const slice = rows.slice(i, i + CONCURRENCY);
    await Promise.all(slice.map((row) => processRow(row)));
  }

  return NextResponse.json({ scanned: rows.length, sent, silent, skipped, pruned });
}
