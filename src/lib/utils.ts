import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function parseJsonArray(s: string | null | undefined): string[] {
  if (!s) return [];
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

export function todayStr(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

// Day arithmetic on the UTC axis. addDays() above uses local setDate/getDate,
// which is correct for a UTC-midnight base in every timezone EXCEPT across a
// DST transition, where the ±1h shift can push toISOString().slice(0,10) back
// a day. Everything date-keyed in this app (DailyStat.dateStr, streaks, the
// leaderboard week) is UTC, so new code uses this instead.
export function addUtcDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86400000);
}

// Monday (UTC midnight) of the ISO week containing `d`. Moved here from
// stats.ts so pure modules can use it without importing a server-only file.
export function isoWeekMonday(d = new Date()): Date {
  const base = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dow = base.getUTCDay(); // 0=Sun
  const back = dow === 0 ? 6 : dow - 1; // days since Monday
  return addUtcDays(base, -back);
}

// Human-readable interval preview
export function formatInterval(due: Date, now = new Date()): string {
  const diffMs = due.getTime() - now.getTime();
  const mins = diffMs / 60000;
  if (mins < 1) return "<1m";
  if (mins < 60) return `${Math.round(mins)}m`;
  const hours = mins / 60;
  if (hours < 24) return `${Math.round(hours)}h`;
  const days = hours / 24;
  if (days < 30) return `${Math.round(days)}d`;
  const months = days / 30;
  if (months < 12) return `${Math.round(months)}mo`;
  return `${(days / 365).toFixed(1)}y`;
}

// mm:ss clock for session/game timers (shared by matching + pronunciation).
export function fmtTime(sec: number): string {
  const mm = String(Math.floor(sec / 60)).padStart(2, "0");
  const ss = String(sec % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

// Levenshtein distance for fuzzy typing match
export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1].toLowerCase() === b[j - 1].toLowerCase() ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

export function normalizeWord(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s'-]/gu, "")
    .replace(/\s+/g, " ");
}

// Check typing answer: exact, fuzzy (1 typo), or synonym
export function gradeTyping(
  answer: string,
  correct: string,
  synonyms: string[] = []
): { correct: boolean; acceptedAs?: string; distance: number } {
  const ans = normalizeWord(answer);
  const cor = normalizeWord(correct);
  if (ans === cor) return { correct: true, distance: 0 };
  const d = levenshtein(ans, cor);
  // Accept 1-char typo for words length >= 4
  if (d === 1 && cor.length >= 4) return { correct: true, acceptedAs: "typo", distance: d };
  for (const syn of synonyms) {
    if (ans === normalizeWord(syn)) return { correct: true, acceptedAs: syn, distance: 0 };
  }
  return { correct: false, distance: d };
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function pick<T>(arr: T[], n: number): T[] {
  return shuffle(arr).slice(0, n);
}

// Distinct grayscale grain for noise texture handled in CSS
export const AUDIO_BASE =
  "https://raw.githubusercontent.com/winterdl/oxford-5000-vocabulary-audio-definition/main/audio/";
