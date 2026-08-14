import { describe, expect, it } from "vitest";
import { normalizeChoices, parseCsvRecords, splitMeaningExamples, viOrNull } from "./clean";

describe("parseCsvRecords", () => {
  it("handles BOM, quoted multiline fields and embedded quotes", () => {
    const raw = '﻿"id","body"\n"1","line1\nline2 said ""hi"""\n';
    expect(parseCsvRecords(raw)).toEqual([{ id: "1", body: 'line1\nline2 said "hi"' }]);
  });
});

describe("normalizeChoices", () => {
  it("splits ##-cells, converts 1-based answer to 0-based", () => {
    expect(normalizeChoices("is ## are ## has".split("##"), "1")).toEqual({
      choices: ["is", "are", "has"],
      answerIndex: 0,
    });
  });
  it("keeps the answer aligned when empty cells are dropped", () => {
    // tests.csv row with only a/b/d filled, answer_index=4 (→ "d")
    expect(normalizeChoices(["man", "men", "", "mice"], "4")).toEqual({
      choices: ["man", "men", "mice"],
      answerIndex: 2,
    });
  });
  it("rejects out-of-range, empty-answer-cell and <2 choices", () => {
    expect(normalizeChoices(["a", "b"], "3")).toBeNull();
    expect(normalizeChoices(["a", "", "c"], "2")).toBeNull();
    expect(normalizeChoices(["only", ""], "1")).toBeNull();
    expect(normalizeChoices(["a", "b"], "x")).toBeNull();
  });
});

describe("viOrNull", () => {
  it("nulls empty and whitespace-only", () => {
    expect(viOrNull("", "text")).toBeNull();
    expect(viOrNull("   ", "text")).toBeNull();
    expect(viOrNull(undefined, "text")).toBeNull();
  });
  it("nulls VI identical to EN (machine translation skipped the string)", () => {
    expect(viOrNull("The  Girl", "the girl")).toBeNull();
  });
  it("keeps a real translation", () => {
    expect(viOrNull("danh từ", "Nouns")).toBe("danh từ");
  });
});

describe("splitMeaningExamples", () => {
  it("splits #-prefixed lines out of a confused-word meaning", () => {
    const m = '"A few" is a phrase meaning not many.\n# Hurry up if you want yellow.';
    expect(splitMeaningExamples(m)).toEqual({
      meaning: '"A few" is a phrase meaning not many.',
      examples: ["Hurry up if you want yellow."],
    });
  });
  it("returns no examples when there is no # line", () => {
    expect(splitMeaningExamples("Just a meaning.")).toEqual({ meaning: "Just a meaning.", examples: [] });
  });
});
