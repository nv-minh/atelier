"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, ArrowRight, CheckCircle2, PencilRuler, X } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { buttonVariantClasses } from "@/lib/ui/button-classes";
import { SEMANTIC_LEGEND } from "@/lib/grammar/semantic-classes";
import type { LessonPageData } from "@/lib/grammar/data";

// Legend chips only for roles actually present in the rendered HTML — a tense
// lesson shouldn't open with an "Adjective" chip it never uses.
function presentLegend(html: string) {
  return SEMANTIC_LEGEND.filter((l) => html.includes(`class="${l.cls}"`));
}

export function LessonReader({ data, authed }: { data: NonNullable<LessonPageData>; authed: boolean }) {
  const { t, lang } = useI18n();
  const router = useRouter();
  const { topic, lesson } = data;
  const [read, setRead] = useState(data.read);
  const [justEarned, setJustEarned] = useState(0);
  const [saving, setSaving] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);

  const wantVi = lang === "vi";
  const viMissing = wantVi && !lesson.contentViHtml;
  const html = wantVi && lesson.contentViHtml ? lesson.contentViHtml : lesson.contentEnHtml;
  const title = wantVi && lesson.titleVi ? lesson.titleVi : lesson.titleEn;
  const topicName = wantVi && topic.nameVi ? topic.nameVi : topic.nameEn;
  const legend = useMemo(() => presentLegend(html), [html]);

  // Event delegation for the zoomable timeline images — the HTML is server-
  // sanitized (Plan 1's whitelist is the only gate), we only read `src` here.
  const onProseClick = (e: React.MouseEvent) => {
    const img = (e.target as Element).closest("img");
    if (img instanceof HTMLImageElement && img.src) setLightbox(img.src);
  };

  // Lightbox a11y: Escape to close, lock body scroll while open.
  useEffect(() => {
    if (!lightbox) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightbox(null);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [lightbox]);

  const markRead = async () => {
    if (read || saving) return;
    if (!authed) {
      router.push(`/login?callbackUrl=${encodeURIComponent(`/grammar/${topic.slug}/lesson/${lesson.order}`)}`);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/grammar/lesson-read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonId: lesson.id }),
      });
      if (res.ok) {
        const d = await res.json();
        setRead(true);
        if (typeof d.xpGained === "number") setJustEarned(d.xpGained);
      }
    } catch {
      // network failure — leave unread; the button stays tappable to retry
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="shell py-8 sm:py-12 pb-28 md:pb-14 max-w-3xl">
      <Link href={`/grammar/${topic.slug}`} className="inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg mb-5">
        <ArrowLeft size={15} /> {topicName}
      </Link>

      <header className="mb-5">
        <p className="text-xs font-mono text-fg-muted mb-2">
          {t("grammar.lesson.ofTopic", { order: lesson.order, topic: topicName })}
        </p>
        <h1 className="display text-display-md">{title}</h1>
      </header>

      {viMissing && (
        <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-hairline/10 px-3.5 py-1.5 text-xs text-fg-muted">
          {t("grammar.lesson.viUpdating")}
        </p>
      )}

      {legend.length > 0 && (
        <div className="mb-6 flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] uppercase tracking-wider text-fg-muted font-semibold mr-1">
            {t("grammar.legend.title")}
          </span>
          {legend.map((l) => (
            <span key={l.cls} className="grammar-chip" style={{ ["--chip" as string]: `var(--gr-${l.cls === "signal-word" ? "adverb" : l.cls})` }}>
              {t(l.labelKey)}
            </span>
          ))}
        </div>
      )}

      {/* Sanitized at import time (Plan 1) — the DB never holds unsafe HTML. */}
      <article className="grammar-prose" onClick={onProseClick} dangerouslySetInnerHTML={{ __html: html }} />

      <div className="mt-10 flex flex-wrap items-center gap-3">
        <button
          onClick={markRead}
          disabled={saving}
          className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium transition-colors ${
            read
              ? "border border-moss-500/40 bg-moss-500/10 text-moss-600 dark:text-moss-400 cursor-default"
              : buttonVariantClasses("primary")
          }`}
        >
          <CheckCircle2 size={15} />
          {read ? t("grammar.lesson.markedRead") : t("grammar.lesson.markRead")}
          {justEarned > 0 && <span className="text-ember font-semibold">+{justEarned} XP</span>}
        </button>
        {topic.testQuestionCount > 0 && (
          <Link
            href={`/grammar/${topic.slug}/test`}
            className="inline-flex items-center gap-2 rounded-full border border-hairline/10 px-5 py-2.5 text-sm font-medium hover:bg-paper-200/50"
          >
            <PencilRuler size={15} /> {t("grammar.lesson.takeTest")}
          </Link>
        )}
      </div>

      <nav className="mt-8 flex items-center justify-between border-t border-hairline/10 pt-5">
        {data.prevOrder != null ? (
          <Link href={`/grammar/${topic.slug}/lesson/${data.prevOrder}`} className="inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg">
            <ArrowLeft size={15} /> {t("grammar.lesson.prev")}
          </Link>
        ) : (
          <span />
        )}
        {data.nextOrder != null ? (
          <Link href={`/grammar/${topic.slug}/lesson/${data.nextOrder}`} className="inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg">
            {t("grammar.lesson.next")} <ArrowRight size={15} />
          </Link>
        ) : (
          <span />
        )}
      </nav>

      <AnimatePresence>
        {lightbox && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-ink/85 flex items-center justify-center p-4 cursor-zoom-out"
            onClick={() => setLightbox(null)}
          >
            <button aria-label="Close" className="absolute top-4 right-4 text-paper/80 hover:text-paper">
              <X size={26} />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={lightbox} alt="" className="max-h-[90vh] max-w-full rounded-xl bg-white p-2" />
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
