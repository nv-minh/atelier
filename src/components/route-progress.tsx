"use client";

import { AppProgressBar } from "next-nprogress-bar";

// The route-TRANSITION nprogress bar (top-of-screen loading indicator while
// Next navigates), not the ui/progress-bar.tsx primitive — renamed from
// progress-bar.tsx (Plan 1 Task 8) to resolve that name collision before the
// primitive was created. See src/components/ui/progress-bar.tsx for the
// line/ring primitive used inside pages.
export function RouteProgress() {
  return (
    <AppProgressBar
      height="2px"
      color="rgb(var(--ember))"
      options={{ showSpinner: false }}
      shallowRouting
    />
  );
}
