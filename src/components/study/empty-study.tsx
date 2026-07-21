"use client";

import { useI18n } from "@/components/i18n-provider";

export function EmptyStudy() {
  const { t } = useI18n();
  return (
    <main className="shell py-20 text-center">
      <h1 className="display text-display-md mb-3">{t("study.allCaughtUp")}</h1>
      <p className="text-soft mb-8">{t("practice.noCardsDesc")}</p>
      <a href="/study" className="inline-flex rounded-full bg-ink text-paper px-6 py-3">
        {t("study.changeMode")}
      </a>
    </main>
  );
}
