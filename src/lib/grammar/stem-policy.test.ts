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

  it("keeps a quoted target word verbatim and puts it back when it was translated", () => {
    const en = 'What\'s the plural of "Aircraft"?';
    expect(repairStemVi(en, 'Số nhiều của "Aircraft" là gì?')).toBe('Số nhiều của "Aircraft" là gì?');
    expect(repairStemVi(en, 'Số nhiều của "Máy bay" là gì?')).toBe('Số nhiều của "Aircraft" là gì?');
    expect(repairStemVi('The plural of "military" is:', 'Số nhiều của "quân sự" là:')).toBe('Số nhiều của "military" là:');
  });

  it("restores curly quotes position by position", () => {
    expect(repairStemVi("Choose “mouse” or “mice”", "Chọn “chuột” hoặc “những con chuột”")).toBe("Chọn “mouse” hoặc “mice”");
  });

  it("returns null when the quote count differs, so nothing can be placed safely", () => {
    expect(repairStemVi('What\'s the plural of "mouse" or "louse"?', 'Số nhiều của "chuột" là gì?')).toBeNull();
  });

  it("returns null for a speaker label whose only Vietnamese was inside the quote", () => {
    expect(repairStemVi("Tracy: \"I'm driving to work now\".", 'Tracy: "Bây giờ tôi đang lái xe đi làm".')).toBeNull();
  });
});

describe("checkStemVi", () => {
  it("accepts only stems the policy would leave unchanged", () => {
    const en = "Place the adverb on the correct place in the sentence";
    expect(checkStemVi(en, "Đặt trạng từ vào đúng vị trí trong câu")).toEqual({ ok: true });
    expect(checkStemVi("I have _____ idea.", "Tôi có ý tưởng").ok).toBe(false);
    expect(checkStemVi('What\'s the plural of "Aircraft"?', 'Số nhiều của "Máy bay" là gì?').ok).toBe(false); // repairable, not stored as is
  });
});

describe("review fixes: speech stems, colon agreement, quote safety", () => {
  it("treats a short quoted speech after the colon as the English specimen (backtick quotes, live ids 5803 and 5698)", () => {
    expect(repairStemVi("She asked me: `Who`s there?`.", "Cô ấy hỏi tôi: `` Ai ở đó?`.")).toBe("Cô ấy hỏi tôi: `Who`s there?`.");
    expect(repairStemVi("He said: `I`m here`.", "Anh ấy nói: ``Tôi ở đây`.")).toBe("Anh ấy nói: `I`m here`.");
  });

  it("falls back to English when the only Vietnamese was a speaker label (live id 5542)", () => {
    expect(repairStemVi("Rachel: \"I'm playing the piano now'.", "Rachel: \"Bây giờ tôi đang chơi piano '.")).toBeNull();
  });

  it("returns null when the Vietnamese has a different number of colons (live id 5361 shape)", () => {
    const en = "A store refund may be, for example: a cash refund, a store credit, or a gift card.";
    const vi = "Ví dụ: khoản tiền hoàn lại của cửa hàng có thể là: a cash refund, a store credit, or a gift card.";
    expect(repairStemVi(en, vi)).toBeNull();
    expect(repairStemVi("Rewrite the sentence: He said: go home now please", "Anh ấy nói: về nhà ngay")).toBeNull();
  });

  it("does not swap reordered quoted spans", () => {
    expect(repairStemVi('The plural of "mouse" is "mice"?', '"mice" là số nhiều của "chuột"?')).toBeNull();
  });

  it("compares quoted spans exactly, not as substrings", () => {
    expect(repairStemVi('Choose "a" or "an"', 'Chọn "một" hay "an"')).toBe('Chọn "a" hay "an"');
  });

  it("restores quoted words inside the cue of a hybrid stem", () => {
    expect(repairStemVi('Rewrite with "will": He goes to school every day', 'Viết lại với "sẽ": He goes to school every day')).toBe(
      'Viết lại với "will": He goes to school every day'
    );
  });

  it("is idempotent on every shape above", () => {
    const cases: Array<[string, string]> = [
      ["He said: `I`m here`.", "Anh ấy nói: ``Tôi ở đây`."],
      ['What\'s the plural of "mouse"?', 'Số nhiều của "chuột" là gì?'],
      ["Rewrite the sentence: He said: go home now please", "Viết lại câu: Anh ấy nói: về nhà ngay"],
    ];
    for (const [en, vi] of cases) {
      const once = repairStemVi(en, vi);
      if (once !== null) expect(repairStemVi(en, once)).toBe(once);
    }
  });
});
