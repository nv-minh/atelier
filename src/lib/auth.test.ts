import { describe, it, expect, vi, afterEach, beforeAll } from "vitest";

// authOptions reads process.env at module-evaluation time, so each case has to
// set the environment BEFORE importing the module, and reset the module
// registry between cases.
let ORIGINAL_ENV: NodeJS.ProcessEnv;

// The four variables that decide which providers load. Every case starts from a
// base with all four stripped, so the suite is hermetic — it must behave the
// same for a developer who has real credentials in .env and one who does not.
const CREDENTIAL_VARS = [
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "GITHUB_CLIENT_ID",
  "GITHUB_CLIENT_SECRET",
] as const;

beforeAll(async () => {
  // Importing ./db constructs a PrismaClient, and Prisma loads the project's
  // .env into process.env as an import side effect — ONCE per process. auth.ts
  // imports ./db transitively, so without this warm-up the very first
  // loadProviders() call would carefully build a credential-free environment
  // and then have Prisma inject the real credentials back into it, mid-import,
  // before auth.ts read them. That made the first case (and only the first)
  // fail on any machine with real credentials configured. Trigger the side
  // effect here, then snapshot, so the strip below actually holds.
  await import("./db");
  ORIGINAL_ENV = { ...process.env };
});

function envWithoutCredentials() {
  const base = { ...ORIGINAL_ENV };
  for (const key of CREDENTIAL_VARS) delete base[key];
  return base;
}

async function loadProviders(env: Record<string, string | undefined>) {
  vi.resetModules();
  process.env = { ...envWithoutCredentials(), ...env };
  const mod = await import("./auth");
  return mod.authOptions.providers;
}

describe("authOptions.providers", () => {
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.resetModules();
  });

  it("registers no provider when no credentials are configured", async () => {
    const providers = await loadProviders({});
    expect(providers).toHaveLength(0);
  });

  it("registers Google when only Google credentials are configured", async () => {
    const providers = await loadProviders({
      GOOGLE_CLIENT_ID: "gid",
      GOOGLE_CLIENT_SECRET: "gsecret",
    });
    expect(providers.map((p) => p.id)).toEqual(["google"]);
  });

  it("registers GitHub when only GitHub credentials are configured", async () => {
    const providers = await loadProviders({
      GITHUB_CLIENT_ID: "hid",
      GITHUB_CLIENT_SECRET: "hsecret",
    });
    expect(providers.map((p) => p.id)).toEqual(["github"]);
  });

  it("registers both when both are configured, Google first", async () => {
    const providers = await loadProviders({
      GOOGLE_CLIENT_ID: "gid",
      GOOGLE_CLIENT_SECRET: "gsecret",
      GITHUB_CLIENT_ID: "hid",
      GITHUB_CLIENT_SECRET: "hsecret",
    });
    expect(providers.map((p) => p.id)).toEqual(["google", "github"]);
  });

  it("ignores a half-configured provider (id without secret)", async () => {
    const providers = await loadProviders({ GOOGLE_CLIENT_ID: "gid" });
    expect(providers).toHaveLength(0);
  });

  it("links Google accounts by verified email, and never GitHub", async () => {
    // This is the flag that keeps the 3 existing GitHub-created users from
    // being locked out of their own cards when they switch to Google. If this
    // assertion ever fails, that lockout is back.
    const providers = await loadProviders({
      GOOGLE_CLIENT_ID: "gid",
      GOOGLE_CLIENT_SECRET: "gsecret",
      GITHUB_CLIENT_ID: "hid",
      GITHUB_CLIENT_SECRET: "hsecret",
    });
    const google = providers.find((p) => p.id === "google") as any;
    const github = providers.find((p) => p.id === "github") as any;
    // The provider factories (GoogleProvider()/GitHubProvider()) nest every
    // caller-supplied option — including this flag — under `.options` on the
    // raw config object; NextAuth only flattens it to the top level later, at
    // request time, inside its own parseProviders() step. Since this test
    // inspects the pre-merge `authOptions.providers` array directly, it
    // currently reads the flag from `.options`. next-auth is caret-pinned
    // (^4.24.15) though, so a minor bump could flatten it to the top level
    // before that step ever runs — check both shapes so the assertion stays
    // meaningful instead of silently reading undefined off a stale path.
    expect(
      google.allowDangerousEmailAccountLinking ??
        google.options?.allowDangerousEmailAccountLinking
    ).toBe(true);
    expect(
      github.allowDangerousEmailAccountLinking ??
        github.options?.allowDangerousEmailAccountLinking
    ).toBeFalsy();
  });
});
