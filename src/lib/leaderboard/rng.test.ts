import { describe, it, expect } from "vitest";
import { hashSeed, makeRng, rngFloat, rngInt, rngPick, rngShuffle } from "./rng";

describe("hashSeed", () => {
  it("cùng input → cùng seed", () => {
    expect(hashSeed("user_1", "2026-W33", 0)).toBe(hashSeed("user_1", "2026-W33", 0));
  });

  it("đổi bất kỳ phần nào → seed khác", () => {
    const a = hashSeed("user_1", "2026-W33", 0);
    expect(hashSeed("user_2", "2026-W33", 0)).not.toBe(a);
    expect(hashSeed("user_1", "2026-W34", 0)).not.toBe(a);
    expect(hashSeed("user_1", "2026-W33", 1)).not.toBe(a);
  });

  it("không nhập nhằng khi ghép phần (a|bc vs ab|c)", () => {
    expect(hashSeed("a", "bc")).not.toBe(hashSeed("ab", "c"));
  });

  it("luôn là unsigned 32-bit", () => {
    for (const s of ["", "x", "user_abc", "2026-W01"]) {
      const h = hashSeed(s);
      expect(Number.isInteger(h)).toBe(true);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThan(2 ** 32);
    }
  });
});

describe("makeRng", () => {
  it("cùng seed → cùng dãy", () => {
    const a = makeRng(12345);
    const b = makeRng(12345);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it("seed khác → dãy khác", () => {
    const a = makeRng(1);
    const b = makeRng(2);
    expect(a()).not.toBe(b());
  });

  it("luôn nằm trong [0, 1)", () => {
    const r = makeRng(999);
    for (let i = 0; i < 500; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe("helpers", () => {
  it("rngFloat nằm trong khoảng", () => {
    const r = makeRng(7);
    for (let i = 0; i < 200; i++) {
      const v = rngFloat(r, 0.55, 1.6);
      expect(v).toBeGreaterThanOrEqual(0.55);
      expect(v).toBeLessThan(1.6);
    }
  });

  it("rngInt bao gồm cả hai đầu", () => {
    const r = makeRng(3);
    const seen = new Set<number>();
    for (let i = 0; i < 500; i++) seen.add(rngInt(r, 0, 2));
    expect([...seen].sort()).toEqual([0, 1, 2]);
  });

  it("rngPick trả về phần tử của mảng", () => {
    const r = makeRng(5);
    const arr = ["a", "b", "c"] as const;
    for (let i = 0; i < 50; i++) expect(arr).toContain(rngPick(r, arr));
  });

  it("rngShuffle giữ nguyên phần tử, không sửa mảng gốc", () => {
    const src = [1, 2, 3, 4, 5];
    const out = rngShuffle(makeRng(11), src);
    expect(out).toHaveLength(5);
    expect([...out].sort((x, y) => x - y)).toEqual([1, 2, 3, 4, 5]);
    expect(src).toEqual([1, 2, 3, 4, 5]);
  });

  it("rngShuffle tất định theo seed", () => {
    expect(rngShuffle(makeRng(11), [1, 2, 3, 4, 5])).toEqual(rngShuffle(makeRng(11), [1, 2, 3, 4, 5]));
  });
});
