// Centralised, fail-fast environment validation. Most vars degrade gracefully
// when unset (a provider simply isn't registered; Prisma errors on first
// query). Two are launch-blocking and get a HARD check instead, so a deploy
// with a broken config fails the build rather than quietly shipping:
//
//   1. NEXT_PUBLIC_CONTACT_EMAIL — published on /privacy & /terms, and Google's
//      OAuth consent review reads /privacy expecting a reachable contact.
//   2. NEXTAUTH_SECRET — signs every session JWT. The dev placeholder would let
//      anyone who learns it forge a session for any user.
//
// The guard targets a real Vercel production deploy (VERCEL_ENV === "production")
// so local `next build` and preview deploys are never blocked — only a genuine
// production build is. Imported by db.ts as a side effect, running the checks
// at first server load.
//
// Deliberately NO "import server-only" here, even though every value below is
// server-side-only in nature: db.ts (the sole importer) is itself kept free of
// that tag on purpose, so tsx scripts (prisma/seed.ts, the backfill CLI) and
// vitest can import it directly — see the same convention documented on
// gamification-checks.ts. "server-only" fails to resolve entirely outside
// Next's own bundler (breaks vitest), and inside Next it would only earn its
// keep by catching an accidental client import — which would have to go
// through db.ts's Prisma client first and break far more loudly than this
// module ever could on its own.
const isVercelProd = process.env.VERCEL_ENV === "production";

// Default is the RFC 2606 .invalid sentinel so an unset value fails loudly in
// review instead of looking like a plausible real address.
const contactEmail = process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "hello@atelier.invalid";
if (isVercelProd && contactEmail.endsWith(".invalid")) {
  throw new Error(
    "[env] NEXT_PUBLIC_CONTACT_EMAIL is unset (or still the .invalid sentinel) in production. " +
      "Set a real mailbox in the Vercel project env before deploying — see src/lib/legal.ts."
  );
}

const nextauthSecret = process.env.NEXTAUTH_SECRET;
if (isVercelProd && (!nextauthSecret || nextauthSecret.startsWith("dev-secret-change-me"))) {
  throw new Error(
    "[env] NEXTAUTH_SECRET is unset or still the dev placeholder in production. " +
      "Generate one with `openssl rand -base64 32` and set it in the Vercel project env."
  );
}

export const ENV = {
  isVercelProd,
  contactEmail,
  nextauthSecret,
  cronSecret: process.env.CRON_SECRET,
  databaseUrl: process.env.DATABASE_URL,
  vapidPublicKey: process.env.VAPID_PUBLIC_KEY,
  vapidPrivateKey: process.env.VAPID_PRIVATE_KEY,
  vapidSubject: process.env.VAPID_SUBJECT ?? "mailto:noreply@example.com",
};
