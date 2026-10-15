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
    expect(auditLessonLang(en, vi, PC)).toEqual({ proseGaps: 0, headingGaps: 0, gluedSpans: 0, tagMismatch: false });
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
