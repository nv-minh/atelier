import { describe, it, expect } from "vitest";
import { buildRivals } from "./rivals";
import { rivalDailyXp, dailyXpForAll, rivalWeeklyXp } from "./xp";
import { weekDates } from "./week";
import { WEEKLY_CAP_MULTIPLIER } from "./constants";

const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d));
const U = "user_abc";
const NOW = utc(2026, 8, 13);
const PACE = 60;

describe("rivalDailyXp", () => {
  it("tất định theo (rival, ngày)", () => {
    const r = buildRivals(U, NOW)[0];
    expect(rivalDailyXp(r, "2026-08-11", PACE)).toBe(rivalDailyXp(r, "2026-08-11", PACE));
  });

  it("ngày khác cho giá trị khác (không phải hằng số)", () => {
    const r = buildRivals(U, NOW)[0];
    const vals = weekDates(NOW).map((d) => rivalDailyXp(r, d, PACE));
    expect(new Set(vals).size).toBeGreaterThan(1);
  });

  it("không âm và là số nguyên", () => {
    for (const r of buildRivals(U, NOW)) {
      for (const d of weekDates(NOW)) {
        const v = rivalDailyXp(r, d, PACE);
        expect(Number.isInteger(v)).toBe(true);
        expect(v).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("pace = 0 thì mọi XP = 0", () => {
    for (const r of buildRivals(U, NOW)) {
      expect(rivalDailyXp(r, "2026-08-11", 0)).toBe(0);
    }
  });
});

describe("dailyXpForAll — luật ngày nghỉ", () => {
  it("mỗi ngày có ít nhất một rival XP = 0", () => {
    const rivals = buildRivals(U, NOW);
    for (const d of weekDates(NOW)) {
      const xps = dailyXpForAll(rivals, d, PACE);
      expect(xps.filter((x) => x === 0).length, d).toBeGreaterThanOrEqual(1);
    }
  });

  it("giữ luật đó với 20 user khác nhau và cả tuần", () => {
    for (let i = 0; i < 20; i++) {
      const rivals = buildRivals(`user_${i}`, NOW);
      for (const d of weekDates(NOW)) {
        expect(dailyXpForAll(rivals, d, PACE).some((x) => x === 0), `user_${i} ${d}`).toBe(true);
      }
    }
  });

  it("tất định", () => {
    const rivals = buildRivals(U, NOW);
    expect(dailyXpForAll(rivals, "2026-08-12", PACE)).toEqual(
      dailyXpForAll(rivals, "2026-08-12", PACE)
    );
  });

  it("1(a) pins the tie-break: all restProb=0, zero lands on lowest id", () => {
    const rivals = [
      { id: "r_aaa", name: "A", colorClass: "c1", paceFactor: 1, peakHourVn: 12, regularity: 0.3, restProb: 0, weekendBias: 0, formTrend: 0 },
      { id: "r_bbb", name: "B", colorClass: "c2", paceFactor: 1, peakHourVn: 12, regularity: 0.3, restProb: 0, weekendBias: 0, formTrend: 0 },
      { id: "r_ccc", name: "C", colorClass: "c3", paceFactor: 1, peakHourVn: 12, regularity: 0.3, restProb: 0, weekendBias: 0, formTrend: 0 },
    ];
    const xps = dailyXpForAll(rivals, "2026-08-11", PACE);
    const zeros = xps.filter((x) => x === 0);
    expect(zeros).toHaveLength(1);
    const zeroIdx = xps.indexOf(0);
    expect(rivals[zeroIdx].id).toBe("r_aaa");
  });

  it("1(b) pins restProb ordering: highest restProb forced to rest", () => {
    // 2026-08-10: no rival rests naturally (all rng() >= restProb for this seed)
    const rivals = [
      { id: "r_001", name: "Low", colorClass: "c1", paceFactor: 1, peakHourVn: 12, regularity: 0.3, restProb: 0.001, weekendBias: 0, formTrend: 0 },
      { id: "r_002", name: "Mid", colorClass: "c2", paceFactor: 1, peakHourVn: 12, regularity: 0.3, restProb: 0.002, weekendBias: 0, formTrend: 0 },
      { id: "r_003", name: "High", colorClass: "c3", paceFactor: 1, peakHourVn: 12, regularity: 0.3, restProb: 0.003, weekendBias: 0, formTrend: 0 },
    ];
    const xps = dailyXpForAll(rivals, "2026-08-10", PACE);
    const zeros = xps.filter((x) => x === 0);
    expect(zeros).toHaveLength(1);
    const zeroIdx = xps.indexOf(0);
    expect(rivals[zeroIdx].restProb).toBe(0.003);
  });
});

describe("rivalWeeklyXp", () => {
  it("không rival nào vượt cap 2.2 × pace × 7", () => {
    const cap = WEEKLY_CAP_MULTIPLIER * PACE * 7;
    for (let i = 0; i < 20; i++) {
      const rivals = buildRivals(`user_${i}`, NOW);
      for (const x of rivalWeeklyXp(rivals, weekDates(NOW), PACE)) {
        expect(x).toBeLessThanOrEqual(cap);
      }
    }
  });

  it("không XP tuần nào là số tròn chục", () => {
    for (let i = 0; i < 20; i++) {
      const rivals = buildRivals(`user_${i}`, NOW);
      for (const x of rivalWeeklyXp(rivals, weekDates(NOW), PACE)) {
        if (x > 0) expect(x % 10, `user_${i} → ${x}`).not.toBe(0);
      }
    }
  });

  it("có phân tán thật: mạnh nhất phải hơn yếu nhất rõ rệt", () => {
    const xs = rivalWeeklyXp(buildRivals(U, NOW), weekDates(NOW), PACE);
    expect(Math.max(...xs)).toBeGreaterThan(Math.min(...xs) * 1.3);
  });

  it("tất định", () => {
    const rivals = buildRivals(U, NOW);
    expect(rivalWeeklyXp(rivals, weekDates(NOW), PACE)).toEqual(
      rivalWeeklyXp(rivals, weekDates(NOW), PACE)
    );
  });

  it("Finding 2: returns all non-negative when pace <= 0", () => {
    const rivals = buildRivals(U, NOW);
    const dates = weekDates(NOW);
    for (const pace of [0, -10]) {
      const xps = rivalWeeklyXp(rivals, dates, pace);
      expect(xps).toHaveLength(rivals.length);
      for (const x of xps) {
        expect(Number.isInteger(x)).toBe(true);
        expect(x).toBeGreaterThanOrEqual(0);
      }
    }
  });
});
