// src/lib/grammar/translate-format.test.ts
import { describe, expect, it } from "vitest";
import { TRANSLATABLE, validateTranslatedRow } from "./translate-format";

describe("TRANSLATABLE", () => {
  it("covers exactly the nullable *Vi columns of the 6 content tables", () => {
    expect(Object.keys(TRANSLATABLE).sort()).toEqual([
      "GrammarCommonMistake", "GrammarConfusedPair", "GrammarLesson",
      "GrammarPracticeQuestion", "GrammarTestQuestion", "GrammarTopic",
    ]);
    // choices/answer VI are an intentional product decision (EN-only), not a gap:
    expect(TRANSLATABLE.GrammarTestQuestion).toEqual({ questionVi: "questionEn" });
  });
});

describe("validateTranslatedRow", () => {
  const good = { table: "GrammarLesson", id: 5, field: "titleVi", textEn: "x", textVi: "Tiêu đề" };
  it("accepts a filled row", () => {
    expect(validateTranslatedRow(good)).toEqual({
      ok: true,
      row: { table: "GrammarLesson", id: 5, field: "titleVi", textVi: "Tiêu đề" },
    });
  });
  it("rejects unknown table/field, bad id, empty textVi", () => {
    expect(validateTranslatedRow({ ...good, table: "User" }).ok).toBe(false);
    expect(validateTranslatedRow({ ...good, field: "titleEn" }).ok).toBe(false);
    expect(validateTranslatedRow({ ...good, id: "5" }).ok).toBe(false);
    expect(validateTranslatedRow({ ...good, textVi: "  " }).ok).toBe(false);
    expect(validateTranslatedRow(null).ok).toBe(false);
  });
  it("requires entriesVi to be valid [{w,m}] JSON", () => {
    const row = { table: "GrammarConfusedPair", id: 1, field: "entriesVi", textEn: "", textVi: "" };
    expect(validateTranslatedRow({ ...row, textVi: "not json" }).ok).toBe(false);
    expect(validateTranslatedRow({ ...row, textVi: '[{"w":1,"m":"x"}]' }).ok).toBe(false);
    expect(
      validateTranslatedRow({ ...row, textVi: '[{"w":"Một vài","m":"nghĩa","examples":["ví dụ"]}]' }).ok
    ).toBe(true);
  });
});
