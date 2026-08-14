import "server-only";
import { prisma } from "../db";
import { nextRemindAt } from "./schedule";

// THREE write paths for nextRemindAt, and missing one kills the feature silently:
// the cron only scans `nextRemindAt <= now`, so a row that has a remindHour but no
// nextRemindAt is NEVER seen — with no error to chase.
//   1. turning reminders on / picking an hour → compute the first instant
//   2. changing the hour or the tz            → recompute immediately from the new value
//   3. turning reminders off                  → clear remindHour and nextRemindAt together
export async function setReminderPrefs(
  userId: string,
  patch: { remindHour?: number | null; tz?: string },
  now = new Date()
) {
  const current = await prisma.settings.upsert({
    where: { userId },
    update: {},
    create: { userId },
  });

  const tz = patch.tz ?? current.tz;
  const requested =
    patch.remindHour === undefined ? current.remindHour : patch.remindHour;
  // Clamped once, then used for both columns: the stored hour and the instant
  // derived from it must never come from two different numbers.
  const remindHour =
    requested === null ? null : Math.min(23, Math.max(0, Math.round(requested)));

  const data =
    remindHour === null
      ? { remindHour: null, tz, nextRemindAt: null }
      : { remindHour, tz, nextRemindAt: nextRemindAt(now, tz, remindHour) };

  const saved = await prisma.settings.update({ where: { userId }, data });
  return { remindHour: saved.remindHour, tz: saved.tz, nextRemindAt: saved.nextRemindAt };
}
