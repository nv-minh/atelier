/* eslint-disable */
// Full-database backup to JSON — one file per table under
// data/backups/<UTC timestamp>/, plus a manifest with row counts.
// No pg_dump required; restores with prisma/restore-db.ts on any empty (or
// partially lost) database after `npm run db:push`.
//
// Backups contain USER DATA — data/backups/ is gitignored; copy the folder to
// external storage (Drive, etc.) for real disaster recovery.
//
// Usage: npm run db:backup
import "./load-env";
import { PrismaClient } from "@prisma/client";
import { mkdirSync, writeFileSync } from "fs";
import { resolve } from "path";

const prisma = new PrismaClient();
const PAGE = 5000;

// Every model in schema.prisma, in FK-safe RESTORE order (parents first).
// backup-db reads them all; restore-db inserts in this exact order.
export const MODELS = [
  "user",
  "account",
  "session",
  "verificationToken",
  "word",
  "card",
  "reviewLog",
  "wordMark",
  "studySession",
  "dailyStat",
  "settings",
  "userProgress",
  "achievement",
] as const;

async function dumpModel(name: (typeof MODELS)[number], dir: string): Promise<number> {
  const client = (prisma as any)[name];
  const rows: unknown[] = [];
  if (name === "verificationToken") {
    // No `id` column (composite key); table is tiny — fetch unpaged.
    rows.push(...(await client.findMany()));
  } else {
    // Cursor-free paging: ordered skip/take is fine at this scale (<100k rows).
    for (let skip = 0; ; skip += PAGE) {
      const page = await client.findMany({ take: PAGE, skip, orderBy: { id: "asc" } });
      rows.push(...page);
      if (page.length < PAGE) break;
    }
  }
  writeFileSync(resolve(dir, `${name}.json`), JSON.stringify(rows), "utf-8");
  return rows.length;
}

async function main() {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const dir = resolve(process.cwd(), "data/backups", stamp);
  mkdirSync(dir, { recursive: true });
  console.log(`📦 Backing up to data/backups/${stamp}/\n`);

  const manifest: Record<string, number> = {};
  for (const name of MODELS) {
    manifest[name] = await dumpModel(name, dir);
    console.log(`  ${name.padEnd(18)} ${String(manifest[name]).padStart(7)} rows`);
  }
  writeFileSync(
    resolve(dir, "manifest.json"),
    JSON.stringify({ createdAt: new Date().toISOString(), tables: manifest }, null, 2),
    "utf-8"
  );
  const total = Object.values(manifest).reduce((a, b) => a + b, 0);
  console.log(`\n✅ Backup complete — ${total} rows across ${MODELS.length} tables.`);
  console.log(`   Restore with: npm run db:restore -- --dir data/backups/${stamp}`);
}

// Guard: restore-db.ts imports MODELS from this file — only run the backup
// when executed directly, not on import.
if (require.main === module) {
  main()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
