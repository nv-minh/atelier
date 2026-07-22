"use client";

import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { StatCard } from "@/components/stats/stat-card";
import { CefrProgress } from "@/components/stats/cefr-progress";
import { useI18n } from "@/components/i18n-provider";

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

export function HomeView({ stats }: { stats: HomeStats }) {
  const { t } = useI18n();

  return (
    <main className="shell pb-28 md:pb-16">
      {/* HERO */}
      <section className="pt-10 sm:pt-16 pb-12 sm:pb-16 relative">
        <div className="max-w-3xl">
          <div className="animate-fade-up">
            <p className="text-sm text-soft font-mono mb-4 flex items-center gap-2">
              <Sparkles size={14} className="text-ember" />
              {stats.streak > 0 ? t("home.streakActive", { n: stats.streak }) : t("home.newDay")}
            </p>
          </div>
          <h1 className="display text-display-xl mb-6 animate-fade-up" style={{ animationDelay: "60ms", animationFillMode: "both" }}>
            {t("home.title1")}
            <br />
            <span className="display-it text-ember">{t("home.title2")}</span>
          </h1>
          <p
            className="text-lg sm:text-xl text-soft leading-relaxed max-w-xl mb-8 animate-fade-up"
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
              className="inline-flex items-center justify-center gap-2 rounded-full border border-line px-7 py-3.5 font-medium hover:bg-paper-200/50 transition-colors"
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
          <span className="display display-it text-[26rem] leading-[0.8] text-ink/[0.06]">a</span>
          <div className="flex flex-col gap-3 mt-8">
            <span className="h-24 w-px bg-ember/30" />
            <span className="text-[10px] uppercase tracking-[0.3em] text-soft/40 font-mono [writing-mode:vertical-rl] rotate-180">
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
        </div>
      </section>
    </main>
  );

  function TodayCard({ newCards, reviews, accuracy, total }: { newCards: number; reviews: number; accuracy: number; total: number }) {
    return (
      <div className="card-atelier p-6 sm:p-7 h-full flex flex-col justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-soft font-semibold mb-1">{t("home.today")}</p>
          <p className="display text-4xl tabular-nums">{total}</p>
          <p className="text-xs text-soft">{t("home.cardsStudied")}</p>
        </div>
        <div className="grid grid-cols-3 gap-3 mt-6 pt-5 border-t border-line">
          <div>
            <p className="display text-xl tabular-nums text-ember">{newCards}</p>
            <p className="text-[10px] text-soft uppercase tracking-wide">{t("home.new_")}</p>
          </div>
          <div>
            <p className="display text-xl tabular-nums">{reviews}</p>
            <p className="text-[10px] text-soft uppercase tracking-wide">{t("home.reviews")}</p>
          </div>
          <div>
            <p className="display text-xl tabular-nums text-moss-500">{total > 0 ? `${accuracy.toFixed(0)}%` : "—"}</p>
            <p className="text-[10px] text-soft uppercase tracking-wide">{t("home.correct")}</p>
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
      <p className="text-xs text-soft">{desc}</p>
    </Link>
  );
}
