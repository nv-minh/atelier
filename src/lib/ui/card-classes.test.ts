/**
 * card-classes.test.ts — Test thuần cho cardClasses(), phủ 3 biến thể theo
 * brief Task 8 (Plan 1 "Atelier v2").
 */
import { describe, it, expect } from "vitest";
import { cardClasses, type CardVariant } from "./card-classes";

const VARIANTS: CardVariant[] = ["flat", "raised", "interactive"];

describe("cardClasses", () => {
  it("cả 3 biến thể dùng chung rounded-xl, border-hairline/80, bg-surface — mirror của .card-atelier cũ", () => {
    for (const variant of VARIANTS) {
      const classes = cardClasses(variant);
      expect(classes).toContain("rounded-xl");
      expect(classes).toContain("border-hairline/80");
      expect(classes).toContain("bg-surface");
    }
  });

  it("flat dùng shadow-sm, không có hiệu ứng hover/active — 1:1 với .card-atelier cũ", () => {
    const classes = cardClasses("flat");
    expect(classes).toContain("shadow-sm");
    expect(classes).not.toContain("hover:");
    expect(classes).not.toContain("active:");
  });

  it("raised dùng shadow-md (đậm hơn flat), cho thẻ nổi bật đơn lẻ", () => {
    const classes = cardClasses("raised");
    expect(classes).toContain("shadow-md");
    expect(classes).not.toContain("shadow-sm");
  });

  it("interactive có hiệu ứng hover dịch lên + đổi viền sang accent + active scale", () => {
    const classes = cardClasses("interactive");
    expect(classes).toContain("hover:-translate-y-0.5");
    expect(classes).toContain("hover:border-accent/30");
    expect(classes).toContain("active:scale-[.99]");
  });

  it("mặc định (không truyền variant) là flat", () => {
    expect(cardClasses()).toBe(cardClasses("flat"));
  });
});
