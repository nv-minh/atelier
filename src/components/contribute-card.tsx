"use client";

// "Tell me what's wrong" as a first-class surface rather than a line of fine
// print. Two ways out on purpose: the mailto opens a composer with the subject
// and a skeleton body already filled, and the address itself is on screen and
// copyable — on a phone with no mail client wired up a mailto: link opens
// nothing at all, and that reader would otherwise have no address to reach.
//
// Two shapes, one pair of actions:
//   ContributeCard   — the full section, for the settings stack.
//   ContributeBanner — a slim strip for the end of the dashboard and the
//     landing page, matching the landing's "what's next" block. It exists
//     because the settings card was the ONLY entry point: the dashboard has no
//     footer, so reaching it meant user menu -> settings -> scroll to bottom.

import { useState } from "react";
import { Mail, Copy, Check } from "lucide-react";
import { FEEDBACK_EMAIL, feedbackMailto } from "@/lib/contact";
import { useI18n } from "@/components/i18n-provider";
import { cn } from "@/lib/utils";
import { buttonClasses } from "@/lib/ui/button-classes";

// Shared by both shapes: the mailto button plus the address as a copy target.
function ContributeActions({ className }: { className?: string }) {
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
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <a
        href={feedbackMailto(t("contribute.subject"), t("contribute.bodyTemplate"))}
        className={buttonClasses("primary", "sm")}
      >
        <Mail size={15} />
        {t("contribute.cta")}
      </a>
      <button
        onClick={copy}
        aria-label={t("contribute.copy")}
        className="inline-flex items-center gap-2 rounded-full border border-hairline/10 px-4 py-2.5 text-fg-muted hover:text-fg transition-colors"
      >
        {copied ? <Check size={14} className="text-moss-500" /> : <Copy size={14} />}
        <span className="font-mono text-xs">
          {copied ? t("contribute.copied") : FEEDBACK_EMAIL}
        </span>
      </button>
    </div>
  );
}

export function ContributeCard() {
  const { t } = useI18n();
  return (
    <section className="card-atelier p-6 sm:p-7 mb-4">
      <h2 className="display text-xl mb-1">{t("contribute.title")}</h2>
      <p className="text-xs text-fg-muted mb-5">{t("contribute.desc")}</p>

      <ul className="text-sm text-fg-muted space-y-1.5 mb-5">
        {["itemBug", "itemWord", "itemIdea"].map((k) => (
          <li key={k} className="flex gap-2">
            <span aria-hidden className="text-ember">
              —
            </span>
            {t(`contribute.${k}`)}
          </li>
        ))}
      </ul>

      <ContributeActions />
    </section>
  );
}

export function ContributeBanner({ className }: { className?: string }) {
  const { t } = useI18n();
  return (
    // Three columns on a wide screen — heading, sentence, actions — so the
    // strip fills its width instead of leaving the right half empty. It stacks
    // below lg, where three columns would squeeze the buttons.
    <section
      className={cn(
        "rounded-2xl border border-hairline/10 px-6 py-5 lg:flex lg:items-center lg:gap-8",
        className
      )}
    >
      <div className="lg:shrink-0">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ember">
          {t("contribute.label")}
        </p>
        <p className="display text-xl mt-1">{t("contribute.bannerTitle")}</p>
      </div>
      <p className="mt-2 lg:mt-0 flex-1 text-sm text-fg-muted leading-relaxed">
        {t("contribute.bannerBody")}
      </p>
      <ContributeActions className="mt-4 lg:mt-0 lg:shrink-0" />
    </section>
  );
}
