// Tier-1 segment machinery for the lesson translation round.
//
// The 2026-08-16 round translated whole-HTML blocks and silently skipped every
// heading that contained a protected span. This module replaces that shape:
// each translatable block (headings, prose <p>/<blockquote>, <th> labels) is
// extracted as ONE segment — a string in which every protected span and every
// inline tag is masked as a {n} placeholder — so the model sees the full block
// context and cannot "lose" the English spans it must not touch. Assembly
// splices a translation back at exactly the same token positions; the
// tag-stream equality with the EN original is what the gates verify.
//
// Block numbering matches vi-repair's scan() (same BLOCK_TAGS, same document
// order), so englishBlockIds() from the EN scan filters the same blocks here.
// Specimen/formula classification runs on the SEGMENT form (placeholders
// visible): "Use of the {0}" must classify by its words, not by the truncated
// prose "Use of the " that masking leaves behind.
import {
  BLOCK_TAGS,
  FORMULA,
  TAG_SPLIT,
  VI_DIACRITIC,
  VOID_TAGS,
  englishBlockIds,
  scan,
} from "./vi-repair";
import { isSpecimenHeading } from "./heading-glossary";

// The tags a translatable block may have. <td>/<li> are English blocks by the
// vi-repair rules and never appear here.
const TRANSLATABLE_TAGS = new Set(["h1", "h2", "h3", "h4", "p", "blockquote", "th"]);

// A span the model must not see the inside of: semantic-class spans and <i>
// hold the English material a lesson teaches.
const PROTECTED_TAGS = new Set(["i"]);

type Frame = {
  name: string;
  protectedEl: boolean;
  blockId: number; // -1 when the frame is not a block
  openIndex: number; // part index of the opening tag
};

export type SegText = { kind: "text"; text: string; partIndex: number };
export type SegSlot = { kind: "slot"; raw: string };
export type SegItem = SegText | SegSlot;

export type SegBlock = {
  id: number;
  tag: string;
  items: SegItem[]; // top-level items only (slot raws carry their interiors)
  container: boolean; // has a nested block inside → its children translate, not it
};

export type Walk = { parts: string[]; blocks: Map<number, SegBlock> };

/** True for a string carrying at least two ASCII letters (entity-stripped). */
function hasTwoLetters(text: string): boolean {
  return /[A-Za-z].*[A-Za-z]/.test(text.replace(/&#?\w+;/g, " "));
}

/**
 * Token walk producing per-block segment items. `protectedClasses` is a
 * parameter (the caller passes SEMANTIC_SPAN_CLASSES) so this module stays
 * out of lesson-html's sanitize-html import graph.
 */
export function walkLesson(html: string, protectedClasses: ReadonlySet<string>): Walk {
  const parts = html.split(TAG_SPLIT);
  const blocks = new Map<number, SegBlock>();
  const stack: Frame[] = [];
  let nextBlockId = 0;

  const attach = (item: SegItem): void => {
    for (let j = stack.length - 1; j >= 0; j--) {
      if (stack[j].protectedEl) return; // inside a protected element: slot material
      if (stack[j].blockId >= 0) {
        blocks.get(stack[j].blockId)?.items.push(item);
        return;
      }
    }
  };

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (i % 2 === 0) {
      attach({ kind: "text", text: part, partIndex: i });
      continue;
    }

    const close = /^<\/\s*([a-zA-Z0-9]+)/.exec(part);
    if (close) {
      const name = close[1].toLowerCase();
      for (let j = stack.length - 1; j >= 0; j--) {
        if (stack[j].name !== name) continue;
        const frame = stack[j];
        stack.length = j; // everything above the matched open closes with it
        if (frame.protectedEl) {
          attach({ kind: "slot", raw: parts.slice(frame.openIndex, i + 1).join("") });
        } else if (!BLOCK_TAGS.has(name)) {
          attach({ kind: "slot", raw: part });
        }
        break;
      }
      continue;
    }

    const open = /^<\s*([a-zA-Z0-9]+)([^>]*?)\/?>$/.exec(part);
    if (!open) continue;
    const name = open[1].toLowerCase();
    const cls = /class="([^"]*)"/.exec(open[2]);
    const classes = cls ? cls[1].split(/\s+/) : [];

    if (VOID_TAGS.has(name) || part.endsWith("/>")) {
      // Void tags (br, img) are layout: single-tag slots the model cannot move.
      attach({ kind: "slot", raw: part });
      continue;
    }

    const protectedEl = PROTECTED_TAGS.has(name) || classes.some((c) => protectedClasses.has(c));
    const frame: Frame = { name, protectedEl, blockId: -1, openIndex: i };
    if (BLOCK_TAGS.has(name)) {
      frame.blockId = nextBlockId++;
      blocks.set(frame.blockId, { id: frame.blockId, tag: name, items: [], container: false });
      // A block opening inside an open block marks that outer block a container.
      for (let j = stack.length - 1; j >= 0; j--) {
        if (stack[j].protectedEl) break;
        if (stack[j].blockId >= 0) {
          blocks.get(stack[j].blockId)!.container = true;
          break;
        }
      }
    } else if (!protectedEl) {
      // Opening tag of a plain inline element: a single-tag slot. Its inner
      // text still attaches as translatable text between the two slots.
      attach({ kind: "slot", raw: part });
    }
    stack.push(frame);
  }
  return { parts, blocks };
}

