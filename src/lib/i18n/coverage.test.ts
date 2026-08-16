import { describe, expect, it } from "vitest";
import { TOPICS } from "@/lib/topic-taxonomy";
import { dictionaries } from "./dictionaries";

// File này khẳng định ĐỘ PHỦ của từ điển i18n so với danh sách chủ đề thật —
// khác với src/lib/topic-taxonomy.test.ts (khẳng định hình dạng taxonomy, ví
// dụ t.blurb.length > 0). Đừng gộp hai file, chúng bắt hai loại lỗi khác nhau.

const LANGS = ["vi", "en"] as const;

describe("phủ từ điển topics theo TOPICS", () => {
  it("mọi chủ đề có tên và blurb khác rỗng ở cả vi lẫn en", () => {
    for (const tp of TOPICS) {
      for (const lang of LANGS) {
        const name = dictionaries[lang].topics.names[tp.slug];
        const blurb = dictionaries[lang].topics.blurbs[tp.slug];
        expect(name, `topics.names.${tp.slug} thiếu ở lang=${lang}`).toEqual(expect.any(String));
        expect(name.length, `topics.names.${tp.slug} rỗng ở lang=${lang}`).toBeGreaterThan(0);
        expect(blurb, `topics.blurbs.${tp.slug} thiếu ở lang=${lang}`).toEqual(expect.any(String));
        expect(blurb.length, `topics.blurbs.${tp.slug} rỗng ở lang=${lang}`).toBeGreaterThan(0);
      }
    }
  });

  it("không giá trị nào bị dán trùng chính khoá của nó", () => {
    // Bắt lỗi kiểu dán "office-skills" (chính slug) làm nội dung blurb/name.
    for (const tp of TOPICS) {
      for (const lang of LANGS) {
        const name = dictionaries[lang].topics.names[tp.slug];
        const blurb = dictionaries[lang].topics.blurbs[tp.slug];
        expect(name, `topics.names.${tp.slug} bằng chính khoá ở lang=${lang}`).not.toBe(tp.slug);
        expect(blurb, `topics.blurbs.${tp.slug} bằng chính khoá ở lang=${lang}`).not.toBe(tp.slug);
      }
    }
  });

  it("blurb khác name trong cùng ngôn ngữ, và blurb khác nhau giữa vi và en", () => {
    for (const tp of TOPICS) {
      // Bắt lỗi dán nhầm tên chủ đề vào ô blurb (đã xảy ra với 6 chủ đề tiếng Anh).
      expect(
        dictionaries.vi.topics.blurbs[tp.slug],
        `vi: blurb trùng name ở ${tp.slug}`
      ).not.toBe(dictionaries.vi.topics.names[tp.slug]);
      expect(
        dictionaries.en.topics.blurbs[tp.slug],
        `en: blurb trùng name ở ${tp.slug}`
      ).not.toBe(dictionaries.en.topics.names[tp.slug]);

      // Bắt lỗi dán cùng một chuỗi tiếng Anh vào cả hai bên vi/en.
      expect(
        dictionaries.vi.topics.blurbs[tp.slug],
        `blurb vi và en trùng nhau ở ${tp.slug}`
      ).not.toBe(dictionaries.en.topics.blurbs[tp.slug]);
    }
  });
});
