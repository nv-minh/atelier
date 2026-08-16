"use client";

// The 90-second level check. Guests can take the whole thing — the ask for a
// login lands on the result screen, once there is something worth saving.
//
// The adaptive logic lives in src/lib/placement/* (pure and unit-tested); this
// component owns only the browser plumbing: fetching the bank, feeding answers
// to the ladder, and deciding what to render.
//
// The result shown here is computed locally for immediacy, but it is NOT what
// gets stored: POST /api/placement/result recomputes the estimate from the raw
// answers server-side. A client cannot post itself a level.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Sparkles, X } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { useAuthGate } from "@/components/auth-gate";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { TOPICS } from "@/lib/topic-taxonomy";
import { BLOCK_SIZE, type BlockResult, nextLadderStep } from "@/lib/placement/ladder";
import { bandToCefr, estimatePlacement } from "@/lib/placement/estimate";
import { clearDraft, readDraft, writeDraft } from "@/lib/placement/storage";
import { cn } from "@/lib/utils";

type Item = { id: string; word: string; cefr: string };
type Bank = { items: Item[]; traps: string[] };

/** One thing on screen: a real word to judge, or a pseudoword. */
type Asked =
  | { kind: "real"; item: Item; band: number }
  | { kind: "trap"; word: string };

/** A trap roughly every this many real items, so they cannot be anticipated. */
const TRAP_EVERY = 8;

type Phase = "intro" | "asking" | "result" | "topics" | "saving";

