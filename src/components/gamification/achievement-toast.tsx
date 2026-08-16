"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "@/components/i18n-provider";
import { ACHIEVEMENT_BY_KEY } from "@/lib/gamification-defs";
import { playSound } from "@/lib/sound";
import { Toast, ToastStack } from "@/components/ui/toast";
import { iconFor } from "./badge-icons";

const MAX_VISIBLE = 2;

type ToastItem = { id: number; key: string };

// Hook that collects unlocked achievement keys (from review/session responses)
// and renders a bottom-center stack of Toast primitives (Plan 1 Task 9 —
// this used to hand-roll its own motion.div; the visual shell now lives in
// src/components/ui/toast.tsx). Returns `push(keys)` for the session
// component to call, plus the toaster element to render.
//
// Cap: at most MAX_VISIBLE toasts on screen; extras beyond the cap are DROPPED
// (the badge gallery still shows them, so nothing is lost). Unknown keys are
// ignored so a stale/renamed key can't render an empty toast.
export function useAchievementToasts() {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(0);
  const prevCount = useRef(0);

  // Play the tone from an effect keyed on the visible count, NOT from inside
  // setItems' updater: state updaters must be pure, and React Strict Mode
  // double-invokes them in dev precisely to catch side effects like this one
  // — playSound inside the updater used to fire the tone twice per unlock.
  useEffect(() => {
    if (items.length > prevCount.current) playSound("achievement");
    prevCount.current = items.length;
  }, [items.length]);

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
    <ToastStack>
      {items.map((it) => (
        <AchievementToastItem key={it.id} item={it} onDone={dismiss} />
      ))}
    </ToastStack>
  );

  return { push, toaster };
}

// Achievement-specific composition of the generic Toast primitive: supplies
// the icon/eyebrow/title this achievement key resolves to, and
// `form="success"` — spec §5.5's in-session exception applies here (every
// real caller of useAchievementToasts fires from inside a study/practice
// session: practice-shell.tsx, matching-game.tsx, pronunciation-session.tsx —
// see task-9-report.md). No Undo action: unlocking an achievement has no
// natural undo.
function AchievementToastItem({ item, onDone }: { item: ToastItem; onDone: (id: number) => void }) {
  const { t } = useI18n();
  const def = ACHIEVEMENT_BY_KEY[item.key];
  const Icon = iconFor(def?.icon ?? "Award");

  return (
    <Toast
      form="success"
      icon={<Icon size={20} strokeWidth={1.75} />}
      eyebrow={t("gamify.achievementUnlocked")}
      title={t(`achievements.${item.key}.title`)}
      onDismiss={() => onDone(item.id)}
    />
  );
}
