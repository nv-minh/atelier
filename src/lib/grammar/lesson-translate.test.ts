import { describe, expect, it } from "vitest";
import { SEMANTIC_SPAN_CLASSES } from "./semantic-classes";
import {
  assembleTranslated,
  blockIsTranslated,
  checkLessonViProseVi,
  isTranslatableSegment,
  spliceSegment,
  toSegment,
  walkLesson,
} from "./lesson-translate";
import { englishBlockIds, scan } from "./vi-repair";

const PC: ReadonlySet<string> = new Set(SEMANTIC_SPAN_CLASSES);

const lesson =
  "<h2>1. Use of the <i>Simple Present</i></h2>" +
  '<h3>things in general</h3>' +
  '<p>The sun <span class="infinitive">rise</span><span class="ending">s</span> in the east.</p>' +
  "<p>The Simple Present is frequently used in English.</p>" +
  "<h3>Gerund + Noun</h3>" +
  "<h3>afraid of</h3>" +
  '<p>Add <span class="ending">es</span> to the verb.</p>';

function translatable(html: string) {
  const en = scan(html);
  const english = englishBlockIds(en);
  const walk = walkLesson(html, PC);
  return [...walk.blocks.values()]
    .map((b) => ({ block: b, seg: toSegment(b) }))
    .filter(({ block, seg }) => isTranslatableSegment(block, english, seg));
}

describe("walkLesson + isTranslatableSegment", () => {
  it("tách block thành segment với placeholder, giữ nguyên ví dụ EN", () => {
    const out = translatable(lesson);
    const segs = out.map((o) => o.seg);
    // Ví dụ <p> có role-span là English block; <p> hướng dẫn "Add es" chỉ giữ
    // đúng hình vị trong slot — phần văn vẫn dịch được (hành vi vi-repair).
    expect(segs.map((s) => s.en)).toEqual([
      "1. Use of the {0}",
      "things in general",
      "The Simple Present is frequently used in English.",
      "Add {0} to the verb.",
    ]);
  });

  it("heading specimen (công thức, danh sách từ) không vào hàng dịch", () => {
    const segs = translatable(lesson).map((o) => o.seg.en);
    expect(segs).not.toContain("Gerund + Noun");
    expect(segs).not.toContain("afraid of");
  });

  it("slot raw giữ nguyên chuỗi tag gốc của span bảo vệ", () => {
    const walk = walkLesson(lesson, PC);
    const h2 = [...walk.blocks.values()].find((b) => b.tag === "h2")!;
    const slots = h2.items.filter((it) => it.kind === "slot").map((it) => (it as { raw: string }).raw);
    expect(slots).toContain("<i>Simple Present</i>");
  });

  it("thẻ inline thường (b, br, img) thành slot đơn, text bên trong vẫn dịch được", () => {
    const html = "<p>We <b>use</b> adjectives here.<br>Second line.</p>";
    const out = translatable(html);
    expect(out[0].seg.en).toBe("We {0}use{1} adjectives here.{2}Second line.");
  });
});

describe("spliceSegment", () => {
  it("ghép đúng chỗ, giữ placeholder và độ phủ text node", () => {
    const html = "<h2>1. Use of the <i>Simple Present</i></h2>";
    const walk = walkLesson(html, PC);
    const block = [...walk.blocks.values()][0];
    const parts = [...walk.parts];
    expect(spliceSegment(block, "1. Cách dùng thì {0}", parts)).toBe(true);
    expect(parts.join("")).toBe("<h2>1. Cách dùng thì <i>Simple Present</i></h2>");
  });

  it("từ chối: thiếu/thừa placeholder, đổi thứ tự, bạ chữ vào khe chỉ có slot", () => {
    const html = "<p>Use <i>do</i> and <i>does</i> here.</p>";
    const walk = walkLesson(html, PC);
    const block = [...walk.blocks.values()][0];
    expect(spliceSegment(block, "Dùng {0} và {1} nhé.", [...walk.parts])).toBe(true);
    expect(spliceSegment(block, "Dùng {0} nhé.", [...walk.parts])).toBe(false); // thiếu {1}
    expect(spliceSegment(block, "Dùng {1} và {0} nhé.", [...walk.parts])).toBe(false); // sai thứ tự
    expect(spliceSegment(block, "Dùng {0}{1} nhé.", [...walk.parts])).toBe(false); // mất chữ giữa 2 slot
    expect(spliceSegment(block, "Dùng {0} và {1}", [...walk.parts])).toBe(false); // bỏ mất text node cuối
  });

  it("từ chối placeholder bịa ra hoặc méo mó", () => {
    const html = "<p>Use <i>do</i> here.</p>";
    const walk = walkLesson(html, PC);
    const block = [...walk.blocks.values()][0];
    expect(spliceSegment(block, "Dùng {0} và {1}.", [...walk.parts])).toBe(false);
    expect(spliceSegment(block, "Dùng {00}.", [...walk.parts])).toBe(false);
  });
});

