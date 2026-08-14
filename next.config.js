/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Prerequisite for next/image on word photos (word-image.tsx currently uses
  // a plain <img> across 4 differently-sized surfaces — browse thumbnail,
  // flashcard, word detail, landing demo — with no shared width/height
  // contract; converting those call sites is left for a follow-up rather than
  // risking an unverified visual regression on the launch-facing landing page
  // and study flow). Declared now so that follow-up is a component change
  // only, not a config change too.
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.pexels.com" },
      { protocol: "https", hostname: "upload.wikimedia.org" },
    ],
  },
  env: {
    NEXT_PUBLIC_GOOGLE_ENABLED:
      process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET ? "1" : "0",
    NEXT_PUBLIC_GITHUB_ENABLED: process.env.GITHUB_CLIENT_ID ? "1" : "0",
    // Keep the NODE_ENV guard in lockstep with src/lib/session.ts and
    // src/middleware.ts — prod must NEVER ship NEXT_PUBLIC_AUTH_BYPASS="1".
    NEXT_PUBLIC_AUTH_BYPASS:
      process.env.AUTH_BYPASS === "1" && process.env.NODE_ENV !== "production" ? "1" : "0",
  },
};

module.exports = nextConfig;
