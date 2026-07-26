/* eslint-disable */
// EN→VI translation via the free Google Translate gtx endpoint — the same
// endpoint prisma/translate-vi.ts uses. Kept as one shared implementation.
import { fetchJson } from "./http";
import { sleep } from "./http";

export async function gtxTranslate(text: string, retries = 2): Promise<string | null> {
  const clean = text?.trim();
  if (!clean) return null;
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=vi&dt=t&q=${encodeURIComponent(
    clean
  )}`;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const data = await fetchJson(url, { timeoutMs: 8000, retries: 0 });
      // data[0] is an array of [translatedChunk, originalChunk, ...]
      if (Array.isArray(data) && Array.isArray(data[0])) {
        const translated = data[0]
          .map((seg: any) => (seg && seg[0]) || "")
          .join("")
          .trim();
        if (translated) return translated;
      }
      return null;
    } catch {
      if (attempt === retries) return null;
      await sleep(800 * (attempt + 1));
    }
  }
  return null;
}
