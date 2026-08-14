"use client";

// "Tell me what's wrong" as a first-class surface rather than a line of fine
// print. Two ways out on purpose: the mailto opens a composer with the subject
// and a skeleton body already filled, and the address itself is on screen and
// copyable — on a phone with no mail client wired up a mailto: link opens
// nothing at all, and that reader would otherwise have no address to reach.

import { useState } from "react";
import { Mail, Copy, Check } from "lucide-react";
import { FEEDBACK_EMAIL, feedbackMailto } from "@/lib/contact";
import { useI18n } from "@/components/i18n-provider";

export function ContributeCard() {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(FEEDBACK_EMAIL);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // The clipboard is permission-gated and missing entirely over plain http.
      // The address is printed on the button either way, so a failure needs no
      // error state — it just leaves the reader reading it.
    }
  };

  return (
    <section className="card-atelier p-6 sm:p-7 mb-4">
      <h2 className="display text-xl mb-1">{t("contribute.title")}</h2>
      <p className="text-xs text-soft mb-5">{t("contribute.desc")}</p>

      <ul className="text-sm text-soft space-y-1.5 mb-5">
        {["itemBug", "itemWord", "itemIdea"].map((k) => (
          <li key={k} className="flex gap-2">
            <span aria-hidden className="text-ember">
              —
            </span>
            {t(`contribute.${k}`)}
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center gap-2">
        <a
          href={feedbackMailto(t("contribute.subject"), t("contribute.bodyTemplate"))}
          className="inline-flex items-center gap-2 rounded-full bg-ink text-paper px-5 py-2.5 text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <Mail size={15} />
          {t("contribute.cta")}
        </a>
        <button
          onClick={copy}
          aria-label={t("contribute.copy")}
          className="inline-flex items-center gap-2 rounded-full border border-line px-4 py-2.5 text-soft hover:text-ink transition-colors"
        >
          {copied ? (
            <Check size={14} className="text-moss-500" />
          ) : (
            <Copy size={14} />
          )}
          <span className="font-mono text-xs">
            {copied ? t("contribute.copied") : FEEDBACK_EMAIL}
          </span>
        </button>
      </div>
    </section>
  );
}
