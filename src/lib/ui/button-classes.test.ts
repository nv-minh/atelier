/**
 * button-classes.test.ts — Test thuần cho buttonClasses()/buttonVariantClasses(),
 * phủ ma trận 4 biến thể × 3 cỡ theo brief Task 6 (Plan 1 "Atelier v2").
 *
 * Khẳng định từng mảnh token (không snapshot toàn chuỗi) để khi hỏng, lỗi báo
 * rõ đúng token nào bị thiếu thay vì "chuỗi khác nhau ở đâu đó".
 */
import { describe, it, expect } from "vitest";
import {
  buttonClasses,
  buttonVariantClasses,
  type ButtonVariant,
  type ButtonSize,
} from "./button-classes";

const VARIANTS: ButtonVariant[] = ["primary", "secondary", "ghost", "danger"];
const SIZES: ButtonSize[] = ["sm", "md", "lg"];

// Token bắt buộc phải có trong mỗi biến thể, đúng vai trò màu ở spec §5.5.
const VARIANT_TOKENS: Record<ButtonVariant, string[]> = {
  primary: ["bg-accent", "text-fg-on-accent", "shadow-accent", "hover:bg-accent-hover", "active:bg-accent-active"],
  secondary: ["border-hairline", "bg-surface", "text-fg", "hover:bg-sunken"],
  ghost: ["text-fg-muted", "hover:bg-sunken", "hover:text-fg"],
  danger: ["bg-wrong", "text-white"],
};

const SIZE_TOKENS: Record<ButtonSize, string> = {
  sm: "h-10",
  md: "h-12",
  lg: "h-14",
};

describe("buttonClasses", () => {
  for (const variant of VARIANTS) {
    for (const size of SIZES) {
      it(`${variant} × ${size} — có đủ token biến thể, cỡ và lớp chung`, () => {
        const classes = buttonClasses(variant, size);

        for (const token of VARIANT_TOKENS[variant]) {
          expect(classes).toContain(token);
        }
        expect(classes).toContain(SIZE_TOKENS[size]);

        // Lớp chung mọi tổ hợp — spec §2.2 (bo tròn hoàn toàn) + kit chuyển động.
        expect(classes).toContain("rounded-full");
        expect(classes).toContain("inline-flex");
        expect(classes).toContain("duration-instant");
        expect(classes).toContain("active:scale-[.97]");
        expect(classes).toContain("disabled:opacity-50");
        expect(classes).toContain("disabled:pointer-events-none");
      });
    }
  }

  it("buttonVariantClasses trả về đúng token màu, không kèm cỡ/lớp base — IconButton dùng chung", () => {
    for (const variant of VARIANTS) {
      const classes = buttonVariantClasses(variant);
      for (const token of VARIANT_TOKENS[variant]) {
        expect(classes).toContain(token);
      }
      expect(classes).not.toContain("h-10");
      expect(classes).not.toContain("rounded-full");
    }
  });
});
