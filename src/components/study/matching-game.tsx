"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { CheckCircle2, RotateCcw, Layers } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { useAchievementToasts } from "@/components/gamification/achievement-toast";

type MatchingItem = { wordId: string; word: string; def: string };

type Tile = {
  id: string; // unique per tile (kind + pairId)
  pairId: string; // the wordId — a word tile and its def tile share this
  kind: "word" | "def";
  label: string;
};

type TileState = "idle" | "selected" | "matched" | "wrong";

// Turn one round's items into a shuffled 12-tile grid: a word tile and a def tile
// per item, sharing pairId (the wordId) so a correct pairing is pairId equality
// across the two kinds.
function buildTiles(items: MatchingItem[]): Tile[] {
  const tiles: Tile[] = [];
  for (const it of items) {
    tiles.push({ id: `w-${it.wordId}`, pairId: it.wordId, kind: "word", label: it.word });
    tiles.push({ id: `d-${it.wordId}`, pairId: it.wordId, kind: "def", label: it.def });
  }
  // Fisher–Yates so word and def tiles interleave.
  for (let i = tiles.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
  }
  return tiles;
}

function fmtTime(sec: number): string {
  const mm = String(Math.floor(sec / 60)).padStart(2, "0");
  const ss = String(sec % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

export function MatchingGame({ rounds }: { rounds: MatchingItem[][] }) {
  const { t } = useI18n();
  const { push: pushToast, toaster } = useAchievementToasts();

  const pairsPerRound = rounds[0]?.length ?? 0;
  const totalPairs = rounds.reduce((n, r) => n + r.length, 0);

  const [roundIdx, setRoundIdx] = useState(0);
  const [tiles, setTiles] = useState<Tile[]>(() => buildTiles(rounds[0] ?? []));
  const [states, setStates] = useState<Record<string, TileState>>({});
  const [selected, setSelected] = useState<Tile | null>(null);
  const [matchedCount, setMatchedCount] = useState(0); // matched pairs in current round
  const [mistakes, setMistakes] = useState(0);
  // Mirror mistakes in a ref so session-end reads the true final count regardless
  // of when the completing match's closure was created (no stale-closure drift).
  const mistakesRef = useRef(0);
  const [locking, setLocking] = useState(false); // brief guard during wrong-flash
  const [done, setDone] = useState(false);
  const [xpGained, setXpGained] = useState(0);

  // Global timer: seconds since mount, ticking until the game completes.
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef<number>(Date.now());

  // session tracking. `sessionStartRef` holds the in-flight (or settled) start-POST
  // promise resolving to the session id (or null on failure); endSession awaits it
  // so a completion racing ahead of the start can't drop the session.
  const sessionStartRef = useRef<Promise<string | null> | null>(null);
  const endedRef = useRef(false); // guard against double session-end
  const startSession = useCallback((): Promise<string | null> => {
    const p = fetch("/api/study/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "matching" }),
    })
      .then((r) => r.json())
      .then((d) => (d?.sessionId as string) ?? null)
      .catch(() => null);
    sessionStartRef.current = p;
    return p;
  }, []);

  // Transient tile-animation timers (wrong-flash clear, round-advance beat).
  // Tracked so they're all cleared if the component unmounts mid-flash — no
  // setState-after-unmount from a stray timer.
  const timersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  const later = useCallback((fn: () => void, ms: number) => {
    const id = setTimeout(() => {
      timersRef.current.delete(id);
      fn();
    }, ms);
    timersRef.current.add(id);
  }, []);
  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      for (const id of timers) clearTimeout(id);
      timers.clear();
    };
  }, []);

  // Start the session once on mount.
  useEffect(() => {
    startRef.current = Date.now();
    startSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Ticking timer — stops once `done`. Cleared on unmount.
  useEffect(() => {
    if (done) return;
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [done]);

  // End the session exactly once, on completion. Awaits the start-POST so a fast
  // completion (racing the start request) still gets a session id rather than
  // silently dropping the session. The endedRef guard is set synchronously up
  // front so a double-completion can't fire two PATCHes even before the await.
  const endSession = useCallback(async () => {
    if (endedRef.current) return;
    endedRef.current = true;
    const durationSec = Math.round((Date.now() - startRef.current) / 1000);
    const finalMistakes = mistakesRef.current;
    const correctCount = Math.max(0, totalPairs - Math.min(finalMistakes, totalPairs));
    const sid = await (sessionStartRef.current ?? Promise.resolve(null));
    if (!sid) return; // start POST failed — nothing to end (award is best-effort)
    try {
      const res = await fetch("/api/study/session", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: sid,
          cardsReviewed: totalPairs,
          correctCount,
          durationSec,
        }),
      });
      const d = await res.json();
      if (d && typeof d.xpGained === "number") setXpGained(d.xpGained);
      if (d && Array.isArray(d.unlocked) && d.unlocked.length) pushToast(d.unlocked);
    } catch {}
  }, [totalPairs, pushToast]);

  const advance = useCallback(
    () => {
      const next = roundIdx + 1;
      if (next >= rounds.length) {
        setDone(true);
        setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
        endSession();
        return;
      }
      setRoundIdx(next);
      setTiles(buildTiles(rounds[next]));
      setStates({});
      setSelected(null);
      setMatchedCount(0);
    },
    [roundIdx, rounds, endSession]
  );

  const onTile = useCallback(
    (tile: Tile) => {
      if (locking || done) return;
      const st = states[tile.id];
      if (st === "matched") return; // already locked in

      // First pick of the pair, or re-pick of the same tile (toggle off).
      if (!selected) {
        setSelected(tile);
        setStates((s) => ({ ...s, [tile.id]: "selected" }));
        return;
      }
      if (selected.id === tile.id) {
        setSelected(null);
        setStates((s) => ({ ...s, [tile.id]: "idle" }));
        return;
      }
      // Two same-kind tiles → second replaces the selection (spec).
      if (selected.kind === tile.kind) {
        setStates((s) => ({ ...s, [selected.id]: "idle", [tile.id]: "selected" }));
        setSelected(tile);
        return;
      }

      // A word tile and a def tile are now both chosen — resolve.
      const isMatch = selected.pairId === tile.pairId;
      if (isMatch) {
        const a = selected.id;
        const b = tile.id;
        setStates((s) => ({ ...s, [a]: "matched", [b]: "matched" }));
        setSelected(null);
        const newMatched = matchedCount + 1;
        setMatchedCount(newMatched);
        if (newMatched >= pairsPerRound) {
          // Round complete — short beat, then advance.
          setLocking(true);
          later(() => {
            setLocking(false);
            advance();
          }, 550);
        }
      } else {
        // Wrong: flash both red, count a mistake, then deselect.
        const a = selected.id;
        const b = tile.id;
        setLocking(true);
        setStates((s) => ({ ...s, [a]: "wrong", [b]: "wrong" }));
        mistakesRef.current += 1;
        setMistakes(mistakesRef.current);
        setSelected(null);
        later(() => {
          setStates((s) => {
            const next = { ...s };
            if (next[a] === "wrong") next[a] = "idle";
            if (next[b] === "wrong") next[b] = "idle";
            return next;
          });
          setLocking(false);
        }, 500);
      }
    },
    [locking, done, states, selected, matchedCount, pairsPerRound, advance, later]
  );

  const playAgain = useCallback(() => {
    // Local re-shuffle of the same words — a fresh game without a round-trip.
    // buildTiles reshuffles tile positions so the board isn't identical.
    endedRef.current = false;
    startRef.current = Date.now();
    setRoundIdx(0);
    setTiles(buildTiles(rounds[0]));
    setStates({});
    setSelected(null);
    setMatchedCount(0);
    mistakesRef.current = 0;
    setMistakes(0);
    setLocking(false);
    setXpGained(0);
    setElapsed(0);
    setDone(false);
    startSession(); // fresh session for the replay
  }, [rounds, startSession]);

  if (done) {
    return (
      <>
        {toaster}
        <SummaryScreen
          elapsed={elapsed}
          mistakes={mistakes}
          totalPairs={totalPairs}
          xpGained={xpGained}
          onPlayAgain={playAgain}
        />
      </>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col">
      {toaster}
      {/* HUD */}
      <div className="sticky top-16 z-30 bg-paper/80 backdrop-blur-md border-b border-line">
        <div className="shell py-2.5 flex items-center justify-between gap-3 text-sm">
          <span className="text-soft tabular-nums whitespace-nowrap">
            {t("study.matchingRound", { n: roundIdx + 1, total: rounds.length })}
          </span>
          <div className="flex items-center gap-4 tabular-nums">
            <span className="text-soft">
              <span className="text-ink font-semibold">{fmtTime(elapsed)}</span>
            </span>
            <span className="text-soft">
              {t("study.matchingMistakes")}{" "}
              <span className={mistakes > 0 ? "text-red-400 font-semibold" : "text-ink font-semibold"}>
                {mistakes}
              </span>
            </span>
          </div>
        </div>
      </div>

      <div className="shell w-full flex-1 flex flex-col justify-center py-6 sm:py-10 pb-28 md:pb-10">
        <p className="text-center text-soft text-sm mb-5">{t("study.matchingHint")}</p>
        <AnimatePresence mode="wait">
          <motion.div
            key={roundIdx}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="mx-auto w-full max-w-3xl grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-3"
          >
            {tiles.map((tile) => (
              <TileButton
                key={tile.id}
                tile={tile}
                state={states[tile.id] ?? "idle"}
                onClick={() => onTile(tile)}
              />
            ))}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

function TileButton({
  tile,
  state,
  onClick,
}: {
  tile: Tile;
  state: TileState;
  onClick: () => void;
}) {
  const matched = state === "matched";
  const base =
    "relative min-h-[4.5rem] sm:min-h-[5.5rem] rounded-2xl border px-3 py-3 text-center flex items-center justify-center transition-colors select-none";
  const cls =
    state === "selected"
      ? "border-ember bg-ember/10 text-ink"
      : state === "matched"
        ? "border-moss-500/30 bg-moss-500/10 text-soft"
        : state === "wrong"
          ? "border-red-400 bg-red-400/15 text-ink"
          : "border-line bg-surface hover:border-ember/40 text-ink";

  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={matched}
      aria-pressed={state === "selected"}
      className={`${base} ${cls} ${matched ? "cursor-default" : "cursor-pointer"}`}
      animate={
        state === "wrong"
          ? { x: [0, -6, 6, -4, 4, 0] }
          : state === "matched"
            ? { scale: [1, 1.06, 1] }
            : { scale: 1, x: 0 }
      }
      transition={{ duration: state === "matched" ? 0.35 : 0.4 }}
    >
      <span
        className={`${tile.kind === "word" ? "font-semibold text-sm sm:text-base" : "text-xs sm:text-sm leading-snug"} ${
          matched ? "opacity-70" : ""
        }`}
      >
        {tile.label}
      </span>
    </motion.button>
  );
}

function SummaryScreen({
  elapsed,
  mistakes,
  totalPairs,
  xpGained,
  onPlayAgain,
}: {
  elapsed: number;
  mistakes: number;
  totalPairs: number;
  xpGained: number;
  onPlayAgain: () => void;
}) {
  const { t } = useI18n();
  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-6 py-10">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md"
      >
        <motion.div
          initial={{ scale: 0, rotate: -30 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ delay: 0.1, type: "spring", stiffness: 200 }}
          className="mx-auto mb-5 grid h-20 w-20 place-items-center rounded-full bg-moss-500/15 text-moss-500"
        >
          <CheckCircle2 size={40} strokeWidth={1.5} />
        </motion.div>
        <h2 className="display text-display-md mb-1 text-center">{t("study.matchingComplete")}</h2>
        <p className="text-soft text-center mb-2">
          {t("study.matchingMatchedN", { n: totalPairs })}
        </p>
        {xpGained > 0 && (
          <p className="text-center mb-6 text-sm font-semibold text-ember">
            {t("gamify.xpEarned", { n: xpGained })}
          </p>
        )}
        {xpGained <= 0 && <div className="mb-4" />}

        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="card-atelier p-4 text-center">
            <p className="display text-2xl tabular-nums">{fmtTime(elapsed)}</p>
            <p className="text-[10px] uppercase tracking-wide text-soft">{t("study.matchingTime")}</p>
          </div>
          <div className="card-atelier p-4 text-center">
            <p className="display text-2xl tabular-nums text-moss-500">{totalPairs}</p>
            <p className="text-[10px] uppercase tracking-wide text-soft">{t("study.matchingMatched")}</p>
          </div>
          <div className="card-atelier p-4 text-center">
            <p className={`display text-2xl tabular-nums ${mistakes > 0 ? "text-red-400" : ""}`}>
              {mistakes}
            </p>
            <p className="text-[10px] uppercase tracking-wide text-soft">{t("study.matchingMistakes")}</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={onPlayAgain}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-ink text-paper px-6 py-3 font-medium hover:opacity-90"
          >
            <RotateCcw size={16} /> {t("study.matchingPlayAgain")}
          </button>
          <a
            href="/study"
            className="inline-flex items-center justify-center gap-2 rounded-full border border-line px-6 py-3 font-medium hover:bg-paper-200/50"
          >
            <Layers size={16} /> {t("study.changeMode")}
          </a>
        </div>
      </motion.div>
    </div>
  );
}
