import { describe, expect, it } from "vitest";
import { checkStemVi, quotedSpans, repairStemVi, splitHybridStem } from "./stem-policy";

describe("splitHybridStem", () => {
  it("splits cue and specimen at the first colon (real stem id 1731)", () => {
    expect(
      splitHybridStem("Transfer this Active Voice sentence into the Passive one: Britain kept Napoleon on the island of Saint Helena.")
    ).toEqual({
      cue: "Transfer this Active Voice sentence into the Passive one",
      specimen: "Britain kept Napoleon on the island of Saint Helena.",
    });
  });
  it("keeps a second colon inside the specimen", () => {
    expect(splitHybridStem("Rewrite the sentence: He said: go home now please")).toEqual({
      cue: "Rewrite the sentence",
      specimen: "He said: go home now please",
    });
  });
  it("returns null for a stem without a specimen", () => {
    expect(splitHybridStem("Choose the right answer")).toBeNull();
    expect(splitHybridStem("Note: yes")).toBeNull();
  });
});

describe("quotedSpans", () => {
  it("finds straight and curly quoted words", () => {
    expect(quotedSpans('What\'s the plural of "Aircraft"? Or “deer”?')).toEqual(["Aircraft", "deer"]);
  });
});

describe("repairStemVi", () => {
  it("drops any translation of a fill-in-the-blank stem", () => {
    expect(repairStemVi("There was a woman in the car with two _____.", "Có một người phụ nữ trong xe")).toBeNull();
    expect(repairStemVi("_____", null)).toBeNull();
  });

  it("restores the English specimen of a hybrid stem and keeps the Vietnamese cue (id 1731)", () => {
    expect(
      repairStemVi(
        "Transfer this Active Voice sentence into the Passive one: Britain kept Napoleon on the island of Saint Helena.",
        "Chuyển câu Chủ động này sang câu Bị động: Nước Anh giữ Napoléon trên đảo Saint Helena."
      )
    ).toBe("Chuyển câu Chủ động này sang câu Bị động: Britain kept Napoleon on the island of Saint Helena.");
  });

  it("splits at the first colon only, keeping the whole specimen", () => {
    expect(repairStemVi("Rewrite the sentence: He said: go home now please", "Viết lại câu: Anh ấy nói: về nhà ngay")).toBe(
      "Viết lại câu: He said: go home now please"
    );
  });

  it("returns null for a hybrid stem whose Vietnamese has no usable cue", () => {
    expect(repairStemVi("Rewrite the sentence: He said: go home now please", "Anh ấy nói về nhà ngay")).toBeNull();
    expect(repairStemVi("Rewrite the sentence: He said: go home now please", null)).toBeNull();
  });

  it("keeps an HTML instruction stem intact", () => {
    const en = "<b>Choose the correct answer</b><br>Which sentence is correct?";
    const vi = "<b>Chọn đáp án đúng</b><br>Câu nào đúng?";
    expect(repairStemVi(en, vi)).toBe(vi);
  });

  it("keeps an instruction-only stem (id 418)", () => {
    expect(
      repairStemVi("Place the adverb on the correct place in the sentence", "Đặt trạng từ vào đúng vị trí trong câu")
    ).toBe("Đặt trạng từ vào đúng vị trí trong câu");
  });

  it("keeps a quoted target word verbatim, rejects a translated one", () => {
    const en = 'What\'s the plural of "Aircraft"?';
    expect(repairStemVi(en, 'Số nhiều của "Aircraft" là gì?')).toBe('Số nhiều của "Aircraft" là gì?');
    expect(repairStemVi(en, 'Số nhiều của "Máy bay" là gì?')).toBeNull();
  });
});

describe("checkStemVi", () => {
  it("accepts only stems the policy would leave unchanged", () => {
    const en = "Place the adverb on the correct place in the sentence";
    expect(checkStemVi(en, "Đặt trạng từ vào đúng vị trí trong câu")).toEqual({ ok: true });
    expect(checkStemVi("I have _____ idea.", "Tôi có ý tưởng").ok).toBe(false);
    expect(checkStemVi('What\'s the plural of "Aircraft"?', 'Số nhiều của "Máy bay" là gì?').ok).toBe(false);
  });
});
