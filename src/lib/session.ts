import "server-only";
import { getServerSession } from "next-auth";
import { authOptions } from "./auth";
import { prisma } from "./db";

export type CurrentUser = { id: string; name: string | null; email: string | null; image: string | null };

// When AUTH_BYPASS=1 AND not in production, authentication is skipped and a
// single shared "Local Learner" user is used. Production always requires real
// login, even if the flag leaks into the build environment.
export const AUTH_BYPASS = process.env.AUTH_BYPASS === "1" && process.env.NODE_ENV !== "production";

const BYPASS_EMAIL = "local@atelier.app";

async function getOrCreateBypassUser(): Promise<CurrentUser> {
  const existing = await prisma.user.findUnique({ where: { email: BYPASS_EMAIL } });
  if (existing) return { id: existing.id, name: existing.name, email: existing.email, image: existing.image };
  try {
    const u = await prisma.user.create({ data: { email: BYPASS_EMAIL, name: "Local Learner" } });
    return { id: u.id, name: u.name, email: u.email, image: u.image };
  } catch {
    // concurrent first-hit race on the shared user — re-fetch
    const u = await prisma.user.findUnique({ where: { email: BYPASS_EMAIL } });
    if (u) return { id: u.id, name: u.name, email: u.email, image: u.image };
    throw new Error("could not provision bypass user");
  }
}

// Returns the logged-in user, or null.
export async function getCurrentUser(): Promise<CurrentUser | null> {
  if (AUTH_BYPASS) return getOrCreateBypassUser();
  const session = await getServerSession(authOptions);
  const u = session?.user as any;
  if (!u?.id) return null;
  return { id: u.id, name: u.name ?? null, email: u.email ?? null, image: u.image ?? null };
}

// Returns the userId, or null. Use in API routes.
export async function requireUserId(): Promise<string | null> {
  const u = await getCurrentUser();
  return u?.id ?? null;
}
