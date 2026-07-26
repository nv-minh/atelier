/* eslint-disable */
// File cache for API responses under data/cache/<ns>/<key>.json so every
// pipeline step is resumable and no upstream is ever hit twice for one word.
// 404s are cached too (as {miss:true}) — a retry storm on known-missing words
// is the rudest kind of re-crawl.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

const ROOT = resolve(process.cwd(), "data/cache");

function fileFor(ns: string, key: string): string {
  // Words can contain spaces/apostrophes/slashes — encode to a safe filename.
  return resolve(ROOT, ns, `${encodeURIComponent(key)}.json`);
}

export function cacheGet<T = any>(ns: string, key: string): T | undefined {
  const f = fileFor(ns, key);
  if (!existsSync(f)) return undefined;
  try {
    return JSON.parse(readFileSync(f, "utf-8"));
  } catch {
    return undefined; // corrupt cache entry = cache miss
  }
}

export function cacheSet(ns: string, key: string, value: unknown): void {
  const dir = resolve(ROOT, ns);
  mkdirSync(dir, { recursive: true });
  writeFileSync(fileFor(ns, key), JSON.stringify(value));
}
