import "server-only";
import webpush from "web-push";
import { prisma } from "../db";
import { dictionaries, type Lang } from "../i18n/dictionaries";
import { reminderCopyKey } from "./copy";
import type { Reminder } from "./pick";

let configured = false;
function configure() {
  if (configured) return;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? "mailto:noreply@example.com",
    process.env.VAPID_PUBLIC_KEY ?? "",
    process.env.VAPID_PRIVATE_KEY ?? ""
  );
  configured = true;
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
  configure();
  const subs = await prisma.pushSubscription.findMany({ where: { userId } });
  if (subs.length === 0) return { sent: 0, pruned: 0 };

  const key = reminderCopyKey(reminder.kind);
  const payload = JSON.stringify({
    title: render(key.title, reminder.n, lang),
    body: render(key.body, reminder.n, lang),
    url: reminder.url,
  });

  let sent = 0;
  let pruned = 0;
  for (const s of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        payload
      );
      sent++;
      await prisma.pushSubscription.update({
        where: { id: s.id },
        data: { lastOkAt: new Date(), failCount: 0 },
      });
    } catch (e: any) {
      // 404/410 = the device uninstalled the app or the subscription expired:
      // delete it now rather than keep pushing into the void forever.
      if (e?.statusCode === 404 || e?.statusCode === 410) {
        await prisma.pushSubscription.delete({ where: { id: s.id } }).catch(() => {});
        pruned++;
      } else {
        await prisma.pushSubscription.update({
          where: { id: s.id },
          data: { failCount: { increment: 1 } },
        });
      }
    }
  }
  return { sent, pruned };
}
