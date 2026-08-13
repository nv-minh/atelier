import { describe, it, expect } from "vitest";
import { derivePace } from "./pace";

describe("derivePace", () => {
  it("dùng median, không dùng mean", () => {
    // Một hôm cày 600 XP không được kéo cả bảng lên rồi làm user tụt hạng cả tuần.
    // 7 ngày đều có hoạt động → median của [50,55,57,58,60,62,600] = 58.
    expect(derivePace([50, 60, 55, 600, 58, 62, 57], 60).pace).toBe(58);
  });

  it("median của số ngày chẵn là trung bình hai giá trị giữa", () => {
    // 4 ngày hoạt động → median của [40,50,60,70] = (50+60)/2 = 55.
    expect(derivePace([40, 60, 50, 70], 30).pace).toBe(55);
  });

  it("đếm đúng số ngày có hoạt động", () => {
    const { activeDays, pace } = derivePace([0, 0, 40, 50, 60, 0, 0], 30);
    expect(activeDays).toBe(3);
    expect(pace).toBe(50); // median của [40,50,60], ngày 0 không tham gia
  });

  it("ít hơn PACE_MIN_ACTIVE_DAYS ngày → dùng dailyGoalXp", () => {
    // User mới: median trên 1 ngày không đại diện cho nhịp nào cả.
    expect(derivePace([0, 0, 45, 0, 0, 0, 0], 60).pace).toBe(60);
    expect(derivePace([40, 60], 30).pace).toBe(30); // 2 ngày < 3 → fallback
    expect(derivePace([], 60).pace).toBe(60);
  });

  it("đủ ngày hoạt động thì median thắng dailyGoalXp", () => {
    expect(derivePace([100, 0, 120, 110, 0, 0, 0], 60).pace).toBe(110);
  });

  it("pace không bao giờ âm hay NaN", () => {
    const { pace } = derivePace([0, 0, 0, 0, 0, 0, 0], 0);
    expect(Number.isFinite(pace)).toBe(true);
    expect(pace).toBeGreaterThanOrEqual(0);
  });
});
