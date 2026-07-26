/* eslint-disable */
// Restore a JSON backup made by prisma/backup-db.ts.
//
// Inserts tables in FK-safe order with createMany({ skipDuplicates: true }),
// so it is idempotent and additive: existing rows (matched by primary/unique
// key) are left untouched, missing rows are re-created. For a full disaster
// restore, run against a fresh database after `npm run db:push`.
//
// Usage:
//   npm run db:restore                                  # latest backup
//   npm run db:restore -- --dir data/backups/<stamp>    # specific backup
import { PrismaClient } from "@prisma/client";
import { existsSync, readdirSync, readFileSync } from "fs";
import { resolve } from "path";
import { MODELS } from "./backup-db";

const prisma = new PrismaClient();
const BATCH = 500;

// Convert ISO strings back to Date for DateTime columns — Prisma accepts ISO
// strings in createMany, so a blanket pass is unnecessary; only `null`
// handling matters, and JSON already round-trips that. Rows go in as-is.

function backupDir(): string {
  const i = process.argv.indexOf("--dir");
  if (i !== -1 && process.argv[i + 1]) return resolve(process.cwd(), process.argv[i + 1]);
  const root = resolve(process.cwd(), "data/backups");
  if (!existsSync(root)) throw new Error("No data/backups/ directory found.");
  const stamps = readdirSync(root).filter((d) => !d.startsWith(".")).sort();
  if (!stamps.length) throw new Error("No backups found in data/backups/.");
  return resolve(root, stamps[stamps.length - 1]);
}

async function main() {
  const dir = backupDir();
  console.log(`📥 Restoring from ${dir}\n`);
  const manifest = JSON.parse(readFileSync(resolve(dir, "manifest.json"), "utf-8"));
  console.log(`   Backup created: ${manifest.createdAt}\n`);

  for (const name of MODELS) {
    const file = resolve(dir, `${name}.json`);
    if (!existsSync(file)) {
      console.log(`  ${name.padEnd(18)} — no file, skipped`);
      continue;
    }
    const rows: any[] = JSON.parse(readFileSync(file, "utf-8"));
    const client = (prisma as any)[name];
    const before = await client.count();
    for (let i = 0; i < rows.length; i += BATCH) {
      await client.createMany({ data: rows.slice(i, i + BATCH), skipDuplicates: true });
    }
    const after = await client.count();
    console.log(
      `  ${name.padEnd(18)} ${String(rows.length).padStart(7)} in backup → +${after - before} restored (${after} total)`
    );
  }
  console.log(`\n✅ Restore complete.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
