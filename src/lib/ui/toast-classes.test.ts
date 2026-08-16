/**
 * toast-classes.test.ts — Test thuần cho toastFormClasses(), phủ 3 dạng theo
 * brief Task 9 (Plan 1 "Atelier v2").
 */
import { describe, it, expect } from "vitest";
import { toastFormClasses, type ToastForm } from "./toast-classes";

const FORMS: ToastForm[] = ["info", "success", "error"];

// Token bắt buộc mỗi dạng phải có, đúng vai trò màu §5.5.
const EXPECTED: Record<ToastForm, { border: string; iconWrap: string; label: string }> = {
  info: { border: "border-accent/30", iconWrap: "bg-accent/12 text-accent", label: "text-accent" },
  success: { border: "border-correct/30", iconWrap: "bg-correct/12 text-correct", label: "text-correct" },
  error: { border: "border-wrong/30", iconWrap: "bg-wrong/12 text-wrong", label: "text-wrong" },
};

describe("toastFormClasses", () => {
  for (const form of FORMS) {
    it(`${form} — đúng token màu theo vai trò spec §5.5`, () => {
      const classes = toastFormClasses(form);
      expect(classes.border).toBe(EXPECTED[form].border);
      expect(classes.iconWrap).toBe(EXPECTED[form].iconWrap);
      expect(classes.label).toBe(EXPECTED[form].label);
    });
  }

  it("3 dạng không trùng token màu nhãn với nhau", () => {
    const all = FORMS.map((f) => toastFormClasses(f).label);
    expect(new Set(all).size).toBe(FORMS.length);
  });

  it("mặc định (không truyền form) là info", () => {
    expect(toastFormClasses()).toEqual(toastFormClasses("info"));
  });
});
