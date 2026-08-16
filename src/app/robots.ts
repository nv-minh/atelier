import type { MetadataRoute } from "next";

// Everything gated is disallowed rather than merely unlisted. Those routes
// render an <AuthRequired> wall to anyone without a session, so letting a
// crawler in produces a pile of near-identical thin pages under our own name.
export default function robots(): MetadataRoute.Robots {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://vocab-master-dusky.vercel.app";

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        // "/study",
        // "/settings",
        // "/stats",
        // "/notebook",
        // "/leaderboard",
        // "/word",
        "/offline",
        // Dev routes return 404 in production via layout.tsx, but this
        // second layer prevents indexation in preview deployments.
        "/dev",
      ],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
