import { notFound } from "next/navigation";

// The /dev routes are build-time development tools: a component gallery and a
// font-glyph probe. They ship in the bundle either way, so they must refuse to
// render in production — a public /dev/ui would leak every unfinished screen.
export default function DevLayout({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV === "production") notFound();
  return <>{children}</>;
}
