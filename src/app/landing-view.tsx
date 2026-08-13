"use client";

// The page a guest lands on at "/". Mobile-first: one column, the demo directly
// under the headline, everything else stacked beneath it. From lg the hero
// splits so the card sits beside the pitch instead of below it.
//
// Order is an argument: try the product → understand why it works → see what
// else is inside → browse the free areas → sign in. The sign-in button repeats
// only twice (hero and close) because the demo already makes the ask once.

import Link from "next/link";
import { ArrowRight, Compass, Library, NotebookPen, BarChart3 } from "lucide-react";
import { TryCards, type DemoWord } from "@/components/landing/try-cards";
import { IntervalLadder } from "@/components/landing/interval-ladder";
import { DailyQuote } from "@/components/daily-quote";
import { startSignIn, GoogleMark } from "@/components/auth-gate";
import { useI18n } from "@/components/i18n-provider";
import type { Topic } from "@/lib/topic-taxonomy";

const MODE_KEYS = ["cards", "quiz", "typeIt", "listen", "matching", "pron"] as const;

export function LandingView({
  totalWords,
  topics,
  demoWords,
}: {
  totalWords: number;
  topics: Pick<Topic, "slug" | "emoji">[];
  demoWords: DemoWord[];
}) {
  const { t } = useI18n();
  const words = totalWords.toLocaleString("vi-VN");

  return (
    <main className="shell pb-28 md:pb-20">
      {/* ── HERO + DEMO ─────────────────────────────────────────────── */}
      <section className="pt-8 sm:pt-14 lg:pt-20 lg:grid lg:grid-cols-[1fr_minmax(0,26rem)] lg:gap-16 lg:items-center">
        <div className="max-w-xl">
          <p className="animate-fade-up font-mono text-[11px] uppercase tracking-[0.22em] text-soft/80 mb-5">
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
            className="text-lg sm:text-xl text-soft leading-relaxed mb-7 animate-fade-up"
            style={{ animationDelay: "140ms", animationFillMode: "both" }}
          >
            {t("landing.sub", { n: words })}
          </p>

          <div
            className="flex flex-col sm:flex-row gap-3 mb-6 animate-fade-up"
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
            <Link
              href="/topics"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-line px-7 py-3.5 font-medium hover:bg-paper-200/50 transition-colors"
            >
              {t("landing.ctaSecondary")}
            </Link>
          </div>

          {/* The numbers stay a single mono line — a colophon, not a stat row. */}
          <p
            className="font-mono text-[11px] text-soft/70 tracking-wide animate-fade-up"
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
      <section className="mt-20 sm:mt-28">
        <SectionLabel>{t("landing.how.label")}</SectionLabel>
        <div className="sm:grid sm:grid-cols-2 sm:gap-14 lg:gap-20 sm:items-start">
          <div className="max-w-md">
            <h2 className="display text-display-md mb-4">
              {t("landing.how.title")}{" "}
              <span className="display-it text-ember">{t("landing.how.titleAccent")}</span>
            </h2>
            <p className="text-soft leading-relaxed">{t("landing.how.body")}</p>
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
            <p className="text-sm text-soft leading-relaxed mb-5">{t("landing.features.modesBody")}</p>
            {/* the six modes, named the way they are named inside the app */}
            <div className="flex flex-wrap gap-1.5">
              {MODE_KEYS.map((k) => (
                <span
                  key={k}
                  className="rounded-full border border-line px-3 py-1.5 text-xs text-soft"
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
            className="group inline-flex items-center gap-1.5 text-sm text-soft hover:text-ink transition-colors"
          >
            {t("landing.topics.cta")}
            <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>

        {/* A sample, not the catalogue — 22 chips is a wall of text on a
            phone, and "Xem tất cả" is right there for the rest. */}
        <div className="flex flex-wrap gap-2">
          {topics.slice(0, 12).map((tp) => (
            <Link
              key={tp.slug}
              href="/topics"
              className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3.5 py-2 text-sm hover:border-ember/40 hover:-translate-y-0.5 transition-all"
            >
              <span aria-hidden>{tp.emoji}</span>
              {t(`topics.names.${tp.slug}`)}
            </Link>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <OpenLink href="/topics" icon={<Compass size={14} />} label={t("auth.exploreTopics")} />
          <OpenLink href="/browse" icon={<Library size={14} />} label={t("auth.exploreLibrary")} />
          <span className="inline-flex items-center text-xs text-soft/70 px-1">
            {t("landing.topics.free")}
          </span>
        </div>
      </section>

      {/* ── QUOTE ───────────────────────────────────────────────────── */}
      <section className="mt-20 sm:mt-28">
        <DailyQuote />
      </section>

      {/* ── CLOSE ───────────────────────────────────────────────────── */}
      <section className="mt-16 sm:mt-24 text-center">
        <h2 className="display text-display-md mb-4 max-w-lg mx-auto">
          {t("landing.final.title")}{" "}
          <span className="display-it text-ember">{t("landing.final.titleAccent")}</span>
        </h2>
        <p className="text-soft leading-relaxed max-w-md mx-auto mb-7">{t("landing.final.body")}</p>
        <button
          onClick={() => startSignIn("/")}
          className="inline-flex items-center justify-center gap-2.5 rounded-full bg-ink text-paper px-8 py-4 font-medium hover:opacity-90 transition-opacity"
        >
          <GoogleMark size={18} />
          {t("landing.ctaPrimary")}
        </button>
        <p className="mt-4 text-xs text-soft/70">{t("landing.final.note")}</p>
      </section>
    </main>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-soft/70 mb-4">{children}</p>
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
      <p className="text-sm text-soft leading-relaxed">{body}</p>
    </div>
  );
}

function OpenLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 rounded-full border border-line px-4 py-2 text-sm text-soft hover:text-ink hover:border-ink/25 transition-colors"
    >
      {icon}
      {label}
    </Link>
  );
}
