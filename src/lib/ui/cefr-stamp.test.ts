/**
 * cefr-stamp.test.ts — Test thuần cho cefrStampClasses(), phủ đủ 5 mức CEFR
 * theo brief Task 7 (Plan 1 "Atelier v2").
 *
 * Lệch một chỗ so với công thức chữ trong brief: A1/A2/B1 dùng
 * `text-fg-on-tint` chứ không phải `text-cefr-a1/a2/b1` như bảng công thức
 * gốc — đã đo tương phản WCAG thật (xem cefr-stamp.ts và task-7-report.md),
 * ba mức đó dưới 4.5:1 trên nền trang ở theme sáng nếu dùng màu chữ thô. Test
 * này khẳng định đúng bản đã sửa, không phải bảng công thức gốc.
 */
import { describe, it, expect } from "vitest";
import { cefrStampClasses } from "./cefr-stamp";

describe("cefrStampClasses", () => {
  it("A1/A2 không có nền (bg-cefr-*) — chỉ viền", () => {
    expect(cefrStampClasses("A1")).not.toMatch(/bg-cefr-/);
    expect(cefrStampClasses("A2")).not.toMatch(/bg-cefr-/);
  });

  it("B1/B2/C1 có nền (bg-cefr-*)", () => {
    expect(cefrStampClasses("B1")).toMatch(/bg-cefr-b1/);
    expect(cefrStampClasses("B2")).toMatch(/bg-cefr-b2/);
    expect(cefrStampClasses("C1")).toMatch(/bg-cefr-c1/);
  });

  it("A1 viền mờ (40% opacity), A2 viền rõ (100%, không có /N)", () => {
    expect(cefrStampClasses("A1")).toContain("border-cefr-a1/40");
    expect(cefrStampClasses("A2")).toContain("border-cefr-a2");
    expect(cefrStampClasses("A2")).not.toContain("border-cefr-a2/");
  });

  it("B2 nền đậm hơn B1 (90% so với 10%), C1 mực đặc (100%, không có /N)", () => {
    // 90%, không phải 70% như spec gốc: đo lại contrast WCAG, chữ trắng trên
    // bg-cefr-b2/70 chỉ 3.43–3.52:1 ở theme sáng (dưới AA 4.5:1); 90% đưa
    // cả nền canvas lẫn surface về ≥5.1:1, dark mode vẫn dư dả (8.8–9.2:1).
    expect(cefrStampClasses("B1")).toContain("bg-cefr-b1/10");
    expect(cefrStampClasses("B2")).toContain("bg-cefr-b2/90");
    expect(cefrStampClasses("C1")).toContain("bg-cefr-c1");
    expect(cefrStampClasses("C1")).not.toContain("bg-cefr-c1/");
  });

  it("C1 (và B2) dùng text-fg-on-accent (chữ trắng) vì nền đã đặc/gần đặc", () => {
    expect(cefrStampClasses("B2")).toContain("text-fg-on-accent");
    expect(cefrStampClasses("C1")).toContain("text-fg-on-accent");
  });

  it("A1/A2/B1 dùng text-fg-on-tint (chữ có màu, đã đo đủ tương phản) — không phải text-cefr-*", () => {
    for (const level of ["A1", "A2", "B1"]) {
      const classes = cefrStampClasses(level);
      expect(classes).toContain("text-fg-on-tint");
      expect(classes).not.toMatch(/text-cefr-/);
    }
  });

  it("B2/C1 không dùng text-cefr-* (đã chuyển hẳn sang chữ trắng trên nền đặc)", () => {
    expect(cefrStampClasses("B2")).not.toMatch(/text-cefr-/);
    expect(cefrStampClasses("C1")).not.toMatch(/text-cefr-/);
  });

  it("cả 5 mức dùng chung font-mono text-2xs uppercase, không tự thêm tracking-*", () => {
    for (const level of ["A1", "A2", "B1", "B2", "C1"]) {
      const classes = cefrStampClasses(level);
      expect(classes).toContain("font-mono");
      expect(classes).toContain("text-2xs");
      expect(classes).toContain("uppercase");
      expect(classes).not.toMatch(/tracking-/);
    }
  });

  it("cả 5 mức cao 20px (h-5), bo rounded-pill, padding ngang px-2", () => {
    for (const level of ["A1", "A2", "B1", "B2", "C1"]) {
      const classes = cefrStampClasses(level);
      expect(classes).toContain("h-5");
      expect(classes).toContain("rounded-pill");
      expect(classes).toContain("px-2");
    }
  });

  it("mức lạ (không thuộc CEFR_LEVELS) không throw, trả về chip trung tính", () => {
    expect(() => cefrStampClasses("XX")).not.toThrow();
    const classes = cefrStampClasses("XX");
    expect(classes).toContain("text-fg-muted");
    expect(classes).not.toMatch(/bg-cefr-|text-cefr-|border-cefr-/);
  });
});
