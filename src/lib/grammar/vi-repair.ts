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
import { SEMANTIC_SPAN_CLASSES } from "./semantic-classes";

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

// Example sentences also live in bare <p> — 469 of the 2229 <p> blocks carry a
// sentence-role span — so tag alone cannot decide those. See isExampleBlock.
const EXAMPLE_BLOCK_TAGS = new Set(["p"]);

// A span with one of these classes marks a constituent of a sentence, so a
// block carrying one is presumptively an example: "My friend often
// <infinitive>draw</infinitive><ending>s</ending> nice posters."
//
// Deliberately excluded: ending / irregular-* (a morpheme is quoted by
// instructions too — "Add -ing to the infinitive"), signal-word (word lists,
// which sit in <li>/<td> anyway) and consonant / vowel (spelling rules are
// mostly prose about letters).
const SENTENCE_ROLE_CLASSES = new Set([
  "subject", "verb", "object", "auxiliary", "infinitive",
  "negation", "adjective", "adverb", "place", "mistake",
]);

// Every semantic span is markup the source wrapped around English material, so
// its text stays English wherever it appears — including inside prose that
// stays Vietnamese, where the sentence then cites the English form it is
// talking about ("Dùng <auxiliary>do</auxiliary> để phủ định"). Without this an
// instruction to "add -es" renders as "add -phải".
const PROTECTED_SPAN_CLASSES: ReadonlySet<string> = new Set(SEMANTIC_SPAN_CLASSES);

// <i> is the source's citation marker: of its 1320 uses, all but a handful wrap
// a tense name (Simple Past), a quoted form (going to, -ed) or a list of the
// verbs a lesson is about (be, believe, belong, hate, …). Those are the lesson,
// not prose about it.
const PROTECTED_TAGS = new Set(["i"]);

const ARROW = /=>|→|⇒|-->/;
const STRIP_TAGS = /<[^>]+>/g;

// A block that talks *about* grammar is an instruction, not a specimen: "You
// need the auxiliary do/does and the infinitive of the verb." Naming a word
// class or a tense is what separates those from the examples around them — an
// example sentence is about posters, milk or the sun, never about adverbs.
// Measured over the corpus this splits the 462 role-carrying <p> blocks into
// 120 instructions and 342 examples, with no example lost to a false hit.
const METALANGUAGE =
  /\b(auxiliar(y|ies)|infinitives?|gerunds?|participles?|adverbs?|adjectives?|nouns?|pronouns?|verbs?|endings?|subjects?|objects?|prepositions?|articles?|modals?|tenses?|forms?|sentences?|clauses?|questions?|singular|plural|contracted|comparative|superlative|syllables?|vowels?|consonants?|apostrophes?|columns?)\b/i;

// …unless it is a recipe rather than a sentence about one: "will + infinitive",
// "to be (was, were) + infinitive + -ing", "has → 3rd person singular". Those
// name word classes too, but every token in them is the English the learner
// has to reproduce.
const FORMULA = /[+→⇒]|=>/;

// "Example:  deer" — the label is a cue and translates fine, everything after
// it is the specimen and must not. Machine translation took the whole line, so
// the invariant-plural demo "deer" arrived as "hươu" and "key => keys" as
// "phím => phím". Captures the leading whitespace, the label, and its
// punctuation so the Vietnamese cue can be kept in front of the English body.
const EXAMPLE_LABEL = /^(\s*)(Examples?|Ví dụ|VD)(\s*[:.]\s*)/i;

type Node = { text: string; blockId: number; protectedSpan: boolean };
type Block = { tag: string; text: string; hasRole: boolean };
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
 * protected span encloses it; every block accumulates its own raw text and
 * remembers whether a sentence-role span appeared inside it. One walker for
 * both documents — two walkers would have to agree on block numbering, and
 * would silently drift apart the first time either changed.
 */
function scan(html: string): Scan {
  const parts = html.split(TAG_SPLIT);
  const tags: string[] = [];
  const nodes: Node[] = [];
  const blocks = new Map<number, Block>();
  const openTags: string[] = [];
  const openProtected: boolean[] = []; // parallel to openTags
  const openRoles: boolean[] = []; // parallel to openTags
  const openBlockIds: number[] = [];
  let protectedDepth = 0;
  let roleDepth = 0;
  let nextBlockId = 0;

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];

    if (i % 2 === 0) {
      const blockId = openBlockIds.length ? openBlockIds[openBlockIds.length - 1] : -1;
      nodes.push({ text: part, blockId, protectedSpan: protectedDepth > 0 });
      const block = blocks.get(blockId);
      if (block) {
        block.text += part;
        // An empty span proves nothing about the block around it.
        if (roleDepth > 0 && part.trim()) block.hasRole = true;
      }
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
          if (openProtected[k]) protectedDepth--;
          if (openRoles[k]) roleDepth--;
          if (BLOCK_TAGS.has(openTags[k])) openBlockIds.pop();
        }
        openTags.length = j;
        openProtected.length = j;
        openRoles.length = j;
        break;
      }
      continue;
    }

    const open = /^<\s*([a-zA-Z0-9]+)([^>]*?)\/?>$/.exec(part);
    if (!open) continue;
    const name = open[1].toLowerCase();
    if (VOID_TAGS.has(name) || part.endsWith("/>")) continue;
    const cls = /class="([^"]*)"/.exec(open[2]);
    const classes = cls ? cls[1].split(/\s+/) : [];
    const isProtected =
      PROTECTED_TAGS.has(name) || classes.some((c) => PROTECTED_SPAN_CLASSES.has(c));
    const isRole = classes.some((c) => SENTENCE_ROLE_CLASSES.has(c));
    openTags.push(name);
    openProtected.push(isProtected);
    openRoles.push(isRole);
    if (isProtected) protectedDepth++;
    if (isRole) roleDepth++;
    if (BLOCK_TAGS.has(name)) {
      blocks.set(nextBlockId, { tag: name, text: "", hasRole: false });
      openBlockIds.push(nextBlockId);
      nextBlockId++;
    }
  }
  return { tags, nodes, blocks };
}

