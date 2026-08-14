import type { MetadataRoute } from "next";

// Only pages a signed-out visitor can actually read.
//
// /topics/[slug] (28 of them) and /word/[word] (8,000+) are deliberately left
// out: both gate guests behind <AuthRequired>, so submitting them would hand a
// crawler thousands of near-identical login prompts and earn a soft-404 pile.
// They belong in a sitemap only once there is a public preview of each.
export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://vocab-master-dusky.vercel.app";
  const now = new Date();

  const routes: { path: string; priority: number; changeFrequency: "daily" | "weekly" | "monthly" | "yearly" }[] = [
    { path: "/", priority: 1, changeFrequency: "daily" },
    { path: "/topics", priority: 0.8, changeFrequency: "weekly" },
    { path: "/browse", priority: 0.7, changeFrequency: "weekly" },
    { path: "/onboarding", priority: 0.6, changeFrequency: "monthly" },
    { path: "/login", priority: 0.3, changeFrequency: "yearly" },
    { path: "/privacy", priority: 0.2, changeFrequency: "yearly" },
    { path: "/terms", priority: 0.2, changeFrequency: "yearly" },
  ];

  return routes.map((r) => ({
    url: `${base}${r.path}`,
    lastModified: now,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));
}
