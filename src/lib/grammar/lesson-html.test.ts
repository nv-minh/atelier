import { describe, expect, it } from "vitest";
import { cleanLessonHtml, LESSON_IMAGE_PREFIX } from "./lesson-html";

const IMGS = new Set(["tenses.png", "simple_past1e.png"]);

describe("cleanLessonHtml", () => {
  it("rewrites android_asset image paths", () => {
    const { html, missingImages } = cleanLessonHtml(
      '<p><img src="file:///android_asset/images/tenses.png" alt="t"></p>',
      IMGS
    );
    expect(html).toContain(`src="${LESSON_IMAGE_PREFIX}tenses.png"`);
    expect(missingImages).toEqual([]);
  });
  it("drops <img> whose file was never extracted and reports it", () => {
    const { html, missingImages } = cleanLessonHtml(
      '<p>x<img src="file:///android_asset/images/ae.svg">y</p>',
      IMGS
    );
    expect(html).not.toContain("<img");
    expect(html).toContain("xy");
    expect(missingImages).toEqual(["ae.svg"]);
  });
  it("keeps semantic span classes, strips junk classes", () => {
    const { html } = cleanLessonHtml(
      '<p><span class="verb">go</span><span class="wp-block-group has-vivid-cyan-blue-color">junk</span></p>',
      IMGS
    );
    expect(html).toContain('<span class="verb">go</span>');
    expect(html).toContain("<span>junk</span>");
  });
  it("removes script/style WITH their contents, unwraps font/div/center", () => {
    const { html } = cleanLessonHtml(
      "<div><script>alert(1)</script><style>.x{}</style><font color=\"red\">text</font><center>mid</center></div>",
      IMGS
    );
    expect(html).not.toContain("alert");
    expect(html).not.toContain(".x{}");
    expect(html).not.toContain("<font");
    expect(html).toContain("text");
    expect(html).toContain("mid");
  });
  it("keeps tables and their colspan", () => {
    const { html } = cleanLessonHtml(
      '<table><thead><tr><th colspan="2">h</th></tr></thead><tbody><tr><td>a</td><td>b</td></tr></tbody></table>',
      IMGS
    );
    expect(html).toContain('colspan="2"');
    expect(html).toContain("<tbody>");
  });
  it("drops xmp content entirely (raw-text XSS vector)", () => {
    const { html } = cleanLessonHtml("<p>a<xmp><img src=x onerror=alert(1)></xmp>b</p>", IMGS);
    expect(html).not.toContain("alert");
    expect(html).not.toContain("onerror");
    expect(html).toContain("a");
    expect(html).toContain("b");
  });
});
