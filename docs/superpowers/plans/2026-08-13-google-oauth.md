# Plan C — Google sign-in, GitHub button hidden

> **For agentic workers:** Steps use checkbox (`- [ ]`) syntax for tracking. Implement task-by-task; each task ends with a commit.

**Goal:** Add Google as the sign-in method (env-gated, linking to existing accounts by verified email) and remove the GitHub button from the login page, without breaking anyone who is already signed in.

**Architecture:** `authOptions.providers` becomes a two-entry env-gated list, following the pattern already there for GitHub. Google carries `allowDangerousEmailAccountLinking: true` so the 3 existing GitHub-created users keep their cards and XP when they sign in with Google. The login page swaps its button; `next.config.js` derives the public flag from the server-side client id, exactly as it already does for GitHub.

**Tech Stack:** Next.js 14.2 App Router, next-auth 4.24.15 (already installed — ships `next-auth/providers/google`), Prisma adapter, vitest 2.1. **No new dependencies. No schema changes.**

**Spec:** `docs/superpowers/specs/2026-08-13-google-oauth-design.md`

## Global Constraints

- **Branch:** `google-auth`, applied on top of `a784201`. Worktree root: `/Users/abc/Desktop/vocab-master/.claude/worktrees/google-auth`. Do NOT `cd` to the main checkout.
- **This worktree has no `node_modules`** (it is gitignored and not copied into worktrees). Before running any `npx`/`npm` command, run `npm install` ONCE in the worktree root. That is the only permitted install — it must not add or change any dependency. Verify afterwards with `git status` that `package.json` and `package-lock.json` are unmodified.
- **No new dependencies.** `next-auth@4.24.15` already ships `next-auth/providers/google` (verified: `node_modules/next-auth/providers/google.js` exists) and types `allowDangerousEmailAccountLinking` (verified: `next-auth/providers/oauth.d.ts:119`).
- **No schema changes.** No `db:push`, no Prisma migration.
- **`allowDangerousEmailAccountLinking: true` goes on the Google provider ONLY.** Never add it to GitHub.
- **Do NOT remove the GitHub provider** from `authOptions`, and do NOT remove `NEXT_PUBLIC_GITHUB_ENABLED` from `next.config.js`. Only the login page's GitHub *button* goes away. (Reason: live sessions must not be kicked, and the 3 existing `github` Account rows must not be orphaned.)
- **Never print, echo, or commit secret values.** You will not have real Google credentials; do not invent placeholder values inside `.env` files that could be mistaken for real ones.
- **Do NOT create scratch pages or routes under `src/app/`.** Delete any temp file you create.
- **Stage only your own files.** Never `git add -A`.
- **Comments in English**; user-facing strings go through i18n in BOTH `vi` and `en`.
- **Commit style:** lowercase conventional prefix (`feat(auth):`, `test(auth):`, `docs(deploy):`). End messages with a blank line then `Co-Authored-By: Claude <noreply@anthropic.com>`.

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `src/lib/auth.ts` | Modify | Add the env-gated Google provider with the linking flag. GitHub entry untouched. |
| `src/lib/auth.test.ts` | Create | Lock which providers load per env combination, and that the linking flag is on Google only. |
| `next.config.js` | Modify | Derive `NEXT_PUBLIC_GOOGLE_ENABLED` from `GOOGLE_CLIENT_ID`. |
| `src/app/login/page.tsx` | Modify | Google button replaces the GitHub button; disabled state now keys off Google. |
| `src/lib/i18n/dictionaries.ts` | Modify | `login.google` string in `vi` and `en`. |
| `DEPLOY.md` | Modify | Document the two new env vars and the required Google Cloud redirect URIs. |

---

## Task 1: Google provider + tests

**Files:**
- Modify: `src/lib/auth.ts`
- Create: `src/lib/auth.test.ts`

**Interfaces produced:** `authOptions` keeps its exported shape (`NextAuthOptions`). Its `providers` array becomes env-dependent — that is what the test pins down.

- [ ] **Step 1: Install dependencies in this worktree**

This worktree was created fresh and has no `node_modules`.

Run: `npm install`
Then run: `git status --short` — expected: `package.json` and `package-lock.json` NOT listed as modified. If either shows as modified, stop and report; something added a dependency and that violates a global constraint.

- [ ] **Step 2: Write the failing test**

Create `src/lib/auth.test.ts`:

```ts
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
    expect(google.allowDangerousEmailAccountLinking).toBe(true);
    expect(github.allowDangerousEmailAccountLinking).toBeFalsy();
  });
});
```

- [ ] **Step 3: Run it, confirm FAIL**

Run: `npx vitest run src/lib/auth.test.ts`
Expected: FAIL. The Google cases fail because no Google provider is registered yet (e.g. "registers Google when only Google credentials are configured" gets `[]`).