// ── Segment shaping ────────────────────────────────────────────────────────

export type Segment = {
  blockId: number;
  tag: string;
  en: string; // placeholder-masked block text
  slotCount: number;
};

/** The block's translatable text: its TEXT items concatenated. */
export function blockProseText(block: SegBlock): string {
  return block.items.filter((it): it is SegText => it.kind === "text").map((it) => it.text).join("");
}

/** Shape a block into its placeholder-masked segment string. */
export function toSegment(block: SegBlock): Segment {
  let slot = 0;
  let en = "";
  for (const item of block.items) {
    if (item.kind === "slot") en += `{${slot++}}`;
    else en += item.text;
  }
  return { blockId: block.id, tag: block.tag, en, slotCount: slot };
}

/**
 * True when a block is prose to translate: a translatable tag, not a
 * container, not an English block (vi-repair's rules on the EN scan), not a
 * word-form recipe, not a specimen heading, with ≥2 letters to translate.
 * Decided on the SEGMENT form so placeholders count as material. The gate
 * reuses this filter, so "what the model may translate" and "what must end
 * up Vietnamese" cannot drift apart.
 */
export function isTranslatableSegment(
  block: SegBlock,
  enScanBlocks: Set<number>,
  segment: Segment
): boolean {
  if (!TRANSLATABLE_TAGS.has(block.tag) || block.container) return false;
  if (enScanBlocks.has(block.id)) return false;
  if (!hasTwoLetters(segment.en)) return false;
  if (isSpecimenHeading(segment.en) || FORMULA.test(segment.en)) return false;
  return true;
}

/**
 * Splice a translated segment into a parts array, in place. Every placeholder
 * must survive exactly once and in order (no mangled forms like "{00}"), every
 * text node carrying content must be covered, and a piece landing where the
 * block has no text node must be empty. Writes are staged and applied only on
 * success, so a rejected translation cannot corrupt the parts array.
 * Returns false on any violation — the caller retries or drops the
 * translation, never splices garbage.
 */
export function spliceSegment(block: SegBlock, translated: string, parts: string[]): boolean {
  const tokens = translated.split(/(\{\d+\})/);
  const textItems = block.items.filter((it): it is SegText => it.kind === "text");
  const writes: Array<{ index: number; text: string }> = [];
  let slot = 0;
  let textIdx = 0;
  let pending = ""; // text accumulated since the last target/placeholder
  let pendingHasTarget = false;

  for (const tok of tokens) {
    if (tok === "") continue;
    const m = /^\{(\d+)\}$/.exec(tok);
    if (m) {
      if (m[1] !== String(Number(m[1]))) return false; // "{00}" and friends are mangled
      if (Number(m[1]) !== slot) return false;
      if (!pendingHasTarget && pending !== "") return false;
      slot++;
      pending = "";
      pendingHasTarget = false;
      continue;
    }
    if (/^\{[^}]*\}$/.test(tok)) return false; // an invented or broken placeholder
    pending += tok;
    if (textIdx < textItems.length) {
      writes.push({ index: textItems[textIdx].partIndex, text: pending });
      textIdx++;
      pending = "";
      pendingHasTarget = true;
    }
  }
  if (slot !== block.items.filter((it) => it.kind === "slot").length) return false;
  // Uncovered trailing nodes may only be whitespace the translation dropped.
  for (; textIdx < textItems.length; textIdx++) {
    if (textItems[textIdx].text.trim() !== "") return false;
  }
  if (!pendingHasTarget && pending !== "") return false;
  for (const w of writes) parts[w.index] = w.text;
  return true;
}

