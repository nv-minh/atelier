"use client";

// The page a guest lands on at "/". Mobile-first: one column, the demo directly
// under the headline, everything else stacked beneath it. From lg the hero
// splits so the card sits beside the pitch instead of below it.
//
// Order is an argument: try the product → understand why it works → see what
// else is inside → browse the free areas → sign in. The sign-in button repeats
// only twice (hero and close) because the demo already makes the ask once.

import Link from "next/link";
import { ArrowRight, Compass, Library, NotebookPen, BarChart3, Gauge } from "lucide-react";
import { TryCards, type DemoWord } from "@/components/landing/try-cards";
import { IntervalLadder } from "@/components/landing/interval-ladder";
import { DailyQuote } from "@/components/daily-quote";
import { SiteFooter } from "@/components/site-footer";
import { ContributeBanner } from "@/components/contribute-card";
import { startSignIn, GoogleMark } from "@/components/auth-gate";
import { useI18n } from "@/components/i18n-provider";
import type { Topic } from "@/lib/topic-taxonomy";

// All seven routes under /study. "cram" is last because it is the one that
// writes nothing to the SRS schedule — landing.features.modesBody says so
// rather than letting the count quietly disagree with what /study shows.
const MODE_KEYS = ["cards", "quiz", "typeIt", "listen", "matching", "pron", "cram"] as const;

const EXTRA_CHIP_KEYS = ["chipPwa", "chipExport", "chipLang", "chipImages"] as const;