**Already verified for you — do not add mocks for it:** `auth.ts` imports `./db`, which constructs a `PrismaClient` at module scope, and this worktree has no `.env`. That was probed before writing this plan: importing `./auth` in vitest's node environment succeeds with no `DATABASE_URL` present (Prisma defers connection until a query) and reports 0 providers. So the test needs **no** Prisma mock, no `.env`, and no `vi.mock("./db")`. If you find yourself reaching for one, something else is wrong — report it instead.

- [ ] **Step 4: Add the Google provider**

Edit `src/lib/auth.ts`. Add the import beside the existing GitHub one:

```ts
import GoogleProvider from "next-auth/providers/google";
```

Add the credential reads beside the existing GitHub pair:

```ts
const googleId = process.env.GOOGLE_CLIENT_ID;
const googleSecret = process.env.GOOGLE_CLIENT_SECRET;
```

Replace the `providers` array with:

```ts
  providers: [
    // Google is the sign-in method the app offers. Like GitHub below, it is
    // only registered when its credentials exist, so a missing env var
    // degrades to "no button" rather than a crash at boot.
    //
    // allowDangerousEmailAccountLinking attaches a new Google Account row to
    // an EXISTING User with the same email. The app's users predate Google
    // sign-in — their User rows were created through GitHub — and User.email
    // is unique, so without this flag NextAuth would refuse the sign-in with
    // OAuthAccountNotLinked and they could reach neither their old account nor
    // a new one. The flag's risk is that it trusts the provider's email
    // verification; Google verifies emails, which is exactly the case it is
    // safe for. It is deliberately NOT set on GitHub.
    ...(googleId && googleSecret
      ? [
          GoogleProvider({
            clientId: googleId,
            clientSecret: googleSecret,
            allowDangerousEmailAccountLinking: true,
          }),
        ]
      : []),
    // GitHub stays registered even though its button is gone from the login
    // page: removing it would kick live sessions and orphan the existing
    // github Account rows. Restoring the button is the only step needed to
    // bring it back.
    ...(ghId && ghSecret
      ? [GitHubProvider({ clientId: ghId, clientSecret: ghSecret })]
      : []),
  ],
```

- [ ] **Step 5: Run it, confirm PASS**

Run: `npx vitest run src/lib/auth.test.ts`
Expected: PASS — 6 tests.

Then the full suite: `npx vitest run` — expected 63 passing (57 existing + 6 new).

- [ ] **Step 6: Type-check and commit**

Run: `npx tsc --noEmit` — expected clean.

```bash
git add src/lib/auth.ts src/lib/auth.test.ts
git commit -m "$(cat <<'EOF'
feat(auth): add Google sign-in, linked by verified email

Google is registered only when its credentials exist, matching how GitHub
already degrades to "no button" rather than crashing at boot.

allowDangerousEmailAccountLinking is set on Google alone. Every existing
user's User row was created through GitHub and User.email is unique, so
without it NextAuth answers a Google sign-in with OAuthAccountNotLinked —
locking those people out of both their old account and a new one. The flag
trusts the provider's email verification, which is precisely what Google
provides. A test pins it on Google and pins its absence on GitHub.

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Login page, public env flag, i18n, deploy docs

**Files:**
- Modify: `next.config.js`, `src/app/login/page.tsx`, `src/lib/i18n/dictionaries.ts`, `DEPLOY.md`

**Interfaces consumed:** the `google` provider id registered in Task 1 (`signIn("google", ...)`).

- [ ] **Step 1: Derive the public flag**

In `next.config.js`, add one line inside `env`, beside the existing GitHub one:

```js
    NEXT_PUBLIC_GOOGLE_ENABLED: process.env.GOOGLE_CLIENT_ID ? "1" : "0",
