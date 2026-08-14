import { NextRequest, NextResponse } from "next/server";
import { updateSettings } from "@/lib/study-engine";
import { requireUserId } from "@/lib/session";
import { setReminderPrefs } from "@/lib/reminders/prefs-server";
import { isSameOrigin, forbiddenCrossOrigin } from "@/lib/csrf";

export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) return forbiddenCrossOrigin();
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json();
  const allowed: any = {};
  if (typeof body.requestRetention === "number") allowed.requestRetention = body.requestRetention;
  if (typeof body.newCardsPerDay === "number") allowed.newCardsPerDay = body.newCardsPerDay;
  if (typeof body.reviewsPerDay === "number") allowed.reviewsPerDay = body.reviewsPerDay;
  if (typeof body.theme === "string") allowed.theme = body.theme;
  // Daily XP goal: clamp to the same 10–500 range the UI exposes so a crafted
  // request can't store a goal that's unreachable or trivially auto-met.
  if (typeof body.dailyGoalXp === "number" && Number.isFinite(body.dailyGoalXp)) {
    allowed.dailyGoalXp = Math.round(Math.min(500, Math.max(10, body.dailyGoalXp)));
  }
  await updateSettings(userId, allowed);

  // remindHour/tz take their own path because storing them also has to recompute
  // nextRemindAt — updateSettings() writes straight through, so it cannot do this.
  const touchesReminder =
    body.remindHour === null || typeof body.remindHour === "number" || typeof body.tz === "string";
  if (touchesReminder) {
    await setReminderPrefs(userId, {
      remindHour:
        body.remindHour === null ? null : typeof body.remindHour === "number" ? body.remindHour : undefined,
      tz: typeof body.tz === "string" ? body.tz : undefined,
    });
  }

  return NextResponse.json({ ok: true });
}
