import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { nextRemindAt } from "@/lib/reminders/schedule";
import { getReminderState } from "@/lib/reminders/state-server";
import { sendReminderTo } from "@/lib/reminders/send-server";

// REQUIRED: Next once prerendered an API route of this app as Static, which made
// every user receive one identical payload. A no-store header does NOT save you.
export const dynamic = "force-dynamic";

const BATCH = 200;

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

  for (const row of rows) {
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
      continue;
    }

    const reminder = await getReminderState(row.userId, now);
    if (!reminder) {
      // Nothing worth saying: the pointer already moved to tomorrow above, and
      // staying silent must never leave that pointer stuck.
      silent++;
      continue;
    }

    const result = await sendReminderTo(row.userId, reminder);
    sent += result.sent;
    pruned += result.pruned;
  }

  return NextResponse.json({ scanned: rows.length, sent, silent, skipped, pruned });
}
