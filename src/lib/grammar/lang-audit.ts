// Pure measurements of VI/EN consistency, shared by the audit script and the
// acceptance check. Every predicate reuses the filter the translation gates use
// (isTranslatableSegment + VI_DIACRITIC), so "what the audit counts as a gap"
// and "what the gate refuses" cannot drift apart.
import {
  blockProseText,
  isTranslatableSegment,
  toSegment,
  walkLesson,
  type SegBlock,
  type Walk,
} from "./lesson-translate";
import { VI_DIACRITIC, englishBlockIds, fixProtectedSpacing, isBlankStem, scan } from "./vi-repair";
import { quotedSpans, repairStemVi, splitHybridStem } from "./stem-policy";

export type LessonLangAudit = {
  proseGaps: number;
  headingGaps: number;
  gluedSpans: number;
  emptiedInline: number; // English words inside <b>/<em>/... that the VI body lost
  tagMismatch: boolean;
};

const HEADING = /^h[1-4]$/;
const INLINE_OPEN = /^<(b|strong|em|u|cite|sup|sub|mark|span)\b[^>]*>$/i;
const INLINE_CLOSE = /^<\/(b|strong|em|u|cite|sup|sub|mark|span)>$/i;

/** Text of the gaps between consecutive slots of a block (gap k sits before slot k). */
function gapTexts(block: SegBlock): { gaps: string[]; slots: string[] } {
  const gaps = [""];
  const slots: string[] = [];
  for (const item of block.items) {
    if (item.kind === "slot") {
      slots.push(item.raw);
      gaps.push("");
    } else gaps[gaps.length - 1] += item.text;
  }
  return { gaps, slots };
}

/** Per block id: how many inline elements lost their English letters in the Vietnamese block. */
export function emptiedInlineBlocks(enWalk: Walk, viWalk: Walk): Map<number, number> {
  const out = new Map<number, number>();
  for (const [id, enBlock] of enWalk.blocks) {
    const viBlock = viWalk.blocks.get(id);
    if (!viBlock) continue;
    const en = gapTexts(enBlock);
    const vi = gapTexts(viBlock);
    const viText = vi.gaps.join("");
    for (let k = 1; k < en.gaps.length - 1 && k < vi.gaps.length; k++) {
      const open = INLINE_OPEN.exec(en.slots[k - 1]);
      const close = INLINE_CLOSE.exec(en.slots[k]);
      if (open && close && open[1].toLowerCase() === close[1].toLowerCase() && /[A-Za-z]/.test(en.gaps[k]) && vi.gaps[k].trim() === "" && !viText.includes(en.gaps[k].trim())) {
        out.set(id, (out.get(id) ?? 0) + 1);
      }
    }
  }
  return out;
}

export function auditLessonLang(
  enHtml: string,
  viHtml: string,
  protectedClasses: ReadonlySet<string>,
  allowedEnglish?: ReadonlySet<string>
): LessonLangAudit {
  const enScan = scan(enHtml);
  const viScan = scan(viHtml);
  if (enScan.tags.length !== viScan.tags.length || enScan.tags.some((t, i) => t !== viScan.tags[i])) {
    return { proseGaps: 0, headingGaps: 0, gluedSpans: 0, emptiedInline: 0, tagMismatch: true };
  }
  const english = englishBlockIds(enScan);
  const enWalk = walkLesson(enHtml, protectedClasses);
  const viWalk = walkLesson(viHtml, protectedClasses);

  let proseGaps = 0;
  let headingGaps = 0;
  for (const block of enWalk.blocks.values()) {
    const segment = toSegment(block);
    if (!isTranslatableSegment(block, english, segment)) continue;
    if (allowedEnglish?.has(segment.en)) continue; // deliberate English study material
    const viBlock = viWalk.blocks.get(block.id);
    if (viBlock && VI_DIACRITIC.test(blockProseText(viBlock))) continue;
    proseGaps++;
    if (HEADING.test(block.tag)) headingGaps++;
  }
  const gluedSpans = fixProtectedSpacing(enHtml, viHtml)?.fixed ?? 0;
  return { proseGaps, headingGaps, gluedSpans, emptiedInline: [...emptiedInlineBlocks(enWalk, viWalk).values()].reduce((x, y) => x + y, 0), tagMismatch: false };
}

/**
 * Why a lesson title needs retranslating, or null when it is fine. NULL is a
 * valid state (the UI falls back to English), so it is never flagged.
 */
export function flagTitleVi(titleEn: string, titleVi: string | null): string | null {
  if (titleVi === null) return null;
  const vi = titleVi.trim();
  if (!vi) return "empty";
  if (vi.toLowerCase() === titleEn.trim().toLowerCase()) return "identical to English";
  if (!VI_DIACRITIC.test(vi)) return "no Vietnamese diacritic";
  return null;
}

export type StemAudit =
  | "ok"
  | "blank-has-vi"
  | "vi-lacks-diacritic"
  | "quote-mangled"
  | "specimen-translated";

/** Classify a stored questionVi against the stem policy (see stem-policy.ts). */
export function auditStem(en: string, vi: string | null): StemAudit {
  if (vi === null) return "ok";
  if (isBlankStem(en)) return "blank-has-vi";
  if (!VI_DIACRITIC.test(vi)) return "vi-lacks-diacritic";
  if (splitHybridStem(en) && repairStemVi(en, vi) !== vi) return "specimen-translated";
  if (quotedSpans(en).some((span) => !vi.includes(span))) return "quote-mangled";
  return "ok";
}
