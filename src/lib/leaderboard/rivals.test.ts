import { describe, it, expect } from "vitest";
import { buildRivals } from "./rivals";
import { PERSONA_NAMES, AVATAR_COLORS } from "./personas";
import {
  RIVAL_COUNT, PACE_FACTOR_MIN, PACE_FACTOR_MAX,
  REST_PROB_MIN, REST_PROB_MAX,
} from "./constants";

const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d));
const U = "user_abc";

describe("pool persona", () => {
  it("có đúng 60 tên, không trùng", () => {
    expect(PERSONA_NAMES).toHaveLength(60);
    expect(new Set(PERSONA_NAMES).size).toBe(60);
  });

  it("không có tên chứa ký tự ngoài chữ Việt và khoảng trắng", () => {
    for (const n of PERSONA_NAMES) expect(n).toMatch(/^[\p{L}]+( [\p{L}]+)+$/u);
  });

  it("bảng màu không rỗng", () => {
    expect(AVATAR_COLORS.length).toBeGreaterThan(2);
  });
});

describe("buildRivals", () => {
  it("trả về đúng RIVAL_COUNT rival, tên không trùng trong tuần", () => {
    const rivals = buildRivals(U, utc(2026, 8, 13));
    expect(rivals).toHaveLength(RIVAL_COUNT);
    expect(new Set(rivals.map((r) => r.name)).size).toBe(RIVAL_COUNT);
  });

  it("tất định: cùng user + cùng tuần → cùng roster", () => {
    expect(buildRivals(U, utc(2026, 8, 13))).toEqual(buildRivals(U, utc(2026, 8, 16)));
  });

  it("user khác → roster khác", () => {
    const a = buildRivals(U, utc(2026, 8, 13)).map((r) => r.name);
    const b = buildRivals("user_xyz", utc(2026, 8, 13)).map((r) => r.name);
    expect(a).not.toEqual(b);
  });

  it("giữ lại 4–5 rival của tuần trước", () => {
    const thisWeek = new Set(buildRivals(U, utc(2026, 8, 13)).map((r) => r.name));
    const lastWeek = buildRivals(U, utc(2026, 8, 6)).map((r) => r.name);
    const kept = lastWeek.filter((n) => thisWeek.has(n)).length;
    expect(kept).toBeGreaterThanOrEqual(4);
    expect(kept).toBeLessThanOrEqual(5);
  });

  it("giữ 4–5 rival ở mọi tuần liên tiếp trong 30 tuần", () => {
    for (let w = 0; w < 30; w++) {
      const prev = buildRivals(U, utc(2026, 1, 5 + w * 7)).map((r) => r.name);
      const cur = new Set(buildRivals(U, utc(2026, 1, 12 + w * 7)).map((r) => r.name));
      const kept = prev.filter((n) => cur.has(n)).length;
      expect(kept, `tuần ${w}`).toBeGreaterThanOrEqual(4);
      expect(kept, `tuần ${w}`).toBeLessThanOrEqual(5);
    }
  });

  it("id ổn định theo người: cùng tên → cùng id qua các tuần", () => {
    const a = buildRivals(U, utc(2026, 8, 6));
    const b = buildRivals(U, utc(2026, 8, 13));
    for (const r of a) {
      const same = b.find((x) => x.name === r.name);
      if (same) expect(same.id).toBe(r.id);
    }
  });

  it("mọi tham số nằm trong khoảng đã định", () => {
    const rivals = buildRivals(U, utc(2026, 8, 13));
    for (const r of rivals) {
      expect(r.paceFactor).toBeGreaterThanOrEqual(PACE_FACTOR_MIN);
      expect(r.paceFactor).toBeLessThan(PACE_FACTOR_MAX);
      expect(r.restProb).toBeGreaterThanOrEqual(REST_PROB_MIN);
      expect(r.restProb).toBeLessThan(REST_PROB_MAX);
      expect(r.peakHourVn).toBeGreaterThanOrEqual(0);
      expect(r.peakHourVn).toBeLessThanOrEqual(23);
      expect(AVATAR_COLORS).toContain(r.colorClass);
    }
  });

  it("tính cách của rival được giữ lại là bất biến qua các tuần", () => {
    // Finding 1 của review: peakHourVn từng đổi giữa các tuần vì quota cũ quyết
    // định theo vị trí trong roster của tuần đó. Giờ mọi tham số chỉ phụ thuộc
    // (userId, name), nên rival được giữ lại phải giống hệt — trừ formTrend.
    const a = buildRivals(U, utc(2026, 8, 6));
    const b = buildRivals(U, utc(2026, 8, 13));
    let compared = 0;
    for (const r of a) {
      const same = b.find((x) => x.name === r.name);
      if (!same) continue;
      compared++;
      expect(same.id).toBe(r.id);
      expect(same.peakHourVn).toBe(r.peakHourVn);
      expect(same.paceFactor).toBe(r.paceFactor);
      expect(same.regularity).toBe(r.regularity);
      expect(same.restProb).toBe(r.restProb);
      expect(same.weekendBias).toBe(r.weekendBias);
      expect(same.colorClass).toBe(r.colorClass);
    }
    expect(compared).toBeGreaterThanOrEqual(4); // carryover thật, không phải vòng lặp rỗng
  });
});
