"use client";

import { useState } from "react";
import { useI18n } from "@/components/i18n-provider";

// base64url (the VAPID public key) → Uint8Array, the shape PushManager.subscribe wants.
//
// Backed by an explicit ArrayBuffer rather than Uint8Array.from(): since TS 5.7
// Uint8Array is generic over its buffer, and the inferred ArrayBufferLike does not
// satisfy BufferSource — which is what applicationServerKey asks for.
function urlBase64ToUint8Array(base64: string) {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function ReminderSettings({
  initialHour,
  initialTz,
}: {
  initialHour: number | null;
  initialTz: string;
}) {
  const { t } = useI18n();
  const [hour, setHour] = useState<number | null>(initialHour);
  const [status, setStatus] = useState<
    "idle" | "saving" | "denied" | "unsupported" | "failed" | "saved"
  >("idle");

  const save = async (nextHour: number | null) => {
    setStatus("saving");
    // tz is picked up automatically — never make someone choose a time zone.
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || initialTz;
    await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ remindHour: nextHour, tz }),
    });
    setHour(nextHour);
    setStatus("saved");
  };

  const enable = async () => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setStatus("unsupported");
      return;
    }
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      setStatus("denied");
      return;
    }
    const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapid) {
      // Forgetting NEXT_PUBLIC_VAPID_PUBLIC_KEY on the host is the likeliest way
      // this breaks in production, and subscribe() would fail with a DOMException
      // that never reaches the user. Say something instead of dying silently.
      setStatus("failed");
      return;
    }
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapid),
      });
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });
    } catch {
      // Permission is granted at this point, so a failure here is the browser or
      // the push service refusing — not the learner. Do NOT save an hour: a
      // remindHour with no subscription is a reminder that can never arrive.
      setStatus("failed");
      return;
    }
    await save(hour ?? 21);
  };

  const disable = async () => {
    const reg = await navigator.serviceWorker.ready.catch(() => null);
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await fetch("/api/push/subscribe", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: sub.endpoint }),
      });
      await sub.unsubscribe();
    }
    await save(null);
  };

  return (
    <section className="card-atelier p-6 sm:p-7 mb-4">
      <h2 className="display text-xl mb-1">{t("settings.remind")}</h2>
      <p className="text-xs text-fg-muted mb-5">{t("settings.remindDesc")}</p>

      {hour === null ? (
        <button onClick={enable} className="rounded-full bg-ink text-paper px-5 py-2.5 text-sm font-medium hover:opacity-90">
          {t("settings.remindEnable")}
        </button>
      ) : (
        <div className="flex items-center gap-3 flex-wrap">
          <label className="text-sm font-medium">{t("settings.remindHour")}</label>
          <select
            value={hour}
            onChange={(e) => save(Number(e.target.value))}
            className="rounded-2xl border border-hairline/10 bg-transparent px-4 py-2.5 text-sm"
          >
            {Array.from({ length: 24 }, (_, h) => (
              <option key={h} value={h}>{`${String(h).padStart(2, "0")}:00`}</option>
            ))}
          </select>
          <button onClick={disable} className="text-sm text-fg-muted hover:text-fg underline">
            {t("settings.remindDisable")}
          </button>
        </div>
      )}

      {status === "denied" && <p className="text-xs text-ember mt-3">{t("settings.remindDenied")}</p>}
      {status === "unsupported" && <p className="text-xs text-fg-muted mt-3">{t("settings.remindUnsupported")}</p>}
      {status === "failed" && <p className="text-xs text-ember mt-3">{t("settings.remindFailed")}</p>}
      <p className="text-xs text-fg-muted/80 mt-3">{t("settings.remindIosHint")}</p>
    </section>
  );
}
