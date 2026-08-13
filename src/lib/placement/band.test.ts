import { describe, it, expect } from "vitest";
import { bandToCefr } from "./estimate";

describe("bandToCefr", () => {
  it("band nguyên → đúng bậc: 0=A1 … 4=C1", () => {
    expect(bandToCefr(0)).toBe("A1");
    expect(bandToCefr(2)).toBe("B1");
    expect(bandToCefr(4)).toBe("C1");
  });

  it("band lẻ được làm tròn (band là float để trôi nửa bậc)", () => {
    expect(bandToCefr(2.4)).toBe("B1");
    expect(bandToCefr(2.6)).toBe("B2");
  });

  it("kẹp hai đầu, không bao giờ trả undefined", () => {
    // Bốn chỗ chép inline đều tự kẹp bằng Math.min/Math.max; gom lại một chỗ
    // để không có chỗ thứ năm quên kẹp rồi render "undefined".
    expect(bandToCefr(-3)).toBe("A1");
    expect(bandToCefr(99)).toBe("C1");
    expect(bandToCefr(Number.NaN)).toBe("A1");
  });
});
