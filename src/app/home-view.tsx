"use client";

import Link from "next/link";
import { ArrowRight, Sparkles, Flame } from "lucide-react";
import { StatCard } from "@/components/stats/stat-card";
import { CefrProgress } from "@/components/stats/cefr-progress";
import { LevelCard } from "@/components/gamification/level-card";
import { GoalRing } from "@/components/gamification/goal-ring";
import { DailyQuote } from "@/components/daily-quote";
import { useI18n } from "@/components/i18n-provider";
import { ReminderBanner } from "@/components/reminder-banner";
import { ContributeBanner } from "@/components/contribute-card";
import type { GamificationSummary } from "@/lib/gamification";
import type { Reminder } from "@/lib/reminders/pick";

export type HomeStats = {
  totalWords: number;
  totalCards: number;
  learnedCards: number;
  learningCards: number;
  newCardsSeen: number;
  dueToday: number;
  cefrStats: Array<{ level: string; total: number; learned: number; learning: number; unseen: number }>;
  today: { newCards: number; reviews: number; correctCount: number; totalCount: number; accuracy: number };
  streak: number;
  accuracy: number;
};

export function HomeView({
  stats,
  leechCount,
  gamify,
  cefrBand,
  reminder,
}: {
  stats: HomeStats;
  leechCount: number;
  gamify: GamificationSummary;
  /**
   * CEFR band + field labels, or null when nobody has taken the level check.
   * NOT `gamify.level`, which is the XP level — two different meanings of
   * "level" render in this component, so this one says which it is.
   */
  cefrBand: { band: string; topics: string[] } | null;
  /** The one reminder worth showing today, or null when there is nothing to say. */
  reminder: Reminder | null;
}) {
  const { t } = useI18n();

  return (
    <main className="shell pb-28 md:pb-16">
      {/* DAILY QUOTE — first thing on the page, so it is read rather than
          scrolled past. It renders nothing until the text has arrived and
          nothing at all once dismissed, so on the days it is absent the hero
          simply sits at the top as before. */}
      <DailyQuote className="mt-6 sm:mt-10" />

      {/* HERO */}
      <section className="pt-10 sm:pt-16 pb-12 sm:pb-16 relative">
        {reminder && <ReminderBanner reminder={reminder} />}
        <div className="max-w-3xl">
          <div className="animate-fade-up flex flex-wrap items-center gap-3 mb-4">
            <p className="text-sm text-fg-muted font-mono flex items-center gap-2">
              <Sparkles size={14} className="text-ember" />
              {stats.streak > 0 ? t("home.streakActive", { n: stats.streak }) : t("home.newDay")}
            </p>
            {cefrBand && (
              <Link
                href="/settings"
                className="inline-flex items-center gap-1.5 rounded-full bg-ember/10 text-ember px-3 py-1 text-xs font-semibold hover:bg-ember/15 transition-colors"
                title={t("profile.sectionTitle")}
              >
                {t("profile.homeLine")} {cefrBand.band}
                {cefrBand.topics.length > 0 && ` · ${cefrBand.topics.join(" · ")}`}
              </Link>
            )}
            {leechCount > 0 && (
              <Link
                href="/notebook?tab=leeches"
                className="inline-flex items-center gap-1.5 rounded-full bg-red-400/10 text-red-400 px-3 py-1 text-xs font-semibold hover:bg-red-400/15 transition-colors"
              >
                <Flame size={12} /> {t("home.leechChip", { n: leechCount })}
              </Link>
            )}
          </div>
          <h1 className="display text-display-xl mb-6 animate-fade-up" style={{ animationDelay: "60ms", animationFillMode: "both" }}>
            {t("home.title1")}
            <br />
            <span className="display-it text-ember">{t("home.title2")}</span>
          </h1>
          <p
            className="text-lg sm:text-xl text-fg-muted leading-relaxed max-w-xl mb-8 animate-fade-up"
            style={{ animationDelay: "140ms", animationFillMode: "both" }}
          >
            {t("home.subtitle", { n: stats.totalWords.toLocaleString() })}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 animate-fade-up" style={{ animationDelay: "220ms", animationFillMode: "both" }}>
            <Link
              href="/study/flashcard"
              className="group inline-flex items-center justify-center gap-2 rounded-full bg-ink text-paper px-7 py-3.5 font-medium hover:opacity-90 transition-opacity"
            >
              {stats.dueToday > 0 ? t("home.studyDue", { n: stats.dueToday }) : t("home.startStudying")}
              <ArrowRight size={18} className="group-hover:translate-x-0.5 transition-transform" />
            </Link>
            <Link
              href="/study"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-hairline/10 px-7 py-3.5 font-medium hover:bg-paper-200/50 transition-colors"
            >
              {t("home.chooseMode")}
            </Link>
          </div>
        </div>

        {/* editorial decorative mark */}
        <div
          aria-hidden
          className="hidden lg:flex absolute top-10 right-[-4rem] select-none pointer-events-none items-start gap-6"
        >
          <span className="display display-it text-[26rem] leading-[0.8] text-fg/[0.06]">a</span>
          <div className="flex flex-col gap-3 mt-8">
            <span className="h-24 w-px bg-ember/30" />
            <span className="text-[10px] uppercase tracking-[0.3em] text-fg-muted/40 font-mono [writing-mode:vertical-rl] rotate-180">
              {t("home.decoMark")}
            </span>
          </div>
        </div>
      </section>

      {/* STAT GRID */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
        <StatCard label={t("home.dueToday")} value={stats.dueToday} sub={t("home.cardsToReview")} accent="text-ember" delay={0} />
        <StatCard label={t("home.streak")} value={`${stats.streak}d`} sub={t("home.consecutiveDays")} delay={60} />
        <StatCard label={t("home.learned")} value={stats.learnedCards} sub={t("home.of", { n: stats.totalWords.toLocaleString() })} accent="text-moss-500" delay={120} />
        <StatCard label={t("home.recall")} value={`${stats.accuracy.toFixed(0)}%`} sub={t("home.last100")} delay={180} />
      </section>

      {/* LEVEL + GOAL */}
      <section className="grid sm:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8">
        <LevelCard
          level={gamify.level}
          currentLevelXp={gamify.currentLevelXp}
          nextLevelXp={gamify.nextLevelXp}
          progress01={gamify.progress01}
          xp={gamify.xp}
        />
        <GoalRing todayXp={gamify.todayXp} dailyGoalXp={gamify.dailyGoalXp} delay={60} />
      </section>

      {/* TODAY + CEFR */}
      <section className="grid lg:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
        <TodayCard
          newCards={stats.today.newCards}
          reviews={stats.today.reviews}
          accuracy={stats.today.accuracy}
          total={stats.today.totalCount}
        />
        <div className="lg:col-span-2">
          <CefrProgress stats={stats.cefrStats} />
        </div>
      </section>

      {/* MODE GRID */}
      <section>
        <h2 className="display text-2xl mb-5">{t("home.waysToStudy")}</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <ModeCard href="/study/flashcard" title={t("home.cards")} desc={t("home.cardsDesc")} emoji="🎴" />
          <ModeCard href="/study/quiz" title={t("home.quiz")} desc={t("home.quizDesc")} emoji="✓" />
          <ModeCard href="/study/typing" title={t("home.typeIt")} desc={t("home.typeItDesc")} emoji="⌨️" />
          <ModeCard href="/study/dictation" title={t("home.listen")} desc={t("home.listenDesc")} emoji="🎧" />
          <ModeCard href="/study/matching" title={t("home.matching")} desc={t("home.matchingDesc")} emoji="🧩" />
          <ModeCard href="/study/pronunciation" title={t("home.pron")} desc={t("home.pronDesc")} emoji="🎤" />
          <ModeCard href="/grammar" title={t("grammar.home.title")} desc={t("grammar.home.desc")} emoji="📖" />
        </div>
      </section>

      {/* FEEDBACK — the dashboard has no footer, so without this the only way
          to reach the feedback address was user menu -> settings -> scroll. */}
      <ContributeBanner className="mt-14 sm:mt-20" />
    </main>
  );

  function TodayCard({ newCards, reviews, accuracy, total }: { newCards: number; reviews: number; accuracy: number; total: number }) {
    return (
      <div className="card-atelier p-6 sm:p-7 h-full flex flex-col justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-fg-muted font-semibold mb-1">{t("home.today")}</p>
          <p className="display text-4xl tabular-nums">{total}</p>
          <p className="text-xs text-fg-muted">{t("home.cardsStudied")}</p>
        </div>
        <div className="grid grid-cols-3 gap-3 mt-6 pt-5 border-t border-hairline/10">
          <div>
            <p className="display text-xl tabular-nums text-ember">{newCards}</p>
            <p className="text-[10px] text-fg-muted uppercase tracking-wide">{t("home.new_")}</p>
          </div>
          <div>
            <p className="display text-xl tabular-nums">{reviews}</p>
            <p className="text-[10px] text-fg-muted uppercase tracking-wide">{t("home.reviews")}</p>
          </div>
          <div>
            <p className="display text-xl tabular-nums text-moss-500">{total > 0 ? `${accuracy.toFixed(0)}%` : "—"}</p>
            <p className="text-[10px] text-fg-muted uppercase tracking-wide">{t("home.correct")}</p>
          </div>
        </div>
      </div>
    );
  }
}

function ModeCard({ href, title, desc, emoji }: { href: string; title: string; desc: string; emoji: string }) {
  return (
    <Link href={href} className="group card-atelier p-5 hover:-translate-y-0.5 transition-transform border hover:border-ember/30">
      <div className="text-2xl mb-3">{emoji}</div>
      <p className="display text-lg mb-0.5">{title}</p>
      <p className="text-xs text-fg-muted">{desc}</p>
    </Link>
  );
}
