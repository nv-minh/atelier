"use client";

import { SessionProvider } from "next-auth/react";
import { MotionConfig } from "motion/react";
import { TapSound } from "./tap-sound";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      {/* reducedMotion="user" makes EVERY motion/react component in the app
          respect the OS "reduce motion" setting through Motion's own context —
          17 files covered by one line, and components written later are covered
          automatically. See the spec's amendment to practice-modes §10. */}
      <MotionConfig reducedMotion="user">
        <TapSound />
        {children}
      </MotionConfig>
    </SessionProvider>
  );
}
