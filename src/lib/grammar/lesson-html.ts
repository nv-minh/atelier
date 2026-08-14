// Lesson HTML is sanitized ONCE, at import time. The DB stores clean HTML and
// the client renders it with dangerouslySetInnerHTML and no runtime gate —
// this file is the only gate, so the whitelist errs on the side of dropping.
import sanitizeHtml from "sanitize-html";

export const LESSON_IMAGE_PREFIX = "/grammar/images/";
const ANDROID_ASSET_PREFIX = "file:///android_asset/images/";

// The 16 semantic classes actually present in the source lessons — the Plan-2
// lesson stylesheet colors exactly these. Everything else (wp-block-*,
// scrollbar4, german, example1–10, …) is layout junk from the source site:
// the class is stripped, the span and its text stay.
export const SEMANTIC_SPAN_CLASSES = [
  "adjective", "adverb", "verb", "subject", "object", "auxiliary",
  "infinitive", "negation", "signal-word", "ending", "irregular-past",
  "irregular-participle", "place", "mistake", "consonant", "vowel",
] as const;

export type CleanLessonResult = { html: string; missingImages: string[] };

export function cleanLessonHtml(html: string, availableImages: Set<string>): CleanLessonResult {
  const missingImages: string[] = [];
  const out = sanitizeHtml(html, {
    allowedTags: [
      "h1", "h2", "h3", "h4", "p", "table", "thead", "tbody", "tr", "th", "td",
      "ul", "ol", "li", "b", "strong", "i", "em", "u", "s", "del", "br", "hr",
      "blockquote", "span", "img", "sup", "cite",
    ],
    // Disallowed tags (font/div/figure/center/a/ins/g/…) are UNWRAPPED — text
    // survives. These must vanish WITH their contents instead:
    nonTextTags: ["script", "style", "aside", "textarea", "option", "xmp"],
    allowedAttributes: {
      span: ["class"],
      img: ["src", "alt"],
      td: ["colspan", "rowspan"],
      th: ["colspan", "rowspan"],
    },
    allowedClasses: { span: [...SEMANTIC_SPAN_CLASSES] },
    transformTags: {
      strike: "s",
      img: (tagName, attribs) => ({
        tagName,
        attribs: { ...attribs, src: (attribs.src ?? "").replace(ANDROID_ASSET_PREFIX, LESSON_IMAGE_PREFIX) },
      }),
    },
    // Runs after transformTags: drop any <img> not resolving to an extracted file.
    exclusiveFilter: (frame) => {
      if (frame.tag !== "img") return false;
      const src = frame.attribs.src ?? "";
      if (!src.startsWith(LESSON_IMAGE_PREFIX)) {
        missingImages.push(src);
        return true;
      }
      const file = src.slice(LESSON_IMAGE_PREFIX.length);
      if (!availableImages.has(file)) {
        missingImages.push(file);
        return true;
      }
      return false;
    },
  });
  return { html: out, missingImages };
}
