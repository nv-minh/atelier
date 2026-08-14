/* eslint-disable */
// Shared HTTP helpers for the pack pipeline. Polite defaults: descriptive UA,
// retries with backoff, hard timeout. Mirrors the conventions of
// prisma/fetch-images.ts but on global fetch (Node 18+ via tsx).

// Wikimedia and dictionaryapi.dev both see this string, and Wikimedia's UA
// policy expects a contact that actually resolves. The old value named
// contact@atelier.app — a mailbox on a domain nobody here owns. A URL is the
// honest form until there is a real inbox to point at.
export const UA = "Atelier/1.0 (language-learning app; +https://github.com/nv-minh/atelier)";

// Some hosts (Squarespace) 404 non-browser UAs on static file links.
export const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function fetchText(
  url: string,
  opts: { ua?: string; retries?: number; timeoutMs?: number } = {}
): Promise<string> {
  const { ua = UA, retries = 2, timeoutMs = 20000 } = opts;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": ua },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (res.status === 404) throw Object.assign(new Error("404"), { notFound: true });
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      return await res.text();
    } catch (e: any) {
      if (e?.notFound) throw e; // 404 is a result, not a flake — don't retry
      lastErr = e;
      if (attempt < retries) await sleep(800 * (attempt + 1));
    }
  }
  throw lastErr;
}

export async function fetchJson(url: string, opts: Parameters<typeof fetchText>[1] = {}): Promise<any> {
  return JSON.parse(await fetchText(url, opts));
}

// Decode bytes as UTF-8, falling back to Latin-1 when the bytes aren't valid
// UTF-8 (the NGSL-family CSVs are Latin-1: "résumé" is a lone 0xE9).
export function decodeSmart(buf: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buf);
  } catch {
    return new TextDecoder("latin1").decode(buf);
  }
}

export function isNotFound(e: unknown): boolean {
  return Boolean((e as any)?.notFound);
}
