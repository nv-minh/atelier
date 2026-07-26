"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useI18n } from "@/components/i18n-provider";
import { ACHIEVEMENT_BY_KEY } from "@/lib/gamification-defs";
import { iconFor } from "./badge-icons";

const AUTO_DISMISS_MS = 4000;
const MAX_VISIBLE = 2;

type ToastItem = { id: number; key: string };

// Hook that collects unlocked achievement keys (from review/session responses)
// and renders a bottom-center stack of Motion toasts. Returns `push(keys)` for
// the session component to call, plus the toaster element to render.
//
// Cap: at most MAX_VISIBLE toasts on screen; extras beyond the cap are DROPPED
// (the badge gallery still shows them, so nothing is lost). Unknown keys are
// ignored so a stale/renamed key can't render an empty toast.
export function useAchievementToasts() {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const push = useCallback((keys: string[]) => {
    if (!keys || keys.length === 0) return;
    setItems((cur) => {
      const room = MAX_VISIBLE - cur.length;
      if (room <= 0) return cur; // at cap — drop extras
      const known = keys.filter((k) => ACHIEVEMENT_BY_KEY[k]);
      const added = known.slice(0, room).map((key) => ({ id: nextId.current++, key }));
      return [...cur, ...added];
    });
  }, []);

  const dismiss = useCallback((id: number) => {
    setItems((cur) => cur.filter((it) => it.id !== id));
  }, []);

  const toaster = (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-24 md:bottom-8 z-50 flex flex-col items-center gap-2 px-4"
    >
      <AnimatePresence>
        {items.map((it) => (
          <Toast key={it.id} item={it} onDone={dismiss} />
        ))}
      </AnimatePresence>
    </div>
  );

  return { push, toaster };
}

function Toast({ item, onDone }: { item: ToastItem; onDone: (id: number) => void }) {
  const { t } = useI18n();
  const def = ACHIEVEMENT_BY_KEY[item.key];
  const Icon = iconFor(def?.icon ?? "Award");

  // Keep the latest onDone in a ref so the auto-dismiss timer can run ONCE on
  // mount ([] deps). If we depended on onDone directly, every parent re-render
  // (e.g. each review during active study) would recreate the callback, re-run
  // the effect, and restart the 4s timer — the toast would never dismiss.
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    const timer = setTimeout(() => onDoneRef.current(item.id), AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 24, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 12, scale: 0.97 }}
      transition={{ type: "spring", stiffness: 300, damping: 26 }}
      onClick={() => onDone(item.id)}
      className="pointer-events-auto cursor-pointer w-full max-w-sm flex items-center gap-3 rounded-2xl border border-ember/30 bg-surface/95 backdrop-blur-md px-4 py-3 shadow-lg"
    >
      <span className="inline-grid h-10 w-10 shrink-0 place-items-center rounded-full bg-ember/12 text-ember">
        <Icon size={20} strokeWidth={1.75} />
      </span>
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wider text-ember font-semibold">
          {t("gamify.achievementUnlocked")}
        </p>
        <p className="text-sm font-semibold leading-tight truncate">
          {t(`achievements.${item.key}.title`)}
        </p>
      </div>
    </motion.div>
  );
}
