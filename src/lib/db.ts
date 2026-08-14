// Side-effect import: runs the launch-blocking env checks (CONTACT_EMAIL +
// NEXTAUTH_SECRET) the first time the Prisma singleton loads — i.e. on the
// first server request of any kind. See src/lib/env.ts.
import "./env";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
