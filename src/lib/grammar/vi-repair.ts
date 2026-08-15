// Tier-0 mechanical repair of the machine-translated *Vi columns.
//
// The source CSV was translated wholesale, so the English material a learner is
// meant to READ AS ENGLISH — conjugation tables, example sentences, inflection
// patterns — came back in Vietnamese: "I cannot play football" became "tôi có
// thể không chơi bóng đá", "tomato => tomatoes" became "cà chua => cà chuaes".
// The explanatory prose around it is fine to have in Vietnamese; the study
// material is not.
//
// No translator is needed to undo that half. For lessons the EN and VI HTML
// still tokenize to an identical tag sequence (288/292 lessons, measured), so
// the two can be walked in lockstep and every text node sitting in a protected
// zone restored verbatim from the EN side. Prose nodes keep their (mediocre)
// Vietnamese until the LLM pass replaces them.
//
// Prisma-free so vitest can cover it. Used by prisma/grammar-repair-vi.ts (the
// one-off pass over the existing rows) and prisma/import-grammar.ts (so a
// re-import cannot reintroduce the rot).
import type { ConfusedEntry } from "./confused-json";

// Splitting on a capturing group yields [text, tag, text, tag, …, text]: text
// at even indices, tags at odd ones, always an odd total.
const TAG_SPLIT = /(<[^>]+>)/;
const VOID_TAGS = new Set(["br", "hr", "img"]);

// Elements that delimit one unit of content. Protection is decided per block,
// never per text node: `tomato => tomato<b>es</b>` is three text nodes of one
// indivisible pattern, and restoring only the nodes that happen to look wrong
// yields "dictionary => dictionarphải".
const BLOCK_TAGS = new Set(["td", "th", "li", "p", "h1", "h2", "h3", "h4", "blockquote"]);

// Blocks whose text is study material rather than explanation. <td> holds
// conjugation-table cells and <li> holds example sentences and word lists.
// <th> is a column label and stays Vietnamese — no <th> in the corpus carries a
// sentence-role span, so none of them is an example.
//
// <li> is roughly 4:1 example-to-prose, so the rule leaves some instructional
// bullets in English. That asymmetry is deliberate: an untranslated sentence
// merely inconveniences a reader, a translated example teaches the wrong thing.
const ENGLISH_BLOCKS = new Set(["td", "li"]);

// Morphemes the lesson is teaching. These stay English even inside prose — an
// instruction to "add -es" must not render as "add -phải".
const MORPHEME_CLASSES = new Set(["ending", "irregular-past", "irregular-participle"]);

const ARROW = /=>|→|⇒|-->/;
const STRIP_TAGS = /<[^>]+>/g;

// "Example:  deer" — the label is a cue and translates fine, everything after
// it is the specimen and must not. Machine translation took the whole line, so
// the invariant-plural demo "deer" arrived as "hươu" and "key => keys" as
// "phím => phím". Captures the leading whitespace, the label, and its
// punctuation so the Vietnamese cue can be kept in front of the English body.
const EXAMPLE_LABEL = /^(\s*)(Examples?|Ví dụ|VD)(\s*[:.]\s*)/i;

type Node = { text: string; blockId: number; inMorpheme: boolean };
type Block = { tag: string; text: string };
type Scan = { tags: string[]; nodes: Node[]; blocks: Map<number, Block> };

/**
 * True for a morphology demonstration like "tomato => tomatoes" or
 * "clean → cleaner → (the) cleanest", where every segment after the first
 * extends the first as a prefix. That only holds for word-form patterns, never
 * for a translated sentence ("Singular → Plural", "Beer is uncount noun → …"),
 * which is what keeps the rule from eating legitimate prose.
 */
export function isInflectionPattern(text: string): boolean {
  const segments = text.replace(STRIP_TAGS, "").split(ARROW).map((s) => s.trim());
  if (segments.length < 2) return false;
  const head = segments[0].replace(/[()]/g, " ").trim();
  // The head has to be one plain ASCII word; anything else is a sentence.
  if (!/^[A-Za-z][A-Za-z'’-]*$/.test(head)) return false;
  const stem = head.toLowerCase().slice(0, Math.max(3, head.length - 2));
  return segments.slice(1).every((seg) => {
    const words = seg.replace(/[()]/g, " ").trim().toLowerCase().split(/\s+/).filter(Boolean);
    return words.some((w) => w.startsWith(stem));
  });
}

/**
 * Single pass over the token stream. Every text node is tagged with the
 * innermost block it belongs to (-1 when it floats outside any) and whether a
 * morpheme span encloses it; every block accumulates its own raw text. One
 * walker for both documents — two walkers would have to agree on block
 * numbering, and would silently drift apart the first time either changed.
 */
function scan(html: string): Scan {
  const parts = html.split(TAG_SPLIT);
  const tags: string[] = [];
  const nodes: Node[] = [];
  const blocks = new Map<number, Block>();
  const openTags: string[] = [];
  const openMorphemes: boolean[] = []; // parallel to openTags
  const openBlockIds: number[] = [];
  let morphemeDepth = 0;
  let nextBlockId = 0;

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];

    if (i % 2 === 0) {
      const blockId = openBlockIds.length ? openBlockIds[openBlockIds.length - 1] : -1;
      nodes.push({ text: part, blockId, inMorpheme: morphemeDepth > 0 });
      const block = blocks.get(blockId);
      if (block) block.text += part;
      continue;
    }

    tags.push(part);
    const close = /^<\/\s*([a-zA-Z0-9]+)/.exec(part);
    if (close) {
      const name = close[1].toLowerCase();
      // Unwind to the matching open tag; ignore a stray close with no opener.
      for (let j = openTags.length - 1; j >= 0; j--) {
        if (openTags[j] !== name) continue;
        for (let k = openTags.length - 1; k >= j; k--) {
          if (openMorphemes[k]) morphemeDepth--;
          if (BLOCK_TAGS.has(openTags[k])) openBlockIds.pop();
        }
        openTags.length = j;
        openMorphemes.length = j;
        break;
      }
      continue;
    }

    const open = /^<\s*([a-zA-Z0-9]+)([^>]*?)\/?>$/.exec(part);
    if (!open) continue;
    const name = open[1].toLowerCase();
    if (VOID_TAGS.has(name) || part.endsWith("/>")) continue;
    const cls = /class="([^"]*)"/.exec(open[2]);
    const isMorpheme = cls
      ? cls[1].split(/\s+/).some((c) => MORPHEME_CLASSES.has(c))
      : false;
    openTags.push(name);
    openMorphemes.push(isMorpheme);
    if (isMorpheme) morphemeDepth++;
    if (BLOCK_TAGS.has(name)) {
      blocks.set(nextBlockId, { tag: name, text: "" });
      openBlockIds.push(nextBlockId);
      nextBlockId++;
    }
  }
  return { tags, nodes, blocks };
}

