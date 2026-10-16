import { describe, expect, it } from "vitest";
import { applyBlockGloss, lessonGlossBlocks } from "./lesson-gloss";

describe("applyBlockGloss", () => {
  it("appends the translation inside the block, after its English text", () => {
    expect(applyBlockGloss("<ul><li>I never drink juice.</li></ul>", { "0": "Tôi không bao giờ uống nước ép." })).toBe(
      '<ul><li>I never drink juice.<span class="gloss"> - Tôi không bao giờ uống nước ép.</span></li></ul>'
    );
  });

  it("numbers blocks like scan(): headings count, only the glossed block changes", () => {
    const html = "<h2>Title</h2><p>He goes home.</p><p>She stays here.</p>";
    expect(applyBlockGloss(html, { "2": "Cô ấy ở lại đây." })).toBe(
      '<h2>Title</h2><p>He goes home.</p><p>She stays here.<span class="gloss"> - Cô ấy ở lại đây.</span></p>'
    );
  });

  it("keeps inline emphasis and protected spans untouched", () => {
    const html = '<p>The sun <span class="infinitive">rise</span><span class="ending">s</span> in the east.</p>';
    expect(applyBlockGloss(html, { "0": "Mặt trời mọc ở phía đông." })).toBe(
      '<p>The sun <span class="infinitive">rise</span><span class="ending">s</span> in the east.<span class="gloss"> - Mặt trời mọc ở phía đông.</span></p>'
    );
  });

  it("escapes markup in a translation", () => {
    expect(applyBlockGloss("<p>a b c</p>", { "0": "x <b> & y" })).toContain("x &lt;b&gt; &amp; y");
  });

  it("returns the html unchanged for an empty or unmatched gloss", () => {
    const html = "<p>He goes home.</p>";
    expect(applyBlockGloss(html, {})).toBe(html);
    expect(applyBlockGloss(html, { "9": "Không có." })).toBe(html);
  });
});

describe("lessonGlossBlocks", () => {
  const en =
    "<h2>Use</h2>" +
    "<ul><li>I never drink orange juice.</li><li>go on</li></ul>" +
    "<table><tr><td>I work</td><td>He works in a bank</td></tr></table>" +
    "<p>The Simple Present is frequently used in English.</p>" +
    "<p><span><em>Everest is the highest mountain.</em></span></p>";
  const vi =
    "<h2>Cách dùng</h2>" +
    "<ul><li>I never drink orange juice.</li><li>go on</li></ul>" +
    "<table><tr><td>I work</td><td>He works in a bank</td></tr></table>" +
    "<p>Simple Present được dùng thường xuyên trong tiếng Anh.</p>" +
    "<p><span><em>Everest is the highest mountain.</em></span></p>";

  it("selects English example sentences and kept-English blocks, not prose or short cells", () => {
    expect(lessonGlossBlocks(en, vi).map((b) => b.text)).toEqual([
      "I never drink orange juice.",
      "He works in a bank",
      "Everest is the highest mountain.",
    ]);
  });

  it("reports the block id used by applyBlockGloss", () => {
    const first = lessonGlossBlocks(en, vi)[0];
    expect(first.blockId).toBe(1);
  });
});

describe("applyBlockGloss placement", () => {
  it("puts the gloss before a nested list, not after it", () => {
    const html = "<ul><li>He goes home every day.<ul><li>Sub item here now.</li></ul></li></ul>";
    expect(applyBlockGloss(html, { "0": "Anh ấy về nhà." })).toBe(
      '<ul><li>He goes home every day.<span class="gloss"> - Anh ấy về nhà.</span><ul><li>Sub item here now.</li></ul></li></ul>'
    );
  });
  it("puts the gloss before trailing <br> tags", () => {
    expect(applyBlockGloss("<p>He goes home every day.<br><br></p>", { "0": "Anh ấy về nhà." })).toBe(
      '<p>He goes home every day.<span class="gloss"> - Anh ấy về nhà.</span><br><br></p>'
    );
  });
  it("keeps a <br> that sits between text", () => {
    expect(applyBlockGloss("<p>He goes.<br>She comes home.</p>", { "0": "Anh đi. Cô đến." })).toBe(
      '<p>He goes.<br>She comes home.<span class="gloss"> - Anh đi. Cô đến.</span></p>'
    );
  });
});
