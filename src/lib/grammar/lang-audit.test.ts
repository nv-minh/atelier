import { describe, expect, it } from "vitest";
import { SEMANTIC_SPAN_CLASSES } from "./semantic-classes";
import { auditLessonLang, auditStem, flagTitleVi } from "./lang-audit";

const PC: ReadonlySet<string> = new Set(SEMANTIC_SPAN_CLASSES);

describe("auditLessonLang", () => {
  const en = "<h2>Use of the Simple Present</h2><p>We use it for habits.</p>";

  it("counts prose and heading blocks still in English", () => {
    const a = auditLessonLang(en, en, PC);
    expect(a.proseGaps).toBe(2);
    expect(a.headingGaps).toBe(1);
    expect(a.tagMismatch).toBe(false);
  });

  it("reports zero gaps for a fully Vietnamese lesson", () => {
    const vi = "<h2>Cách dùng thì hiện tại đơn</h2><p>Dùng cho thói quen.</p>";
    expect(auditLessonLang(en, vi, PC)).toEqual({ proseGaps: 0, headingGaps: 0, gluedSpans: 0, emptiedInline: 0, tagMismatch: false });
  });

  it("counts a Vietnamese word glued to a protected <i>", () => {
    const enI = "<p>We use the <i>Present Continuous</i> here.</p>";
    const vi = "<p>Ta dùng thì<i>Present Continuous</i> ở đây.</p>";
    expect(auditLessonLang(enI, vi, PC).gluedSpans).toBe(1);
  });

  it("flags a tag sequence that differs from the English original", () => {
    expect(auditLessonLang(en, "<p>Xin chào.</p>", PC).tagMismatch).toBe(true);
  });
});

describe("flagTitleVi", () => {
  it("flags a title identical to English", () => {
    expect(flagTitleVi("Simple Present", "simple present")).toBeTruthy();
  });
  it("flags a title with no Vietnamese diacritic", () => {
    expect(flagTitleVi("Present Tense", "Present Tense Form")).toBeTruthy();
  });
  it("accepts a proper Vietnamese title", () => {
    expect(flagTitleVi("Simple Present", "Thì hiện tại đơn")).toBeNull();
  });
  it("treats NULL as a valid fallback", () => {
    expect(flagTitleVi("Simple Present", null)).toBeNull();
  });
});

describe("auditStem (Task 1 branches)", () => {
  it("flags a fill-in-the-blank stem that carries a translation", () => {
    expect(auditStem("There was a woman in the car with two _____.", "Có một người phụ nữ")).toBe("blank-has-vi");
  });
  it("flags a Vietnamese stem without any diacritic", () => {
    expect(auditStem("Place the adverb correctly", "Place the adverb correctly now")).toBe("vi-lacks-diacritic");
  });
  it("accepts a clean instruction stem and a NULL blank stem", () => {
    expect(auditStem("Place the adverb on the correct place in the sentence", "Đặt trạng từ vào đúng vị trí trong câu")).toBe("ok");
    expect(auditStem("I have _____ idea.", null)).toBe("ok");
  });
});

describe("auditLessonLang with deliberate-English keeps", () => {
  it("does not count a block whose English segment is allowlisted", () => {
    const en = "<p>He {0}goes{1} home.</p>".replace("{0}", "<b>").replace("{1}", "</b>");
    const kept = new Set(["He {0}goes{1} home."]);
    expect(auditLessonLang(en, en, PC, kept).proseGaps).toBe(0);
    expect(auditLessonLang(en, en, PC).proseGaps).toBe(1);
  });
});

describe("auditStem policy branches", () => {
  it("flags a hybrid stem whose English sentence was translated", () => {
    expect(
      auditStem(
        "Transfer this Active Voice sentence into the Passive one: Britain kept Napoleon on the island of Saint Helena.",
        "Chuyển câu Chủ động này sang câu Bị động: Nước Anh giữ Napoléon trên đảo Saint Helena."
      )
    ).toBe("specimen-translated");
  });
  it("accepts a hybrid stem whose sentence is verbatim English", () => {
    expect(
      auditStem(
        "Transfer this Active Voice sentence into the Passive one: Britain kept Napoleon on the island of Saint Helena.",
        "Chuyển câu Chủ động này sang câu Bị động: Britain kept Napoleon on the island of Saint Helena."
      )
    ).toBe("ok");
  });
  it("flags a translated quoted word", () => {
    expect(auditStem('What\'s the plural of "Aircraft"?', 'Số nhiều của "Máy bay" là gì?')).toBe("quote-mangled");
  });
});

describe("auditStem independent of the repair policy", () => {
  it("flags a translated quoted sentence even when repairStemVi would accept the stem", () => {
    expect(auditStem('Mia: "Oh no, I\'ve left my tickets at home".', 'Mia: "Ồ không, tôi để quên vé ở nhà rồi".')).toBe("specimen-translated");
  });
});

describe("auditLessonLang emptiedInline", () => {
  it("counts English words that an inline element lost in the Vietnamese body", () => {
    const en = "<p>The verb <b>be</b> is irregular.</p>";
    expect(auditLessonLang(en, "<p><b></b>Động từ này là bất quy tắc.</p>", PC).emptiedInline).toBe(1);
    expect(auditLessonLang(en, "<p>Động từ <b>be</b> là bất quy tắc.</p>", PC).emptiedInline).toBe(0);
  });
});