export type LessonRepair = { html: string; restored: number };

/**
 * True for a <p> that is an example sentence rather than an instruction about
 * one. The tell is the sentence-role markup the source puts on examples; the
 * exception is the instruction that quotes a role inline ("Always use the
 * auxiliary do for negations"), which names a word class and so reads as
 * metalanguage — unless it is a bare recipe like "will + infinitive".
 *
 * Both directions cost something, and they do not cost the same: a specimen
 * left in English is read as English, a translated one teaches "Mặt Trời tăng
 * lương s Ở miền đông". So the doubtful blocks stay English.
 */
export function isExampleBlock(text: string): boolean {
  const plain = text.replace(STRIP_TAGS, " ").trim();
  return FORMULA.test(plain) || !METALANGUAGE.test(plain);
}

// Blocks whose full English text must survive any translation round verbatim:
// conjugation-table cells, example lists, example sentences in <p>, and prose
// blocks that happen to be an inflection pattern. Decided per block, never per
// text node.
function englishBlockIds(en: Scan): Set<number> {
  const ids = new Set<number>();
  for (const [id, block] of en.blocks) {
    const text = block.text.trim();
    const isExample =
      block.hasRole && EXAMPLE_BLOCK_TAGS.has(block.tag) && isExampleBlock(text);
    if (ENGLISH_BLOCKS.has(block.tag) || isExample || isInflectionPattern(text)) {
      ids.add(id);
    }
  }
  return ids;
}

/**
 * Restore English study material into a translated lesson body.
 *
 * Returns null when the two documents do not tokenize identically — the walk
 * would then splice text into the wrong slots, so the caller keeps the VI as-is
 * (or nulls it) rather than corrupting it further.
 */