export function OnboardingFlow() {
  const { t } = useI18n();
  const router = useRouter();
  const { open } = useAuthGate();

  const [bank, setBank] = useState<Bank | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [phase, setPhase] = useState<Phase>("intro");

  const [blocks, setBlocks] = useState<BlockResult[]>([]);
  const [current, setCurrent] = useState<Asked | null>(null);
  const [blockKnown, setBlockKnown] = useState(0);
  const [blockAsked, setBlockAsked] = useState(0);
  // The band the CURRENT block is measuring, held explicitly rather than
  // inferred from the last closed block: a trap lands between two real items, so
  // inference would resume the block at the previous band instead of this one.
  const [blockBand, setBlockBand] = useState(2);
  const [answers, setAnswers] = useState<Array<{ wordId: string; known: boolean }>>([]);
  const [trapAnswers, setTrapAnswers] = useState<Array<{ word: string; known: boolean }>>([]);
  const [topics, setTopics] = useState<string[]>([]);
  const [savedForGuest, setSavedForGuest] = useState(false);

  // Ids already shown, so a band re-drawn from the bank never repeats a word.
  const usedIds = useRef<Set<string>>(new Set());
  const usedTraps = useRef<Set<string>>(new Set());

  const loadBank = useCallback(async () => {
    setLoadError(false);
    try {
      const res = await fetch("/api/placement/items", { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      setBank((await res.json()) as Bank);
    } catch {
      setLoadError(true);
    }
  }, []);

  useEffect(() => {
    void loadBank();
  }, [loadBank]);

  const estimate = useMemo(
    () =>
      estimatePlacement({
        blocks,
        traps: { total: trapAnswers.length, known: trapAnswers.filter((a) => a.known).length },
      }),
    [blocks, trapAnswers]
  );

  /** Next unused real item at `band`, or null if that band is exhausted. */
  const drawReal = useCallback(
    (band: number): Item | null => {
      if (!bank) return null;
      const label = bandToCefr(band);
      return bank.items.find((i) => i.cefr === label && !usedIds.current.has(i.id)) ?? null;
    },
    [bank]
  );

  const drawTrap = useCallback((): string | null => {
    if (!bank) return null;
    return bank.traps.find((w) => !usedTraps.current.has(w)) ?? null;
  }, [bank]);

  /**
   * Decide what to show next: finish, slip in a trap, continue the block, or ask
   * the ladder for a new band.
   */
  const advance = useCallback(
    (nextBlocks: BlockResult[], realAsked: number, inBlock: { asked: number; band: number }) => {
      // Traps are due by count, not by remainder: a trap does not increment the
      // real-item total, so `realAsked % TRAP_EVERY === 0` would stay true and
      // fire again on the very next step.
      const trapsDue = Math.floor(realAsked / TRAP_EVERY);
      if (trapsDue > usedTraps.current.size) {
        const trap = drawTrap();
        if (trap) {
          usedTraps.current.add(trap);
          setCurrent({ kind: "trap", word: trap });
          return;
        }
      }

      // Mid-block: keep asking at the band this block is measuring.
      if (inBlock.asked > 0 && inBlock.asked < BLOCK_SIZE) {
        const item = drawReal(inBlock.band);
        if (item) {
          usedIds.current.add(item.id);
          setCurrent({ kind: "real", item, band: inBlock.band });
          return;
        }
        // Band ran dry — fall through and let the ladder pick another.
      }

      const step = nextLadderStep(nextBlocks);
      if (step.done) {
        setCurrent(null);
        setPhase("result");
        return;
      }
      const item = drawReal(step.band);
      if (!item) {
        // No items left at the band the ladder wants: stop rather than loop.
        setCurrent(null);
        setPhase("result");
        return;
      }
      usedIds.current.add(item.id);
      setBlockAsked(0);
      setBlockKnown(0);
      setBlockBand(step.band);
      setCurrent({ kind: "real", item, band: step.band });
    },
    [drawReal, drawTrap]
  );

  const start = useCallback(() => {
    setPhase("asking");
    advance([], 0, { asked: 0, band: 2 });
  }, [advance]);

  const answer = useCallback(
    (known: boolean) => {
      if (!current) return;

      if (current.kind === "trap") {
        setTrapAnswers((a) => [...a, { word: current.word, known }]);
        // Traps never touch the block score — they measure guessing, not level —
        // so the block resumes at exactly the point the trap interrupted.
        advance(blocks, answers.length, { asked: blockAsked, band: blockBand });
        return;
      }

      const nextAnswers = [...answers, { wordId: current.item.id, known }];
      const asked = blockAsked + 1;
      const knownCount = blockKnown + (known ? 1 : 0);
      setAnswers(nextAnswers);

      if (asked >= BLOCK_SIZE) {
        const closed: BlockResult = { band: current.band, known: knownCount, total: asked };
        const nextBlocks = [...blocks, closed];
        setBlocks(nextBlocks);
        setBlockAsked(0);
        setBlockKnown(0);
        advance(nextBlocks, nextAnswers.length, { asked: 0, band: current.band });
      } else {
        setBlockAsked(asked);
        setBlockKnown(knownCount);
        advance(blocks, nextAnswers.length, { asked, band: current.band });
      }
    },
    [advance, answers, blockAsked, blockBand, blocks, current]
  );

  // Keyboard: 1 = know, 2 = don't. Same shape as the study screen's shortcuts.
  useEffect(() => {
    if (phase !== "asking" || !current) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "1") answer(true);
      else if (e.key === "2") answer(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [answer, current, phase]);

  /** Persist locally, then try to save. A 401 means "guest" — open the gate. */
  const finish = useCallback(
    async (chosen: string[]) => {
      const draft = {
        version: 1 as const,
        takenAt: Date.now(),
        items: answers,
        traps: trapAnswers,
        topics: chosen,
        estimate: {
          band: estimate.band,
          vocabSizeEst: estimate.vocabSizeEst,
          estimatorVersion: estimate.estimatorVersion,
        },
      };
      writeDraft(draft);
      setPhase("saving");

      try {
        const res = await fetch("/api/placement/result", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(draft),
        });
        if (res.status === 401) {
          setSavedForGuest(true);
          setPhase("topics");
          // The draft stays in localStorage; returning here after login applies it.
          open({ callbackUrl: "/onboarding", reason: "placement" });
          return;
        }
        if (!res.ok) throw new Error(String(res.status));
        clearDraft();
        router.push("/study");
      } catch {
        // Saved locally at least — let them through rather than trapping them.
        setSavedForGuest(true);
        setPhase("topics");
      }
    },
    [answers, estimate, open, router, trapAnswers]
  );

  // Coming back from a successful login: a draft is waiting, so apply it.
  useEffect(() => {
    const draft = readDraft();
    if (!draft) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/placement/result", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(draft),
        });
        if (cancelled || !res.ok) return;
        clearDraft();
        router.push("/study");
      } catch {
        // Still a guest, or offline. The draft stays put.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const bandLabel = bandToCefr(estimate.band);
  const knownWords = answers
    .filter((a) => a.known)
    .map((a) => bank?.items.find((i) => i.id === a.wordId)?.word)
    .filter((w): w is string => !!w)
    .slice(0, 5);
  const unknownWords = answers
    .filter((a) => !a.known)
    .map((a) => bank?.items.find((i) => i.id === a.wordId)?.word)
    .filter((w): w is string => !!w)
    .slice(0, 5);

  if (loadError) {
    return (
      <Card>
        <p className="text-fg-muted mb-6">{t("onboarding.error")}</p>
        <PrimaryButton onClick={() => void loadBank()}>{t("onboarding.retry")}</PrimaryButton>
      </Card>
    );
  }

  if (!bank) {
    return (
      <Card>
        <Loader2 className="mx-auto mb-4 animate-spin text-fg-muted" size={22} />
        <p className="text-fg-muted">{t("onboarding.loading")}</p>
      </Card>
    );
  }

  if (phase === "intro") {
    return (
      <Card>
        <Chip className="text-[10px] text-fg-muted mb-4">{t("onboarding.introHeader")}</Chip>
        <h1 className="display text-2xl sm:text-3xl mb-3">{t("onboarding.introTitle")}</h1>
        <p className="text-fg-muted leading-relaxed mb-4">{t("onboarding.introBody")}</p>
        <p className="text-fg-muted/80 text-sm leading-relaxed mb-7">{t("onboarding.introHonest")}</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <PrimaryButton onClick={start}>{t("onboarding.start")}</PrimaryButton>
          <button
            onClick={() => router.push("/")}
            className="rounded-full px-6 py-3 text-fg-muted hover:text-fg transition-colors"
          >
            {t("onboarding.skip")}
          </button>
        </div>
      </Card>
    );
  }

  if (phase === "asking" && current) {
    return (
      <Card>
        {/* No "question 4 of 20": the ladder is adaptive, so the total is genuinely
            not known in advance. Claiming one would be a lie. */}
        <Chip className="text-[10px] text-fg-muted mb-6">{t("onboarding.progress")}</Chip>
        <p className="text-fg-muted text-sm mb-3">{t("onboarding.question")}</p>
        <p className="display text-3xl sm:text-4xl mb-9 break-words">
          {current.kind === "real" ? current.item.word : current.word}
        </p>
        <div className="flex gap-3 justify-center">
          <Button onClick={() => answer(true)} variant="primary" size="md">
            <Check size={16} strokeWidth={2.5} />
            {t("onboarding.know")}
          </Button>
          <button
            onClick={() => answer(false)}
            className="inline-flex items-center gap-2 rounded-full border border-ink/15 px-7 py-3 font-medium hover:bg-ink/5 transition-colors"
          >
            <X size={16} strokeWidth={2.5} />
            {t("onboarding.dontKnow")}
          </button>
        </div>
        <p className="text-fg-muted/70 text-xs mt-6">{t("onboarding.keyHint")}</p>
      </Card>
    );
  }

  if (phase === "result") {
    return (
      <Card>
        <Chip className="text-[10px] text-fg-muted mb-4">{t("onboarding.resultHeader")}</Chip>
        <p className="text-fg-muted text-sm mb-1">{t("onboarding.resultTitle")}</p>
        <p className="display text-5xl mb-6 text-ember">{bandLabel}</p>

        <div className="mb-7">
          <p className="text-fg-muted text-xs uppercase tracking-wide mb-1">
            {t("onboarding.vocabEst")}
          </p>
          <p className="display text-2xl">
            ~{estimate.vocabSizeEst.toLocaleString()} {t("onboarding.words")}
          </p>
        </div>

        {estimate.falseAlarmRate > 0 && (
          // Stated plainly, without accusing anyone: the correction already
          // happened, and hiding it would make the number look arbitrary.
          <p className="text-fg-muted/80 text-sm leading-relaxed mb-6">
            {t("onboarding.trapNotice")}
          </p>
        )}

        <div className="grid sm:grid-cols-2 gap-4 text-left mb-8">
          <WordList label={t("onboarding.knownSample")} words={knownWords} />
          <WordList label={t("onboarding.nextSample")} words={unknownWords} />
        </div>

        <PrimaryButton onClick={() => setPhase("topics")}>
          {t("onboarding.finish")}
        </PrimaryButton>
      </Card>
    );
  }

  // topics + saving
  return (
    <Card>
      <Chip className="text-[10px] text-fg-muted mb-4">{t("onboarding.topicsHeader")}</Chip>
      <h2 className="display text-2xl mb-3">{t("onboarding.topicsTitle")}</h2>
      <p className="text-fg-muted leading-relaxed mb-7">{t("onboarding.topicsBody")}</p>

      <div className="flex flex-wrap gap-2 justify-center mb-8">
        {TOPICS.map((topic) => {
          const on = topics.includes(topic.slug);
          return (
            <button
              key={topic.slug}
              onClick={() =>
                setTopics((cur) =>
                  cur.includes(topic.slug)
                    ? cur.filter((s) => s !== topic.slug)
                    : [...cur, topic.slug]
                )
              }
              aria-pressed={on}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm transition-colors",
                on
                  ? "border-ember bg-ember/10 text-ember"
                  : "border-ink/15 text-fg-muted hover:bg-ink/5"
              )}
            >
              <span aria-hidden>{topic.emoji}</span>
              {topic.name}
            </button>
          );
        })}
      </div>

      {savedForGuest && (
        <p className="text-fg-muted/80 text-sm mb-5">{t("onboarding.savedGuest")}</p>
      )}

      <PrimaryButton onClick={() => void finish(topics)} disabled={phase === "saving"}>
        {phase === "saving" ? (
          <Loader2 className="animate-spin" size={16} />
        ) : (
          <Sparkles size={16} strokeWidth={2.5} />
        )}
        {topics.length ? t("onboarding.finish") : t("onboarding.topicsSkip")}
      </PrimaryButton>
    </Card>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="card-atelier p-8 sm:p-10 text-center max-w-lg mx-auto animate-fade-up">
      {children}
    </div>
  );
}

function PrimaryButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <Button onClick={onClick} disabled={disabled} variant="primary" size="md">
      {children}
    </Button>
  );
}

function WordList({ label, words }: { label: string; words: string[] }) {
  if (!words.length) return null;
  return (
    <div>
      <p className="text-fg-muted text-xs uppercase tracking-wide mb-2">{label}</p>
      <ul className="space-y-1">
        {words.map((w) => (
          <li key={w} className="text-sm">
            {w}
          </li>
        ))}
      </ul>
    </div>
  );
}
