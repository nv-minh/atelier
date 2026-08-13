/* eslint-disable */
// Import for side effect, BEFORE any module that reads process.env:
//   import "./load-env";
//
// The `prisma` CLI loads .env by itself, but `tsx prisma/*.ts` does not, and the
// repo has no dotenv dependency — so every db:* / packs:* script exits with
// "Environment variable not found: DATABASE_URL" unless the caller happens to
// have it exported in their shell. This closes that gap with no new dependency.
//
// Existing environment always wins, so `DATABASE_URL=… npm run …` still
// overrides the file.
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

// Later files do NOT override earlier ones (same precedence as Next.js).
const FILES = [".env.local", ".env"];

for (const name of FILES) {
  const path = resolve(process.cwd(), name);
  if (!existsSync(path)) continue;
  for (const raw of readFileSync(path, "utf-8").split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim().replace(/^export\s+/, "");
    if (!key || process.env[key] !== undefined) continue;
    let value = line.slice(eq + 1).trim();
    // Strip one matching pair of surrounding quotes; leave inner quotes alone.
    if (value.length >= 2 && ((value[0] === '"' && value.endsWith('"')) || (value[0] === "'" && value.endsWith("'")))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}
