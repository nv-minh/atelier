// Pure measurements of VI/EN consistency, shared by the audit script and the
// acceptance check. Every predicate reuses the filter the translation gates use
// (isTranslatableSegment + VI_DIACRITIC), so "what the audit counts as a gap"
// and "what the gate refuses" cannot drift apart.
import {
  blockProseText,
  isTranslatableSegment,
  toSegment,
  walkLesson,
} from "./lesson-translate";
import { VI_DIACRITIC, englishBlockIds, fixProtectedSpacing, isBlankStem, scan } from "./vi-repair";

export type LessonLangAudit = {
  proseGaps: number;
  headingGaps: number;
  gluedSpans: number;
  tagMismatch: boolean;
};

const HEADING = /^h[1-4]$/;

export function auditLessonLang(
  enHtml: string,
  viHtml: string,
  protectedClasses: ReadonlySet<string>
): LessonLangAudit {
  const enScan = scan(enHtml);
  const viScan = scan(viHtml);
  if (enScan.tags.length !== viScan.tags.length || enScan.tags.some((t, i) => t !== viScan.tags[i])) {
    return { proseGaps: 0, headingGaps: 0, gluedSpans: 0, tagMismatch: true };
  }
  const english = englishBlockIds(enScan);
  const enWalk = walkLesson(enHtml, protectedClasses);
  const viWalk = walkLesson(viHtml, protectedClasses);

  let proseGaps = 0;
  let headingGaps = 0;
  for (const block of enWalk.blocks.values()) {
    if (!isTranslatableSegment(block, english, toSegment(block))) continue;
    const viBlock = viWalk.blocks.get(block.id);
    if (viBlock && VI_DIACRITIC.test(blockProseText(viBlock))) continue;
    proseGaps++;
    if (HEADING.test(block.tag)) headingGaps++;
  }
  const gluedSpans = fixProtectedSpacing(enHtml, viHtml)?.fixed ?? 0;
  return { proseGaps, headingGaps, gluedSpans, tagMismatch: false };
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

/** Task 1 covers the structural branches; stem-policy refines the rest. */
export function auditStem(en: string, vi: string | null): StemAudit {
  if (vi === null) return "ok";
  if (isBlankStem(en)) return "blank-has-vi";
  if (!VI_DIACRITIC.test(vi)) return "vi-lacks-diacritic";
  return "ok";
}
