// "EN - VI" gloss for the English example blocks of a lesson. The translations
// live in GrammarLesson.glossVi keyed by block id (the numbering scan() and
// walkLesson() share), so contentEnHtml / contentViHtml and their protected-zone
// gates stay untouched: the gloss is appended only when the page is composed.
import { TAG_SPLIT, BLOCK_TAGS, FORMULA, VOID_TAGS, englishBlockIds, scan } from "./vi-repair";

// Containers that start a nested structure: the gloss must land before them.
const NESTING = new Set(["ul", "ol", "table", "blockquote", "div"]);
const escapeHtml = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const norm = (s: string): string => s.replace(/&nbsp;|\s+/g, " ").trim();
const words = (s: string): number => s.split(/\s+/).filter((w) => /[A-Za-z]/.test(w)).length;

/**
 * Append ` - <translation>` inside each block that has a gloss, right before the
 * block's closing tag, so it reads on the same line as the English sentence.
 * Blocks are numbered exactly like scan(): every BLOCK_TAGS open tag, in order.
 */
export function applyBlockGloss(html: string, gloss: Record<string, string>): string {
  if (Object.keys(gloss).length === 0) return html;
  const parts = html.split(TAG_SPLIT);
  // `at` is the part index the gloss goes before: the first nested block, else
  // the start of the trailing <br> run, else the closing tag itself.
  const stack: Array<{ name: string; blockId: number; nestedAt?: number; brAt?: number }> = [];
  const before = new Map<number, string>();
  let nextBlockId = 0;
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (i % 2 === 0) {
      if (part.trim() && stack.length) for (const e of stack) e.brAt = undefined;
      continue;
    }
    const close = /^<\/\s*([a-zA-Z0-9]+)/.exec(part);
    if (close) {
      const name = close[1].toLowerCase();
      for (let j = stack.length - 1; j >= 0; j--) {
        if (stack[j].name !== name) continue;
        for (let k = stack.length - 1; k >= j; k--) {
          const text = stack[k].blockId >= 0 ? gloss[String(stack[k].blockId)] : undefined;
          if (!text) continue;
          const at = stack[k].nestedAt ?? stack[k].brAt ?? i;
          before.set(at, (before.get(at) ?? "") + `<span class="gloss"> - ${escapeHtml(text)}</span>`);
        }
        stack.length = j;
        break;
      }
      continue;
    }
    const open = /^<\s*([a-zA-Z0-9]+)([^>]*?)\/?>$/.exec(part);
    if (!open) continue;
    const name = open[1].toLowerCase();
    if (name === "br") {
      for (const e of stack) if (e.brAt === undefined) e.brAt = i;
      continue;
    }
    if (VOID_TAGS.has(name) || part.endsWith("/>")) continue;
    const isBlock = BLOCK_TAGS.has(name);
    if (isBlock || NESTING.has(name)) for (const e of stack) if (e.nestedAt === undefined) e.nestedAt = i;
    stack.push({ name, blockId: isBlock ? nextBlockId++ : -1 });
  }
  return parts.map((part, i) => (before.get(i) ?? "") + part).join("");
}

/**
 * The English example blocks that deserve a Vietnamese gloss: sentences in list
 * items, paragraphs and table cells that stay English in the VI lesson, either
 * because vi-repair protects them or because the translator kept them verbatim.
 * Short fragments (word forms like "I work") and bare word lists are skipped.
 */
export function lessonGlossBlocks(enHtml: string, viHtml: string): Array<{ blockId: number; text: string }> {
  const en = scan(enHtml);
  const vi = scan(viHtml);
  const protectedBlocks = englishBlockIds(en);
  const out: Array<{ blockId: number; text: string }> = [];
  for (const [id, block] of en.blocks) {
    if (block.tag !== "p" && block.tag !== "li" && block.tag !== "td") continue;
    const text = norm(block.text);
    const keptEnglish = vi.blocks.get(id) !== undefined && norm(vi.blocks.get(id)!.text) === text;
    if (!protectedBlocks.has(id) && !keptEnglish) continue;
    if (words(text) < (block.tag === "td" ? 4 : 3)) continue;
    if (FORMULA.test(text)) continue;
    if (!/[.?!]/.test(text) && text.split(/\s*,\s*/).length >= 5) continue; // a word list, not a sentence
    out.push({ blockId: id, text });
  }
  return out;
}
