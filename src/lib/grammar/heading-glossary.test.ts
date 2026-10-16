import { describe, expect, it } from "vitest";
import {
  TENSE_NAMES_VI,
  isSpecimenHeading,
  splitHeadingNumber,
  translateHeadingGlossary,
} from "./heading-glossary";

describe("splitHeadingNumber", () => {
  it("tách số thứ tự đa cấp, kể cả dạng dính '1.What…' và ngoặc vuông", () => {
    expect(splitHeadingNumber("4.1. Affirmative sentences")).toEqual({
      num: "4.1. ",
      body: "Affirmative sentences",
    });
    expect(splitHeadingNumber("1.What are conjunctions?").body).toBe("What are conjunctions?");
    expect(splitHeadingNumber("1] Be").body).toBe("Be");
    expect(splitHeadingNumber("1.1.5. Year").num).toBe("1.1.5. ");
    expect(splitHeadingNumber("Form").num).toBe("");
  });
});

describe("isSpecimenHeading", () => {
  it("công thức và tên modal là chất liệu giữ nguyên", () => {
    expect(isSpecimenHeading("Past → Present")).toBe(true);
    expect(isSpecimenHeading("Gerund + Noun")).toBe(true);
    expect(isSpecimenHeading("something is similar A=B")).toBe(true);
    expect(isSpecimenHeading("10. should")).toBe(true);
    expect(isSpecimenHeading("Will / won´t + have + past participle")).toBe(true);
    expect(isSpecimenHeading("to be (am, are, is)")).toBe(true);
    expect(isSpecimenHeading("1] Be")).toBe(true);
  });

  it("danh sách từ kiểu 'afraid of' là specimen, heading mô tả cách dùng thì KHÔNG", () => {
    expect(isSpecimenHeading("afraid of")).toBe(true);
    expect(isSpecimenHeading("keen on")).toBe(true);
    expect(isSpecimenHeading("in spite of")).toBe(true);
    expect(isSpecimenHeading("Since vs For")).toBe(true);
    expect(isSpecimenHeading("So and Too")).toBe(true);
    expect(isSpecimenHeading("admit")).toBe(true);
    expect(isSpecimenHeading("enjoy")).toBe(true);

    expect(isSpecimenHeading("things in general")).toBe(false);
    expect(isSpecimenHeading("1. repeated actions (every day, always)")).toBe(false);
    expect(isSpecimenHeading("spontaneous actions")).toBe(false);
    expect(isSpecimenHeading("planned actions in the future")).toBe(false);
    expect(isSpecimenHeading("1.5. instructions")).toBe(false); // glossary rescue path
    expect(isSpecimenHeading("Use of the {0}")).toBe(false);
    expect(isSpecimenHeading("4.1. Affirmative sentences in the Simple Present")).toBe(false);
    expect(isSpecimenHeading("after auxiliaries/modals")).toBe(false); // metalanguage → prose
  });

  it("tên thì đứng một mình là prose (dịch qua glossary), không phải specimen", () => {
    expect(isSpecimenHeading("Simple Present")).toBe(false);
    expect(isSpecimenHeading("3.1. Simple Present")).toBe(false);
  });
});

describe("translateHeadingGlossary", () => {
  it("dịch các nhãn mục lặp nhiều lần trong corpus", () => {
    expect(translateHeadingGlossary("Form")).toBe("Cấu trúc");
    expect(translateHeadingGlossary("2. Form")).toBe("2. Cấu trúc");
    expect(translateHeadingGlossary("4. Examples")).toBe("4. Ví dụ");
    expect(translateHeadingGlossary("15. Signal words")).toBe("15. Từ tín hiệu");
    expect(translateHeadingGlossary("Eg.:")).toBe("Ví dụ");
    expect(translateHeadingGlossary("Note:")).toBe("Lưu ý:");
    expect(translateHeadingGlossary("5. Be careful!")).toBe("5. Chú ý!");
    expect(translateHeadingGlossary("1.5. instructions")).toBe("1.5. chỉ dẫn");
  });

  it("template thay tên thì bằng thuật ngữ catalog, giữ placeholder nguyên", () => {
    expect(translateHeadingGlossary("Use of the Simple Present")).toBe("Cách dùng thì hiện tại đơn");
    expect(translateHeadingGlossary("1. Use of the {0}")).toBe("1. Cách dùng thì {0}");
    expect(translateHeadingGlossary("Use of the Past Perfect Continuous")).toBe(
      "Cách dùng thì quá khứ hoàn thành tiếp diễn"
    );
    expect(translateHeadingGlossary("What are signal words for the Simple Present?")).toBe(
      "Từ tín hiệu của thì hiện tại đơn là những từ nào?"
    );
    expect(translateHeadingGlossary("4.1. Affirmative sentences in the Past Perfect")).toBe(
      "4.1. Câu khẳng định trong thì quá khứ hoàn thành"
    );
    expect(translateHeadingGlossary("2. Questions with question words in Simple Present")).toBe(
      "2. Câu hỏi có từ hỏi trong thì hiện tại đơn"
    );
  });

  it("trả null khi không có ý kiến — kể cả template khớp nhưng không ra tiếng Việt", () => {
    expect(translateHeadingGlossary("The comma")).toBeNull();
    expect(translateHeadingGlossary("Use of something the glossary has never seen")).toBeNull();
    expect(translateHeadingGlossary("")).toBeNull();
    expect(TENSE_NAMES_VI["Simple Present"]).toBe("thì hiện tại đơn");
  });
});
