"use client";

import { useI18n } from "@/components/i18n-provider";
import { buttonClasses } from "@/lib/ui/button-classes";

export function EmptyStudy() {
  const { t } = useI18n();
  return (
    <main className="shell py-20 text-center">
      <h1 className="display text-display-md mb-3">{t("study.allCaughtUp")}</h1>
      <p className="text-fg-muted mb-8">{t("practice.noCardsDesc")}</p>
      <a href="/study" className={buttonClasses("primary", "md")}>
        {t("study.changeMode")}
      </a>
    </main>
  );
}
