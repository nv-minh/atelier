"use client";

import { useI18n } from "@/components/i18n-provider";
import { EmptyState } from "@/components/ui/empty-state";

export function EmptyStudy() {
  const { t } = useI18n();
  return (
    <main className="shell py-20">
      <EmptyState
        title={t("study.allCaughtUp")}
        body={t("practice.noCardsDesc")}
        action={{ kind: "link", label: t("study.changeMode"), href: "/study" }}
      />
    </main>
  );
}
