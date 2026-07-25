"use client";

import { AppProgressBar } from "next-nprogress-bar";

export function ProgressBar() {
  return (
    <AppProgressBar
      height="2px"
      color="rgb(var(--ember))"
      options={{ showSpinner: false }}
      shallowRouting
    />
  );
}
