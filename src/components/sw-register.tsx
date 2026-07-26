"use client";

import { useEffect } from "react";

// Registers the service worker in production only. Dev builds skip it so the
// SW never caches stale assets during local iteration. Failures are ignored —
// the app works fine without it (SW only adds installability + offline fallback).
export function SwRegister() {
  useEffect(() => {
    if (
      process.env.NODE_ENV === "production" &&
      "serviceWorker" in navigator
    ) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  return null;
}
