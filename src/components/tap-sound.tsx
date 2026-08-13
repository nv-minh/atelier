"use client";

import { useEffect } from "react";
import { playSound } from "@/lib/sound";

// ONE listener for the whole app instead of an onClick on every control.
//
// Anything that opts out carries data-nosound: controls that already produce
// their own sound (rating buttons, quiz options — their audio comes from the
// shell's onAnswer) or that start other audio (pronunciation buttons), where a
// tap tone would just double up.
//
// pointerdown rather than click: it fires at the moment of touch, so the sound
// lands with the finger rather than after it lifts. passive + capture so it can
// never delay or block scrolling.
export function TapSound() {
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const el = e.target;
      if (!(el instanceof Element)) return;
      const control = el.closest('button, a, [role="button"]');
      if (!control) return;
      if (control.closest("[data-nosound]")) return;
      if (control.getAttribute("aria-disabled") === "true") return;
      if (control instanceof HTMLButtonElement && control.disabled) return;
      playSound("tap");
    };
    window.addEventListener("pointerdown", onDown, { passive: true, capture: true });
    return () => window.removeEventListener("pointerdown", onDown, { capture: true });
  }, []);

  return null;
}
