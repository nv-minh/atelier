"use client";

// Sheet — the app's one bottom-sheet-shaped overlay primitive (Plan 1 Task
// 9). Extracted from auth-gate.tsx's AuthGateModal (the only bottom sheet
// the app had before this task): the backdrop, ESC-to-close, body-scroll
// lock, and AnimatePresence/motion enter-exit all carry over unchanged. This
// file ADDS three things that hand-rolled panel never had: a drag handle,
// real swipe-down-to-dismiss, and a hand-rolled focus trap. No dependency
// for the trap exists in package.json (no Radix, no focus-trap-react) — this
// is a small, deliberately minimal implementation per task-9-brief.md rather
// than a new dependency for something this contained.

import * as React from "react";
import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { cardClasses } from "@/lib/ui/card-classes";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Focusable descendants in DOM order — shared by the initial-focus effect and
 * the Tab-wrap keydown handler below. Plain DOM query, deliberately NOT
 * exported as a "pure" lib/ui function: it takes a live HTMLElement, so
 * unlike buttonClasses()/cardClasses() it cannot be unit-tested without
 * jsdom, which this plan's Global Constraints forbid adding.
 */
function getFocusableElements(container: HTMLElement | null): HTMLElement[] {
  if (!container) return [];
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
}

// Swipe-down thresholds: a real drag gesture must clear either a distance or
// a velocity bar to count as "dismiss" — a slow, small nudge just springs
// back to rest (Framer's default behavior once released inside
// dragConstraints/dragElastic).
const DRAG_CLOSE_OFFSET_PX = 120;
const DRAG_CLOSE_VELOCITY = 500;

export type SheetProps = {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  /**
   * aria-label for the built-in close (X) button, top-right — required for
   * the same reason IconButton requires one: an icon-only control has no
   * text for assistive tech to read.
   */
  closeLabel: string;
  /** Wires aria-labelledby to a heading the caller renders as a child. */
  labelledBy?: string;
};

export function Sheet({ open, onClose, children, className, closeLabel, labelledBy }: SheetProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  // Body scroll lock while open — the page behind cannot move under the
  // sheet on mobile. Unchanged from the auth-gate hand-roll this replaces.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Focus management: remember what had focus before opening, move focus
  // into the sheet once it mounts, and hand it back to the trigger on close.
  useEffect(() => {
    if (open) {
      previouslyFocused.current = document.activeElement as HTMLElement | null;
      // One frame so AnimatePresence has actually mounted the panel before
      // we query it for focusable descendants.
      const raf = requestAnimationFrame(() => {
        const [first] = getFocusableElements(panelRef.current);
        (first ?? panelRef.current)?.focus();
      });
      return () => cancelAnimationFrame(raf);
    }
    previouslyFocused.current?.focus?.();
    previouslyFocused.current = null;
    return undefined;
  }, [open]);

  // ESC closes; Tab/Shift+Tab wrap at the sheet's own boundaries so focus can
  // never escape into the page behind it.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const focusables = getFocusableElements(panelRef.current);
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-sheet flex items-end sm:items-center justify-center p-0 sm:p-6"
        >
          <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm" onClick={onClose} aria-hidden />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={labelledBy}
            tabIndex={-1}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.5 }}
            dragMomentum={false}
            onDragEnd={(_, info) => {
              if (info.offset.y > DRAG_CLOSE_OFFSET_PX || info.velocity.y > DRAG_CLOSE_VELOCITY) {
                onClose();
              }
            }}
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.98 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className={cn(
              cardClasses("flat"),
              "relative w-full sm:max-w-sm p-7 pb-[calc(1.75rem+var(--safe-b))] sm:pb-7 rounded-t-3xl sm:rounded-[1.25rem]",
              className
            )}
          >
            {/* Drag handle — 36×4, centered, top of sheet. Decorative AND
                the visual affordance for the real swipe-down gesture above:
                the whole panel is draggable (not just this bar), which is
                safe because Motion only starts a drag past a small movement
                threshold, so an ordinary tap on a button inside still fires
                its click. Mobile-only — the sm:+ layout centers the dialog
                instead of anchoring it to the bottom, so it isn't a "sheet"
                there anymore. */}
            <div
              aria-hidden
              className="absolute left-1/2 top-3 -translate-x-1/2 h-1 w-9 rounded-full bg-hairline sm:hidden"
            />
            <button
              onClick={onClose}
              aria-label={closeLabel}
              className="absolute right-4 top-4 rounded-full p-1.5 text-fg-muted hover:text-fg hover:bg-ink/5 transition-colors"
            >
              <X size={16} />
            </button>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