export function LandingView({
  totalWords,
  topics,
  demoWords,
  grammar,
}: {
  totalWords: number;
  topics: Pick<Topic, "slug" | "emoji">[];
  demoWords: DemoWord[];
  grammar: { topics: number; lessons: number };
}) {
  const { t } = useI18n();
  const words = totalWords.toLocaleString("vi-VN");

  return (
    <main className="shell pb-28 md:pb-20">
      {/* ── HERO + DEMO ─────────────────────────────────────────────── */}
      <section className="pt-8 sm:pt-14 lg:pt-20 lg:grid lg:grid-cols-[1fr_minmax(0,26rem)] lg:gap-16 lg:items-center">
        <div className="max-w-xl">
          <p className="animate-fade-up font-mono text-[11px] uppercase tracking-[0.22em] text-fg-muted/80 mb-5">
            {t("landing.eyebrow")}
          </p>
          <h1
            className="display text-display-xl mb-5 animate-fade-up"
            style={{ animationDelay: "60ms", animationFillMode: "both" }}
          >
            {t("landing.title1")}
            <br />
            <span className="display-it text-ember">{t("landing.title2")}</span>
          </h1>
          <p
            className="text-lg sm:text-xl text-fg-muted leading-relaxed mb-7 animate-fade-up"
            style={{ animationDelay: "140ms", animationFillMode: "both" }}
          >
            {t("landing.sub", { n: words })}
          </p>

          <div
            className="flex flex-col sm:flex-row sm:flex-wrap gap-3 mb-6 animate-fade-up"
            style={{ animationDelay: "220ms", animationFillMode: "both" }}
          >
            <button
              onClick={() => startSignIn("/")}
              className="group inline-flex items-center justify-center gap-2.5 rounded-full bg-ink text-paper px-7 py-3.5 font-medium hover:opacity-90 transition-opacity"
            >
              <GoogleMark />
              {t("landing.ctaPrimary")}
              <ArrowRight size={17} className="group-hover:translate-x-0.5 transition-transform" />
            </button>
            {/* A no-signup CTA next to the Google button. The level check is
                genuinely open to guests (src/app/onboarding/page.tsx), so this
                is not a teaser that bounces into an auth wall. */}
            <Link
              href="/onboarding"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-hairline/10 px-7 py-3.5 font-medium hover:bg-paper-200/50 transition-colors"
            >
              <Gauge size={16} />
              {t("landing.level.cta")}
            </Link>
            <Link
              href="/topics"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-hairline/10 px-7 py-3.5 font-medium hover:bg-paper-200/50 transition-colors"
            >
              {t("landing.ctaSecondary")}
            </Link>
          </div>

          {/* The numbers stay a single mono line — a colophon, not a stat row. */}
          <p
            className="font-mono text-[11px] text-fg-muted/70 tracking-wide animate-fade-up"
            style={{ animationDelay: "300ms", animationFillMode: "both" }}
          >
            {t("landing.index", { w: words, t: topics.length })}
          </p>
        </div>

        {/* THE DEMO — the page's one bold move. */}
        {demoWords.length > 0 && (
          <div
            className="mt-10 lg:mt-0 animate-fade-up"
            style={{ animationDelay: "360ms", animationFillMode: "both" }}
          >
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ember mb-4 lg:text-center">
              {t("landing.demo.label")}
            </p>
            <TryCards words={demoWords} />
          </div>
        )}
      </section>

      {/* ── HOW IT WORKS ────────────────────────────────────────────── */}
      {/* Two beats, not one: the app measures where you are, then schedules
          what you would forget. The first beat is the part no other vocab app
          does, so it leads. */}
      <section className="mt-20 sm:mt-28">
        <SectionLabel>{t("landing.level.label")}</SectionLabel>
        <div className="card-atelier p-6 sm:p-8 mb-16 sm:mb-20">
          <div className="sm:flex sm:items-start sm:gap-8">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-ember/10 text-ember mb-4 sm:mb-0">
              <Gauge size={20} />
            </span>
            <div className="max-w-2xl">
              <h2 className="display text-display-md mb-3">
                {t("landing.level.title")}{" "}
                <span className="display-it text-ember">{t("landing.level.titleAccent")}</span>
              </h2>
              <p className="text-fg-muted leading-relaxed mb-5">{t("landing.level.body")}</p>
              <Link
                href="/onboarding"
                className="group inline-flex items-center gap-1.5 text-sm font-medium text-fg hover:text-ember transition-colors"
              >
                {t("landing.level.cta")}
                <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>
          </div>
        </div>

        <SectionLabel>{t("landing.how.label")}</SectionLabel>
        <div className="sm:grid sm:grid-cols-2 sm:gap-14 lg:gap-20 sm:items-start">
          <div className="max-w-md">
            <h2 className="display text-display-md mb-4">
              {t("landing.how.title")}{" "}
              <span className="display-it text-ember">{t("landing.how.titleAccent")}</span>
            </h2>
            <p className="text-fg-muted leading-relaxed">{t("landing.how.body")}</p>
          </div>
          <div className="mt-10 sm:mt-2">
            <IntervalLadder />
          </div>
        </div>
      </section>

      {/* ── WHAT'S INSIDE ───────────────────────────────────────────── */}
      <section className="mt-20 sm:mt-28">
        <SectionLabel>{t("landing.features.label")}</SectionLabel>
        <h2 className="display text-display-md mb-8 max-w-lg">
          {t("landing.features.title")}{" "}
          <span className="display-it text-ember">{t("landing.features.titleAccent")}</span>
        </h2>

        <div className="grid gap-3 sm:gap-4 sm:grid-cols-3">
          <div className="card-atelier p-6 sm:col-span-3 lg:col-span-1 lg:row-span-1">
            <p className="display text-xl mb-1.5">{t("landing.features.modesTitle")}</p>
            <p className="text-sm text-fg-muted leading-relaxed mb-5">{t("landing.features.modesBody")}</p>
            {/* the seven modes, named the way they are named inside the app */}
            <div className="flex flex-wrap gap-1.5">
              {MODE_KEYS.map((k) => (
                <span
                  key={k}
                  className="rounded-full border border-hairline/10 px-3 py-1.5 text-xs text-fg-muted"
                >
                  {t(`home.${k}`)}
                </span>
              ))}
            </div>
          </div>

          <FeatureCard
            icon={<NotebookPen size={17} />}
            title={t("landing.features.notebookTitle")}
            body={t("landing.features.notebookBody")}
          />
          <FeatureCard
            icon={<BarChart3 size={17} />}
            title={t("landing.features.progressTitle")}
            body={t("landing.features.progressBody")}
          />
        </div>
      </section>

      {/* ── TOPICS (open to guests) ─────────────────────────────────── */}
      <section className="mt-20 sm:mt-28">
        <SectionLabel>{t("landing.topics.label")}</SectionLabel>
        <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
          <h2 className="display text-display-md max-w-md">
            {t("landing.topics.title", { n: topics.length })}
          </h2>
          <Link
            href="/topics"
            className="group inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg transition-colors"
          >
            {t("landing.topics.cta")}
            <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>

        {/* A sample, not the catalogue — all 28 chips are a wall of text on a
            phone, and "Xem tất cả" is right there for the rest. */}
        <div className="flex flex-wrap gap-2">
          {topics.slice(0, 12).map((tp) => (
            <Link
              key={tp.slug}
              href="/topics"
              className="inline-flex items-center gap-2 rounded-full border border-hairline/10 bg-surface px-3.5 py-2 text-sm hover:border-ember/40 hover:-translate-y-0.5 transition-all"
            >
              <span aria-hidden>{tp.emoji}</span>
              {t(`topics.names.${tp.slug}`)}
            </Link>
          ))}
        </div>

        <p className="mt-5 text-sm text-fg-muted leading-relaxed max-w-2xl">
          {t("landing.topics.packs")}
        </p>

        <div className="mt-6 flex flex-wrap gap-2">
          <OpenLink href="/topics" icon={<Compass size={14} />} label={t("auth.exploreTopics")} />
          <OpenLink href="/browse" icon={<Library size={14} />} label={t("auth.exploreLibrary")} />
          <span className="inline-flex items-center text-xs text-fg-muted/70 px-1">
            {t("landing.topics.free")}
          </span>
        </div>
      </section>

      {/* ── EXTRAS ──────────────────────────────────────────────────── */}
      {/* Prose and chips rather than cards: these are trust signals, not
          selling points, and the page is already long on mobile. */}
      <section className="mt-20 sm:mt-28">
        <SectionLabel>{t("landing.extras.label")}</SectionLabel>
        <h2 className="display text-display-md mb-4 max-w-lg">
          {t("landing.extras.title")}{" "}
          <span className="display-it text-ember">{t("landing.extras.titleAccent")}</span>
        </h2>
        <p className="text-fg-muted leading-relaxed max-w-2xl mb-6">{t("landing.extras.body")}</p>
        <div className="flex flex-wrap gap-2">
          {EXTRA_CHIP_KEYS.map((k) => (
            <span
              key={k}
              className="rounded-full border border-hairline/10 px-3.5 py-1.5 text-xs text-fg-muted"
            >
              {t(`landing.extras.${k}`)}
            </span>
          ))}
        </div>
      </section>

      {/* ── QUOTE ───────────────────────────────────────────────────── */}
      <section className="mt-20 sm:mt-28">
        <DailyQuote />
      </section>

      {/* ── GRAMMAR ─────────────────────────────────────────────────── */}
      {/* /grammar has shipped, so this states real numbers pulled from the DB
          (see getGuestLandingData in page.tsx) rather than a promise. Japanese
          and Chinese are still deliberately not mentioned: the schema has no
          language column, so promising them here would be selling something
          that cannot ship. */}
      <section className="mt-20 sm:mt-28">
        <Link
          href="/grammar"
          className="group block rounded-2xl border border-hairline/10 px-6 py-5 sm:flex sm:items-center sm:gap-6 hover:border-ember/30 transition-colors"
        >
          <div className="sm:shrink-0">
            <SectionLabel>{t("landing.grammar.label")}</SectionLabel>
            <p className="display text-xl -mt-2">{t("landing.grammar.title")}</p>
          </div>
          <p className="mt-2 sm:mt-0 text-sm text-fg-muted leading-relaxed">
            {t("landing.grammar.body", {
              topics: grammar.topics.toLocaleString("vi-VN"),
              lessons: grammar.lessons.toLocaleString("vi-VN"),
            })}
          </p>
        </Link>
      </section>

      {/* ── CLOSE ───────────────────────────────────────────────────── */}
      <section className="mt-16 sm:mt-24 text-center">
        <h2 className="display text-display-md mb-4 max-w-lg mx-auto">
          {t("landing.final.title")}{" "}
          <span className="display-it text-ember">{t("landing.final.titleAccent")}</span>
        </h2>
        <p className="text-fg-muted leading-relaxed max-w-md mx-auto mb-7">{t("landing.final.body")}</p>
        <button
          onClick={() => startSignIn("/")}
          className="inline-flex items-center justify-center gap-2.5 rounded-full bg-ink text-paper px-8 py-4 font-medium hover:opacity-90 transition-opacity"
        >
          <GoogleMark size={18} />
          {t("landing.ctaPrimary")}
        </button>
        <p className="mt-4 text-xs text-fg-muted/70">{t("landing.final.note")}</p>
      </section>

      {/* Feedback before the footer, not inside it: a visitor who bounced off
          the sign-in ask is exactly the one worth hearing from, and a link
          between Privacy and Terms is not something anyone notices. */}
      <ContributeBanner className="mt-16 sm:mt-24" />

      <SiteFooter />
    </main>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-fg-muted/70 mb-4">{children}</p>
  );
}

function FeatureCard({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="card-atelier p-6">
      <span className="grid h-9 w-9 place-items-center rounded-full bg-ember/10 text-ember mb-4">
        {icon}
      </span>
      <p className="display text-xl mb-1.5">{title}</p>
      <p className="text-sm text-fg-muted leading-relaxed">{body}</p>
    </div>
  );
}

function OpenLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 rounded-full border border-hairline/10 px-4 py-2 text-sm text-fg-muted hover:text-fg hover:border-ink/25 transition-colors"
    >
      {icon}
      {label}
    </Link>
  );
}
