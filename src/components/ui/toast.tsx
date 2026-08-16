"use client";

// Toast primitive (Plan 1 Task 9) — the visual shell extracted from
// gamification/achievement-toast.tsx: the motion.div card, icon slot, auto-
// dismiss timer, and click-to-dismiss chrome. Achievement-specific business
// logic (the capped queue, sound-on-new-item via a Strict-Mode-safe effect,
// unknown-key filtering) stays in useAchievementToasts(), which now composes
// this primitive instead of hand-rolling its own motion.div.

import * as React from "react";
import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/utils";
import { toastFormClasses, type ToastForm } from "@/lib/ui/toast-classes";

// Spec: auto-dismiss at 3.2s. The achievement-toast predecessor this
// generalizes hardcoded AUTO_DISMISS_MS = 4000 — 3.2s is a deliberate
// behavior change per task-9-brief.md, not a bug fix.
const AUTO_DISMISS_MS = 3200;

export type ToastAction = { label: string; onClick: () => void };

export type ToastProps = {
  form?: ToastForm;
  icon?: React.ReactNode;
  /** Small uppercase label above the title, e.g. "Achievement unlocked". */
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  /**
   * Optional "Hoàn tác" (Undo) action slot. No caller supplies one yet —
   * unlocking an achievement has no natural undo — shipped on the primitive
   * anyway so a future caller doesn't have to rebuild the toast shell to get
   * one. Same precedent as ProgressBar's unused `ring` form / Chip's unused
   * variants (Task 7/8): don't force a caller that doesn't exist.
   */
  action?: ToastAction;
  onDismiss: () => void;
  /** ms before auto-dismiss. Defaults to the spec's 3.2s. */
  autoDismissMs?: number;
};

/**
 * Fixed bottom-center stack container. Floats ABOVE the bottom nav
 * (bottom-24 md:bottom-8 — unchanged from the achievement-toast
 * predecessor) on the `z-toast` token (was a bare `z-50`). Wrap 1+ <Toast>
 * children inside <AnimatePresence> — each child needs its own `key` for
 * exit animations to work, same as the predecessor's usage.
 */
export function ToastStack({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "pointer-events-none fixed inset-x-0 bottom-24 md:bottom-8 z-toast flex flex-col items-center gap-2 px-4",
        className
      )}
    >
      <AnimatePresence>{children}</AnimatePresence>
    </div>
  );
}

export function Toast({
  form = "info",
  icon,
  eyebrow,
  title,
  action,
  onDismiss,
  autoDismissMs = AUTO_DISMISS_MS,
}: ToastProps) {
  const cls = toastFormClasses(form);

  // Keep the latest onDismiss in a ref so the auto-dismiss timer can run ONCE
  // per mount. If the effect depended on onDismiss directly, a parent
  // re-render recreating the callback (e.g. each review during an active
  // study session) would restart the timer — the toast would never
  // auto-dismiss. Same pattern the achievement-toast predecessor used.
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  useEffect(() => {
    const timer = setTimeout(() => onDismissRef.current(), autoDismissMs);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoDismissMs]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 24, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 12, scale: 0.97 }}
      transition={{ type: "spring", stiffness: 300, damping: 26 }}
      onClick={onDismiss}
      className={cn(
        "pointer-events-auto cursor-pointer w-full max-w-sm flex items-center gap-3 rounded-2xl border bg-surface/95 backdrop-blur-md px-4 py-3 shadow-lg",
        cls.border
      )}
    >
      {icon && (
        <span className={cn("inline-grid h-10 w-10 shrink-0 place-items-center rounded-full", cls.iconWrap)}>
          {icon}
        </span>
      )}
      <div className="min-w-0 flex-1">
        {eyebrow && (
          <p className={cn("text-[10px] uppercase tracking-wider font-semibold", cls.label)}>{eyebrow}</p>
        )}
        <p className="text-sm font-semibold leading-tight truncate">{title}</p>
      </div>
      {action && (
        <button
          onClick={(e) => {
            // Undo shouldn't also trigger the card's own click-to-dismiss —
            // leave the toast up (until autoDismiss) so the undo result is
            // visible instead of vanishing at the same instant it's tapped.
            e.stopPropagation();
            action.onClick();
          }}
          className="shrink-0 text-xs font-semibold text-accent hover:text-accent-hover"
        >
          {action.label}
        </button>
      )}
    </motion.div>
  );
}