export function repairLessonViHtml(enHtml: string, viHtml: string): LessonRepair | null {
  const en = scan(enHtml);
  const vi = scan(viHtml);
  if (en.nodes.length !== vi.nodes.length) return null;
  if (en.tags.length !== vi.tags.length) return null;
  if (en.tags.some((tag, i) => tag !== vi.tags[i])) return null;

  const englishBlocks = englishBlockIds(en);

  const parts = viHtml.split(TAG_SPLIT);
  let restored = 0;
  for (let n = 0; n < en.nodes.length; n++) {
    const node = en.nodes[n];
    if (!englishBlocks.has(node.blockId) && !node.protectedSpan) continue;
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

// ── Tier-1 helpers: let an LLM touch ONLY the prose ──────────────────────
//
// The safest translation round never shows the protected zones to the model:
// prose nodes are extracted, translated out-of-band, and spliced back while
// every protected node is force-restored from the EN original. Assembly is
// followed by checkLessonVi as the final gate.

export type ProseNode = { index: number; text: string };

/** The text nodes a translation round may render in Vietnamese, with their
 *  even-index position in the TAG_SPLIT token stream. */
export function lessonProseNodes(enHtml: string): ProseNode[] {
  const en = scan(enHtml);
  const englishBlocks = englishBlockIds(en);
  const out: ProseNode[] = [];
  for (let n = 0; n < en.nodes.length; n++) {
    const node = en.nodes[n];
    if (englishBlocks.has(node.blockId) || node.protectedSpan) continue;
    if (!node.text.trim()) continue;
    out.push({ index: n, text: node.text });
  }
  return out;
}

/**
 * Splice translated prose into a base document. Protected nodes come back as
 * the English original whatever the base says; prose nodes take their
 * translation when present and keep the base text otherwise (so a partial
 * batch degrades to the current VI, never to garbage). Returns null when the
 * base does not tokenize like the EN original — the caller then rebuilds from
 * the EN document itself.
 */
export function assembleLessonVi(
  enHtml: string,
  baseHtml: string,
  viByIndex: ReadonlyMap<number, string>
): string | null {
  const en = scan(enHtml);
  const base = scan(baseHtml);
  if (en.nodes.length !== base.nodes.length) return null;
  if (en.tags.length !== base.tags.length) return null;
  if (en.tags.some((t, i) => t !== base.tags[i])) return null;
  const englishBlocks = englishBlockIds(en);
  const parts = baseHtml.split(TAG_SPLIT);
  for (let n = 0; n < en.nodes.length; n++) {
    const node = en.nodes[n];
    if (englishBlocks.has(node.blockId) || node.protectedSpan) {
      parts[n * 2] = node.text;
    } else {
      const vi = viByIndex.get(n);
      if (vi !== undefined) parts[n * 2] = vi;
    }
  }
  return parts.join("");
}


// ── Tier-1 validators: the mechanical gate LLM output must pass ─────────
export type CheckResult = { ok: true } | { ok: false; reason: string };

/**
 * (1) The VI lesson HTML must tokenize to the exact same tag sequence as the
 * EN one, and (2) every text node inside a protected zone (EN block or
 * morpheme span) must be the English original, character for character.
 */
export function checkLessonVi(enHtml: string, viHtml: string): CheckResult {
  const en = scan(enHtml);
  const vi = scan(viHtml);
  if (en.nodes.length !== vi.nodes.length) {
    return { ok: false, reason: `text-node count differs: EN ${en.nodes.length} vs VI ${vi.nodes.length}` };
  }
  if (en.tags.length !== vi.tags.length || en.tags.some((t, i) => t !== vi.tags[i])) {
    return { ok: false, reason: "HTML tag sequence differs from the English original" };
  }
  const englishBlocks = englishBlockIds(en);
  const bad: number[] = [];
  for (let n = 0; n < en.nodes.length; n++) {
    const node = en.nodes[n];
    if (!englishBlocks.has(node.blockId) && !node.protectedSpan) continue;
    if (vi.nodes[n].text !== node.text) bad.push(n);
  }
  if (bad.length > 0) {
    return { ok: false, reason: `${bad.length} protected EN text node(s) altered (first at index ${bad[0]})` };
  }
  return { ok: true };
}

/**
 * Practice explanations are line-aligned plain text. Lines must stay in
 * number; "Example:" lines keep their (translated) label but the English
 * specimen after it must survive verbatim; inflection-pattern lines must come
 * back unchanged whole.
 */
export function checkExplanationVi(en: string, vi: string): CheckResult {
  const enLines = (en ?? "").split("\n");
  const viLines = (vi ?? "").split("\n");
  if (enLines.length !== viLines.length) {
    return { ok: false, reason: `line count differs: EN ${enLines.length} vs VI ${viLines.length}` };
  }
  for (let i = 0; i < enLines.length; i++) {
    const enLine = enLines[i];
    const line = viLines[i];
    const enLabel = EXAMPLE_LABEL.exec(enLine);
    if (enLabel) {
      const viLabel = EXAMPLE_LABEL.exec(line);
      if (!viLabel) return { ok: false, reason: `line ${i + 1}: example label missing` };
      if (line !== viLabel[0] + enLine.slice(enLabel[0].length)) {
        return { ok: false, reason: `line ${i + 1}: the English example body must stay verbatim after the label` };
      }
      continue;
    }
    if (isInflectionPattern(enLine) && line !== enLine) {
      return { ok: false, reason: `line ${i + 1}: inflection pattern must stay verbatim` };
    }
  }
  return { ok: true };
}

export type EntriesCheck = { ok: true; entries: ConfusedEntry[] } | { ok: false; reason: string };

/**
 * (3) entriesVi must parse and keep the English side verbatim: same entry
 * count, "w" and "examples" identical to EN — only the "m" gloss carries the
 * Vietnamese. A missing "examples" is tolerated and filled from EN.
 */
export function checkEntriesVi(en: ConfusedEntry[], viText: string): EntriesCheck {
  let parsed: unknown;
  try {
    parsed = JSON.parse(viText);
  } catch {
    return { ok: false, reason: "output is not valid JSON" };
  }
  if (!Array.isArray(parsed) || parsed.length !== en.length) {
    return { ok: false, reason: `must be a JSON array of exactly ${en.length} entries` };
  }
  const out: ConfusedEntry[] = [];
  for (let i = 0; i < en.length; i++) {
    const item = parsed[i] as Partial<ConfusedEntry> | null;
    if (typeof item !== "object" || item === null) return { ok: false, reason: `entry ${i}: not an object` };
    if (item.w !== en[i].w) return { ok: false, reason: `entry ${i}: "w" must stay "${en[i].w}" verbatim` };
    if (typeof item.m !== "string" || !item.m.trim()) {
      return { ok: false, reason: `entry ${i}: "m" must be a non-empty Vietnamese gloss` };
    }
    if (item.examples !== undefined && JSON.stringify(item.examples) !== JSON.stringify(en[i].examples)) {
      return { ok: false, reason: `entry ${i}: "examples" must stay the English originals verbatim` };
    }
    out.push({ w: en[i].w, m: item.m.trim(), examples: en[i].examples });
  }
  return { ok: true, entries: out };
}
