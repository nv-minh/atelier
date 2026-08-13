import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";

// authOptions reads process.env at module-evaluation time, so each case has to
// set the environment BEFORE importing the module, and reset the module
// registry between cases.
const ORIGINAL_ENV = { ...process.env };

async function loadProviders(env: Record<string, string | undefined>) {
  vi.resetModules();
  process.env = { ...ORIGINAL_ENV, ...env };
  const mod = await import("./auth");
  return mod.authOptions.providers;
}

describe("authOptions.providers", () => {
  beforeEach(() => {
    // Start every case from a known-empty credential state.
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    delete process.env.GITHUB_CLIENT_ID;
    delete process.env.GITHUB_CLIENT_SECRET;
  });

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
