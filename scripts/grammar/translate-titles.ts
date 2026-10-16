// Apply reviewed lesson titles (titleVi) from a JSON file { "<lessonId>": "<vi>" | null }.
// null means "keep the English title" (specimen titles such as "have to, has to, had to").
// Every non-null title must pass flagTitleVi, so a title identical to English or
// without Vietnamese cannot land in the DB. Snapshot before write; idempotent.
//
// Usage:
//   npx tsx scripts/grammar/translate-titles.ts <file.json>            # dry-run table
//   npx tsx scripts/grammar/translate-titles.ts <file.json> --apply    # write DB
import "../../prisma/load-env";
import { PrismaClient } from "@prisma/client";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { flagTitleVi } from "../../src/lib/grammar/lang-audit";

const prisma = new PrismaClient();
const file = process.argv[2];
const APPLY = process.argv.includes("--apply");

async function main(): Promise<void> {
  if (!file || file.startsWith("--")) {
    console.error("usage: translate-titles.ts <file.json> [--apply]");
    process.exitCode = 1;
    return;
  }
  const wanted = JSON.parse(readFileSync(resolve(file), "utf8")) as Record<string, string | null>;
  const rows = await prisma.grammarLesson.findMany({ select: { id: true, titleEn: true, titleVi: true } });
  const byId = new Map(rows.map((r) => [r.id, r]));
  const changes: Array<{ id: number; from: string | null; to: string | null }> = [];
  let rejected = 0;
  for (const [key, to] of Object.entries(wanted)) {
    const row = byId.get(Number(key));
    if (!row) {
      console.log(`  #${key}: no such lesson`);
      rejected++;
      continue;
    }
    const reason = to === null ? null : flagTitleVi(row.titleEn, to);
    if (reason) {
      console.log(`  #${key}: rejected "${to}" - ${reason}`);
      rejected++;
      continue;
    }
    if (row.titleVi !== to) changes.push({ id: row.id, from: row.titleVi, to });
  }
  for (const c of changes) console.log(`  #${c.id}: ${c.from ?? "NULL"}  ->  ${c.to ?? "NULL (English)"}`);
  console.log(`\n${changes.length} change(s), ${rejected} rejected, apply=${APPLY}`);
  if (!APPLY || changes.length === 0) return;

  mkdirSync(resolve("data", "backups"), { recursive: true });
  const snap = resolve("data", "backups", `grammar-titles-vi-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  writeFileSync(snap, JSON.stringify(changes.map((c) => ({ id: c.id, titleVi: c.from }))));
  console.log(`snapshot -> ${snap}`);
  for (let i = 0; i < changes.length; i += 100) {
    await prisma.$transaction(
      changes.slice(i, i + 100).map((c) => prisma.grammarLesson.update({ where: { id: c.id }, data: { titleVi: c.to } }))
    );
  }
  console.log("written");
}

main().finally(() => prisma.$disconnect());
