/**
 * input-classes.test.ts — Test thuần cho inputClasses(), phủ 2 dạng theo
 * brief Task 9 (Plan 1 "Atelier v2").
 */
import { describe, it, expect } from "vitest";
import { inputClasses, type InputForm } from "./input-classes";

const FORMS: InputForm[] = ["text", "search"];

describe("inputClasses", () => {
  it("cả 2 dạng đều cao 48px (h-12), nền/viền/bo tròn dùng chung token", () => {
    for (const form of FORMS) {
      const classes = inputClasses(form);
      expect(classes).toContain("h-12");
      expect(classes).toContain("rounded-full");
      expect(classes).toContain("border-hairline/10");
      expect(classes).toContain("bg-surface");
    }
  });

  it("font-size luôn 16px tuyệt đối — dưới ngưỡng này iOS tự zoom khi focus (spec §14.12)", () => {
    for (const form of FORMS) {
      expect(inputClasses(form)).toContain("text-[16px]");
    }
  });

  it("focus dùng --accent theo vai trò màu spec §5.5, không phải --due/ember", () => {
    for (const form of FORMS) {
      expect(inputClasses(form)).toContain("focus:border-accent");
      expect(inputClasses(form)).not.toContain("focus:border-ember");
    }
  });

  it("dạng search có pl-11 chừa chỗ icon kính lúp, dạng text có px-4 đều hai bên", () => {
    expect(inputClasses("search")).toContain("pl-11");
    expect(inputClasses("text")).toContain("px-4");
    expect(inputClasses("text")).not.toContain("pl-11");
  });

  it("mặc định (không truyền form) là text", () => {
    expect(inputClasses()).toBe(inputClasses("text"));
  });
});