// ── Assembly & gates ───────────────────────────────────────────────────────

export type CheckResult = { ok: true } | { ok: false; reason: string };

/**
 * Assemble a new lesson body from a base document plus per-block translated
 * segments. The base must tokenize to the EN original's tag sequence. Blocks
 * without a translation keep the base text; translated blocks take their
 * spliced text. Protected zones are untouched by construction (their parts
 * are never written).
 */
export function assembleTranslated(
  enHtml: string,
  baseHtml: string,
  translations: ReadonlyMap<number, string>,
  protectedClasses: ReadonlySet<string>
): { html: string; applied: number; rejected: number } | null {
  const enTags = scan(enHtml);
  const baseTags = scan(baseHtml);
  if (enTags.tags.length !== baseTags.tags.length) return null;
  if (enTags.tags.some((t, i) => t !== baseTags.tags[i])) return null;

  const baseWalk = walkLesson(baseHtml, protectedClasses);
  const parts = [...baseWalk.parts];
  let applied = 0;
  let rejected = 0;
  for (const [blockId, translated] of translations) {
    const block = baseWalk.blocks.get(blockId);
    if (!block || !spliceSegment(block, translated, parts)) {
      rejected++;
      continue;
    }
    applied++;
  }
  return { html: parts.join(""), applied, rejected };
}

/**
 * The prose gate: every translatable block must read as Vietnamese (carry at
 * least one Vietnamese diacritic) unless its EN segment is explicitly
 * allowlisted as deliberate English (a specimen the classifier missed, kept
 * via the LLM round's "@keep"). This is what makes a partial, heading-skipping
 * batch unappliable — the failure mode of the 2026-08-16 round.
 */
export function checkLessonViProseVi(
  enHtml: string,
  viHtml: string,
  protectedClasses: ReadonlySet<string>,
  allowedEnglish?: ReadonlySet<string>
): CheckResult {
  const enTags = scan(enHtml);
  const viTags = scan(viHtml);
  if (enTags.tags.length !== viTags.tags.length || enTags.tags.some((t, i) => t !== viTags.tags[i])) {
    return { ok: false, reason: "HTML tag sequence differs from the English original" };
  }
  const english = englishBlockIds(enTags);
  const enWalk = walkLesson(enHtml, protectedClasses);
  const viWalk = walkLesson(viHtml, protectedClasses);

  let missing = 0;
  let first = "";
  for (const block of enWalk.blocks.values()) {
    const segment = toSegment(block);
    if (!isTranslatableSegment(block, english, segment)) continue;
    const viBlock = viWalk.blocks.get(block.id);
    const viText = viBlock ? blockProseText(viBlock) : "";
    if (VI_DIACRITIC.test(viText)) continue;
    if (allowedEnglish?.has(segment.en)) continue;
    missing++;
    if (!first) first = segment.en.slice(0, 60);
  }
  if (missing > 0) {
    return { ok: false, reason: `${missing} prose block(s) still English (first: "${first}")` };
  }
  return { ok: true };
}

/** True when the VI side of this block already reads as Vietnamese. */
export function blockIsTranslated(
  viHtml: string,
  blockId: number,
  protectedClasses: ReadonlySet<string>
): boolean {
  const viWalk = walkLesson(viHtml, protectedClasses);
  const block = viWalk.blocks.get(blockId);
  return block ? VI_DIACRITIC.test(blockProseText(block)) : false;
}
