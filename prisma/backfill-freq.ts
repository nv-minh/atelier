/* eslint-disable */
// Fill Word.freqPct / Word.freqSource from the frequency lists in data/raw/.
//
// Why this exists separately from packs:import — the importer only knows the
// `rank` carried inside a pack file, which covers the words that ended up in a
// pack. This script works straight off the source lists, so it also reaches
// words that live in the DB from data/vocabulary.json (the 3.6k core A1–B2
// set) or from an unranked pack, and it can be re-run after any import.
//
// IDEMPOTENT: only writes rows where freqPct IS NULL. Re-running changes
// nothing. Pass --force to recompute every row (use after changing the source
// priority below), and --dry-run to see the counts without writing.
//
// Percentile, never raw rank: rank is per-source and not comparable across
// lists (`mister` is rank 1 in both BSL and TSL), so each list is normalized
// against its own size — freqPct = 1 − rank / listSize, 1 = most frequent.
//
// Usage: tsx prisma/backfill-freq.ts [--dry-run] [--force]
import "./load-env";
import { PrismaClient } from "@prisma/client";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import { RAW_DIR, normalizeWord } from "../scripts/packs/lib/formats";
import { FreqSource, freqPctFromRank } from "../src/lib/freq";

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes("--dry-run");
const FORCE = process.argv.includes("--force");

// Source priority, best general-frequency scale first. A word found in an
// earlier list is never looked up in a later one, so a general percentile is
// preferred over a domain-list percentile for the same word.
//
// NOTE: the top tier is a *general* NGSL list, which `packs:fetch` does not
// currently download — the pipeline only fetches NGSL-Spoken, BSL and TSL.
// Drop an NGSL 1.2 stats CSV in as data/raw/NGSL_12_stats.csv and it will be
// picked up automatically; until then, words that appear only in the general
// list keep freqPct = null and the selection engine scores them neutrally.
const SOURCES: Array<{ file: string; source: FreqSource; note: string }> = [
  { file: "NGSL_12_stats.csv", source: "ngsl", note: "NGSL 1.2 — general high-frequency English" },
  { file: "NGSL_Spoken_12_stats.csv", source: "ngsl-spoken", note: "NGSL-Spoken 1.2" },
  { file: "BSL_120_stats.csv", source: "bsl", note: "Business Service List 1.2" },
  { file: "TSL_12_stats.csv", source: "tsl", note: "TOEIC Service List 1.2" },
];

type Ranked = { rank: number; source: FreqSource; listSize: number };

// word → best (highest-priority) rank entry found for it.
function loadRanks(): { ranks: Map<string, Ranked>; loaded: string[]; missing: string[] } {
  const ranks = new Map<string, Ranked>();
  const loaded: string[] = [];
  const missing: string[] = [];

  for (const s of SOURCES) {
    const path = resolve(RAW_DIR, s.file);
    if (!existsSync(path)) {
      missing.push(`${s.file} (${s.note})`);
      continue;
    }
    // Same shape as build-wordlists.ts csvRows: header row dropped, word in
    // column 0, rank in column 1.
    const rows = readFileSync(path, "utf-8")
      .split(/\r?\n/)
      .slice(1)
      .map((l) => l.split(",").map((c) => c.trim()))
      .filter((r) => r[0] && Number.isFinite(Number(r[1])));

    for (const r of rows) {
      const word = normalizeWord(r[0]);
      // First list to claim a word wins — SOURCES is in priority order.
      if (ranks.has(word)) continue;
      ranks.set(word, { rank: Number(r[1]), source: s.source, listSize: rows.length });
    }
    loaded.push(`${s.file}: ${rows.length} rows → ${s.source}`);
  }
  return { ranks, loaded, missing };
}

// Same normalization as the importer — shared so the two paths can never drift
// into writing percentiles on two different scales.
function pctFor(r: Ranked): number | null {
  return freqPctFromRank(r.rank, r.listSize);
}

async function main() {
  const { ranks, loaded, missing } = loadRanks();

  console.log(`${DRY_RUN ? "🔍 DRY RUN — " : ""}Backfilling Word.freqPct${FORCE ? " (--force: recomputing every row)" : ""}\n`);
  for (const l of loaded) console.log(`  ✓ ${l}`);
  for (const m of missing) console.log(`  ⚠ absent: ${m}`);
  if (!ranks.size) {
    console.log("\nNo frequency lists in data/raw/ — run `npm run packs:fetch` first.");
    return;
  }
  console.log(`\n  ${ranks.size} distinct ranked words available\n`);

  const words = await prisma.word.findMany({
    where: FORCE ? {} : { freqPct: null },
    select: { id: true, word: true, cefr: true },
  });
  console.log(`Candidate rows: ${words.length}${FORCE ? "" : " (freqPct IS NULL)"}`);

  const updates: Array<{ id: string; freqPct: number; freqSource: string }> = [];
  const perSource: Record<string, number> = {};
  for (const w of words) {
    const hit = ranks.get(normalizeWord(w.word));
    if (!hit) continue;
    const freqPct = pctFor(hit);
    if (freqPct === null) continue; // unusable rank — leave null rather than guess
    updates.push({ id: w.id, freqPct, freqSource: hit.source });
    perSource[hit.source] = (perSource[hit.source] ?? 0) + 1;
  }

  console.log(`Matched: ${updates.length} — ${Object.entries(perSource).map(([s, n]) => `${s} ${n}`).join(", ") || "none"}`);
  console.log(`Unmatched (stay null, scored neutrally): ${words.length - updates.length}`);

  if (!DRY_RUN) {
    const TX = 100;
    for (let i = 0; i < updates.length; i += TX) {
      await prisma.$transaction(
        updates.slice(i, i + TX).map((u) =>
          prisma.word.update({ where: { id: u.id }, data: { freqPct: u.freqPct, freqSource: u.freqSource } })
        )
      );
      process.stdout.write(`\r  written ${Math.min(i + TX, updates.length)}/${updates.length}   `);
    }
    if (updates.length) console.log();
  }

  const total = await prisma.word.count();
  const withFreq = await prisma.word.count({ where: { freqPct: { not: null } } });
  console.log(
    `\n✅ Done. freqPct coverage: ${withFreq}/${total} (${((withFreq / total) * 100).toFixed(1)}%)` +
      (DRY_RUN ? " — unchanged, dry run" : "")
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
