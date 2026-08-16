"use client";

import Link from "next/link";
import { useState } from "react";
import { Bell } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { cn } from "@/lib/utils";
import { buttonClasses } from "@/lib/ui/button-classes";
import { reminderCopyKey } from "@/lib/reminders/copy";
import type { Reminder } from "@/lib/reminders/pick";

export function ReminderBanner({ reminder }: { reminder: Reminder }) {
  const { t } = useI18n();
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;

  const key = reminderCopyKey(reminder.kind);
  return (
    <div className="card-atelier p-4 mb-6 flex items-center gap-3">
      <Bell size={16} className="text-ember shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{t(key.title, { n: reminder.n })}</p>
        <p className="text-xs text-fg-muted/80 mt-0.5">{t(key.body, { n: reminder.n })}</p>
      </div>
      <Link
        href={reminder.url}
        className={cn(buttonClasses("primary", "sm"), "shrink-0")}
      >
        {t("reminders.cta")}
      </Link>
      <button onClick={() => setHidden(true)} className="shrink-0 text-xs text-fg-muted hover:text-fg">
        {t("reminders.dismiss")}
      </button>
    </div>
  );
}
