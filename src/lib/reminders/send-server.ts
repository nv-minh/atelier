import "server-only";
import webpush from "web-push";
import { prisma } from "../db";
import { dictionaries, type Lang } from "../i18n/dictionaries";
import { reminderCopyKey } from "./copy";
import type { Reminder } from "./pick";

let configured = false;
let warned = false;

// Returns false instead of throwing when the VAPID keys are absent.
//
// setVapidDetails throws on an empty key ("No key set vapidDetails.publicKey"), and
// this runs inside the cron's per-user loop AFTER that user's daily slot has been
// claimed. An uncaught throw there would 500 the whole run and burn one learner's
// reminder for the day, with a stack trace that says nothing about the real cause —
// a missing environment variable. Degrading to "sent nothing, said why" keeps the
// run alive and the diagnosis one log line away.
function configure(): boolean {
  if (configured) return true;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) {
    if (!warned) {
      console.error("[reminders] VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY not set — push disabled");
      warned = true;
    }
    return false;
  }
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? "mailto:noreply@example.com",
    publicKey,
    privateKey
  );
  configured = true;
  return true;
}

// Interpolate the i18n key server-side: the service worker has no i18n provider.
function render(key: string, n: number, lang: Lang): string {
  const raw = key.split(".").reduce<any>((o, k) => o?.[k], dictionaries[lang]);
  return typeof raw === "string" ? raw.replace("{n}", String(n)) : key;
}

export async function sendReminderTo(
  userId: string,
  reminder: Reminder,
  lang: Lang = "vi"
): Promise<{ sent: number; pruned: number }> {
  if (!configure()) return { sent: 0, pruned: 0 };
  const subs = await prisma.pushSubscription.findMany({ where: { userId } });
  if (subs.length === 0) return { sent: 0, pruned: 0 };

  const key = reminderCopyKey(reminder.kind);
  const payload = JSON.stringify({
    title: render(key.title, reminder.n, lang),
    body: render(key.body, reminder.n, lang),
    url: reminder.url,
  });

  // One user rarely has more than 2-3 devices, but the cron calls this for
  // every claimed user in its own concurrent batch (see cron/reminders/route.ts)
  // — a serial `for` here used to multiply that fan-out by however many devices
  // each user has. Promise.allSettled: one device's failure/prune must not skip
  // or block another device's send.
  const results = await Promise.allSettled(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload
        );
        await prisma.pushSubscription.update({
          where: { id: s.id },
          data: { lastOkAt: new Date(), failCount: 0 },
        });
        return "sent" as const;
      } catch (e: any) {
        // 404/410 = the device uninstalled the app or the subscription expired:
        // delete it now rather than keep pushing into the void forever.
        if (e?.statusCode === 404 || e?.statusCode === 410) {
          await prisma.pushSubscription.delete({ where: { id: s.id } }).catch(() => {});
          return "pruned" as const;
        }
        await prisma.pushSubscription.update({
          where: { id: s.id },
          data: { failCount: { increment: 1 } },
        });
        return "failed" as const;
      }
    })
  );

  let sent = 0;
  let pruned = 0;
  for (const r of results) {
    if (r.status !== "fulfilled") continue; // per-device try/catch above already handles failures
    if (r.value === "sent") sent++;
    else if (r.value === "pruned") pruned++;
  }
  return { sent, pruned };
}
