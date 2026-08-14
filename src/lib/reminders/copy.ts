// i18n keys per reminder kind. Keys only, never literal strings — the app has two
// languages and push has to be translatable too.
import type { ReminderKind } from "./pick";

export function reminderCopyKey(kind: ReminderKind) {
  return { title: `reminders.${kind}Title`, body: `reminders.${kind}Body` };
}