export type LessonRepair = { html: string; restored: number };

/**
 * Restore English study material into a translated lesson body.
 *
 * Returns null when the two documents do not tokenize identically — the walk
 * would then splice text into the wrong slots, so the caller keeps the VI as-is
 * (or nulls it) rather than corrupt it further.
 */
export function repairLessonViHtml(enHtml: string, viHtml: string): LessonRepair | null {
  const en = scan(enHtml);
  const vi = scan(viHtml);
  if (en.nodes.length !== vi.nodes.length) return null;
  if (en.tags.length !== vi.tags.length) return null;
  if (en.tags.some((tag, i) => tag !== vi.tags[i])) return null;

  // Decide once per block, from the block's full English text.
  const englishBlocks = new Set<number>();
  for (const [id, block] of en.blocks) {
    if (ENGLISH_BLOCKS.has(block.tag) || isInflectionPattern(block.text.trim())) {
      englishBlocks.add(id);
    }
  }

  const parts = viHtml.split(TAG_SPLIT);
  let restored = 0;
  for (let n = 0; n < en.nodes.length; n++) {
    const node = en.nodes[n];
    if (!englishBlocks.has(node.blockId) && !node.inMorpheme) continue;
    if (parts[n * 2] === node.text) continue;
    parts[n * 2] = node.text;
    restored++;
  }
  return { html: parts.join(""), restored };
}

/**
 * A question stem with a blank IS the exercise — "The dog ___ small." only
 * works in English. Translating it ("Con chó ___ nhỏ.") leaves a learner
 * choosing between am/are/is for a Vietnamese sentence that needs no verb.
 */
export function isBlankStem(question: string): boolean {
  return /_{2,}|\.{4,}|…/.test(question ?? "");
}

export type ExplanationRepair = { text: string; restored: number };

/**
 * Restore the English specimens inside a practice explanation: "Example:" lines
 * keep their Vietnamese cue but get their English body back, and inflection
 * patterns are restored whole. Everything else is prose and stays Vietnamese.
 *
 * Plain text, so alignment is by line; a differing line count means the
 * translation merged or split lines and nothing can be spliced safely.
 */
export function repairExplanationVi(en: string, vi: string): ExplanationRepair | null {
  const enLines = (en ?? "").split("\n");
  const viLines = (vi ?? "").split("\n");
  if (enLines.length !== viLines.length) return null;
  let restored = 0;
  const out = viLines.map((line, i) => {
    const enLine = enLines[i];
    if (line === enLine) return line;

    const enLabel = EXAMPLE_LABEL.exec(enLine);
    if (enLabel) {
      // Prefer the Vietnamese cue when the translation kept one; the body is
      // always the English remainder.
      const viLabel = EXAMPLE_LABEL.exec(line);
      const cue = viLabel ? viLabel[0] : enLabel[0];
      const repaired = cue + enLine.slice(enLabel[0].length);
      if (repaired === line) return line;
      restored++;
      return repaired;
    }

    if (!isInflectionPattern(enLine)) return line;
    restored++;
    return enLine;
  });
  return { text: out.join("\n"), restored };
}

/**
 * Rebuild a confused-word pair's Vietnamese side from the English one: the
 * headword and its example sentences are the thing being distinguished
 * ("bare, bear" must not become "trần, gấu"), so only the meaning gloss stays
 * Vietnamese. Returns null when the two sides do not line up.
 */
export function repairConfusedEntriesVi(
  en: ConfusedEntry[],
  vi: ConfusedEntry[] | null
): ConfusedEntry[] | null {
  if (!vi || vi.length !== en.length || en.length === 0) return null;
  const merged = en.map((e, i) => ({ w: e.w, m: vi[i].m.trim(), examples: e.examples }));
  return merged.some((e) => e.m) ? merged : null;
}

/**
 * Common-mistake titles are "Absorbed ( = very much interested)" — an English
 * headword plus a gloss. The headword was translated away in 682/687 rows;
 * splice the English one back in front of the Vietnamese gloss. Returns null
 * when either side does not have that shape, so the caller falls back to EN.
 */
export function repairMistakeTitleVi(titleEn: string, titleVi: string | null): string | null {
  const shape = /^(.*?)\s*\(\s*=?\s*(.+?)\s*\)\s*$/;
  const en = shape.exec(titleEn ?? "");
  const vi = shape.exec(titleVi ?? "");
  if (!en || !vi || !en[1].trim() || !vi[2].trim()) return null;
  return `${en[1].trim()} (= ${vi[2].trim()})`;
}