describe("assembleTranslated + checkLessonViProseVi", () => {
  const viBody =
    "<h2>1. Use of the <i>Simple Present</i></h2>" +
    "<h3>things in general</h3>" +
    '<p>The sun <span class="infinitive">rise</span><span class="ending">s</span> in the east.</p>' +
    "<p>Bản dịch tiếng Việt đã có sẵn.</p>" +
    "<h3>Gerund + Noun</h3>" +
    "<h3>afraid of</h3>" +
    '<p>Thêm <span class="ending">es</span> vào động từ.</p>';

  it("chỉ thay block được dịch, chừa nguyên phần đã VI và phần EN-bọc", () => {
    const translations = new Map<number, string>([
      [0, "1. Cách dùng thì {0}"],
      [1, "sự việc nói chung"],
    ]);
    const out = assembleTranslated(lesson, viBody, translations, PC)!;
    expect(out.applied).toBe(2);
    expect(out.rejected).toBe(0);
    expect(out.html).toContain("<h2>1. Cách dùng thì <i>Simple Present</i></h2>");
    expect(out.html).toContain("<h3>sự việc nói chung</h3>");
    expect(out.html).toContain("<p>Bản dịch tiếng Việt đã có sẵn.</p>");
    expect(out.html).toContain(
      '<p>The sun <span class="infinitive">rise</span><span class="ending">s</span> in the east.</p>'
    );
  });

  it("cổng prose: hỏi khi block dịch được vẫn là tiếng Anh — rồi cửa khi đã có dấu", () => {
    // viBody giữ heading EN → cổng phải bắt đúng block đầu tiên.
    const bad = checkLessonViProseVi(lesson, viBody, PC);
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.reason).toContain("1. Use of the {0}");

    const good = checkLessonViProseVi(
      lesson,
      viBody
        .replace("<h2>1. Use of the <i>Simple Present</i></h2>", "<h2>1. Cách dùng thì <i>Simple Present</i></h2>")
        .replace("<h3>things in general</h3>", "<h3>sự việc nói chung</h3>"),
      PC
    );
    expect(good).toEqual({ ok: true });
  });

  it("cổng chấp nhận block được duyệt giữ tiếng Anh qua allowlist", () => {
    const r = checkLessonViProseVi(lesson, viBody, PC, new Set(["1. Use of the {0}", "things in general"]));
    expect(r).toEqual({ ok: true });
  });

  it("blockIsTranslated nhận diện block đã có dấu tiếng Việt", () => {
    expect(blockIsTranslated(viBody, 3, PC)).toBe(true); // p VI
    expect(blockIsTranslated(viBody, 0, PC)).toBe(false); // h2 EN
  });
});

describe("assembleTranslated with images and tables", () => {
  it("keeps the tag sequence of a lesson containing <img> and <table>", () => {
    const en = '<img src="/grammar/images/x.png"><table><tr><td>I work</td></tr></table><p>Use it daily.</p>';
    const out = assembleTranslated(en, en, new Map([[1, "Dùng hằng ngày."]]), PC);
    expect(out).not.toBeNull();
    expect(out!.html).toContain('<img src="/grammar/images/x.png">');
    expect(out!.html).toContain("<td>I work</td>");
    expect(out!.html).toContain("<p>Dùng hằng ngày.</p>");
    expect(scan(out!.html).tags).toEqual(scan(en).tags);
  });
});