```

Keep `NEXT_PUBLIC_GITHUB_ENABLED` exactly as it is — it is still read by nothing after this task, but removing it is churn that serves no goal here and the provider is still registered.

Deriving the public flag from the server-side id means only ONE variable has to be set in Vercel, and the two can never disagree.

- [ ] **Step 2: Add the i18n string**

In `src/lib/i18n/dictionaries.ts`, find the `login: {` block in the **`vi`** dictionary and add:

```ts
      google: "Tiếp tục với Google",
```

And in the **`en`** dictionary's `login: {` block:

```ts
      google: "Continue with Google",
```

Leave the existing `login.github` key in both — it costs nothing and keeps the door open.

Verify both dictionaries end up with the same key set under `login`.

- [ ] **Step 3: Swap the button on the login page**

Edit `src/app/login/page.tsx`:

Replace the `hasGithub` constant (line ~44) with:

```ts
const hasGoogle = process.env.NEXT_PUBLIC_GOOGLE_ENABLED === "1";
```

Replace the GitHub `<button>` block with a Google one:

```tsx
        <button
          onClick={() => signIn("google", { callbackUrl })}
          disabled={!hasGoogle}
          className="group inline-flex items-center justify-center gap-3 rounded-full bg-ink text-paper px-7 py-3.5 font-medium hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed w-full sm:w-auto"
        >
          <GoogleIcon />
          {t("login.google")}
        </button>

        {!hasGoogle && (
          <p className="text-xs text-ember/80 mt-4 max-w-xs mx-auto">{t("login.notice")}</p>
        )}
```

Replace the `GithubIcon` function with a `GoogleIcon` one. Use the official four-colour Google mark, inline, matching how `GithubIcon` was written (no new dependency, no asset):

```tsx
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.46a5.52 5.52 0 0 1-2.4 3.62v3.01h3.88c2.27-2.09 3.58-5.17 3.58-8.82z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.08 7.94-2.91l-3.88-3.01c-1.08.72-2.45 1.16-4.06 1.16-3.13 0-5.78-2.11-6.73-4.96H1.26v3.09A12 12 0 0 0 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.28a7.21 7.21 0 0 1 0-4.56V6.63H1.26a12 12 0 0 0 0 10.74l4.01-3.09z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.44-3.44C17.95 1.18 15.24 0 12 0A12 12 0 0 0 1.26 6.63l4.01 3.09C6.22 6.86 8.87 4.75 12 4.75z"
      />
    </svg>
  );
}
```

Note the icon keeps its own brand colours (no `fill="currentColor"`), which is what Google's brand guidelines require — that is deliberate, not an inconsistency with `GithubIcon`.

Make sure the `GithubIcon` function and any now-unused import are removed, so nothing dead is left behind.

- [ ] **Step 4: Document the environment in `DEPLOY.md`**

Find where `DEPLOY.md` documents `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` and add the Google equivalents in the same style. The content must state:

- `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are required for sign-in to work; without them the login page shows a disabled button.
- `NEXT_PUBLIC_GOOGLE_ENABLED` is derived automatically in `next.config.js` and must NOT be set by hand.
- Redirect URIs to register in Google Cloud Console (APIs & Services → Credentials → OAuth 2.0 Client ID → Web application):
  - `http://localhost:3000/api/auth/callback/google`
  - `https://<production-domain>/api/auth/callback/google`
- A note that a missing production redirect URI is the usual cause of `redirect_uri_mismatch` — local works, production does not.
- A note that the GitHub provider is still registered but has no button, so `GITHUB_CLIENT_ID`/`GITHUB_CLIENT_SECRET` may stay set or be removed without breaking anything.

Match the existing document's heading level and tone; do not restructure it.

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit` — clean.
Run: `npx vitest run` — 63 passing.
Run: `npm run build` — must succeed. (`login/page.tsx` is prerendered, so a mistake there fails the build rather than showing up at runtime.)

Then `npm run dev` and open `/login`:
1. With no Google credentials in `.env` (the current state): the Google button renders **disabled** with the notice text below it, and the page layout is intact.
2. The GitHub button is **gone**.
3. No console errors.

**Do NOT claim the actual Google sign-in flow works.** It cannot be tested without real credentials. Say so plainly in your report.

- [ ] **Step 6: Commit**

```bash
git add next.config.js src/app/login/page.tsx src/lib/i18n/dictionaries.ts DEPLOY.md
git commit -m "$(cat <<'EOF'
feat(auth): Google button on the login page, GitHub button removed

The public flag is derived from GOOGLE_CLIENT_ID in next.config.js, the way
the GitHub one already was, so only one variable has to be set in Vercel and
the two can never drift apart.

The GitHub provider stays registered — only its button is gone — so live
sessions survive and the existing github Account rows keep their owner.

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

## What this plan deliberately does NOT do

- **It does not verify that Google sign-in actually works.** That needs real credentials, which do not exist yet. The account-linking behaviour — the whole reason for `allowDangerousEmailAccountLinking` — is therefore also unverified end to end. Both must be reported as outstanding, never as done.
- It does not remove the GitHub provider, `NEXT_PUBLIC_GITHUB_ENABLED`, or the `login.github` string.
- It does not touch `AUTH_BYPASS`, the middleware, or the Prisma schema.

## Verification checklist for the whole plan

- [ ] `npx vitest run` — 63 pass (57 existing + 6 new)
- [ ] `npx tsc --noEmit` — clean
- [ ] `npm run build` — succeeds
- [ ] `package.json` / `package-lock.json` unchanged
- [ ] `/login` shows a disabled Google button + notice when unconfigured; no GitHub button
- [ ] `DEPLOY.md` documents both env vars and both redirect URIs
- [ ] Both `vi` and `en` have `login.google`
- [ ] No debris under `src/app/`
