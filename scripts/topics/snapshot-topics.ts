// Snapshot Word.topics (word -> slugs) to data/backups/ before a re-assignment.
// Restore by writing the saved JSON back (id is stable; word is unique).
import "../../prisma/load-env";
import { PrismaClient } from "@prisma/client";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const prisma = new PrismaClient();
async function main(): Promise<void> {
  const rows = await prisma.word.findMany({ select: { id: true, word: true, topics: true } });
  mkdirSync(resolve("data", "backups"), { recursive: true });
  const file = resolve("data", "backups", `word-topics-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  writeFileSync(file, JSON.stringify(rows));
  console.log(`${rows.length} words -> ${file}`);
}
main().finally(() => prisma.$disconnect());
