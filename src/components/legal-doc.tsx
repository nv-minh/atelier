"use client";

// Renders a legal document in whichever language the reader has selected.
//
// The prose lives in per-route copy modules rather than in the i18n
// dictionaries on purpose: dictionaries.ts is imported by a "use client"
// provider, so every byte of it ships to every visitor on every route. Two
// locales of policy text would be dead weight on the study screens, which are
// the ones that need to stay light.

import { useI18n } from "@/components/i18n-provider";
import { LEGAL_UPDATED, type LegalDoc } from "@/lib/legal";

export function LegalDocView({ vi, en }: { vi: LegalDoc; en: LegalDoc }) {
  const { lang } = useI18n();
  const doc = lang === "en" ? en : vi;
  const updated = lang === "en" ? LEGAL_UPDATED.en : LEGAL_UPDATED.vi;
  const updatedLabel = lang === "en" ? "Last updated" : "Cập nhật lần cuối";

  return (
    <main className="shell pb-28 md:pb-20 pt-10 sm:pt-16">
      <article className="max-w-2xl">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-soft/70 mb-4">
          {updatedLabel}: {updated}
        </p>
        <h1 className="display text-display-lg mb-5">{doc.title}</h1>
        <p className="text-lg text-soft leading-relaxed mb-12">{doc.intro}</p>

        {doc.sections.map((s) => (
          <section key={s.heading} className="mb-10">
            <h2 className="display text-xl mb-3">{s.heading}</h2>
            {s.body.map((p, i) => (
              <p key={i} className="text-soft leading-relaxed mb-3">
                {p}
              </p>
            ))}
          </section>
        ))}
      </article>
    </main>
  );
}
