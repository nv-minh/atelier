import { describe, it, expect } from "vitest";
import { derivePace } from "./pace";

describe("derivePace — sessionPace", () => {
  it("dùng median, không dùng mean", () => {
    // Một hôm cày 600 XP không được kéo cả bảng lên rồi làm user tụt hạng cả tuần.
    // 7 ngày đều có hoạt động → median của [50,55,57,58,60,62,600] = 58.
    expect(derivePace([50, 60, 55, 600, 58, 62, 57], 60).sessionPace).toBe(58);
  });

  it("median của số ngày chẵn là trung bình hai giá trị giữa", () => {
    // 4 ngày hoạt động → median của [40,50,60,70] = (50+60)/2 = 55.
    expect(derivePace([40, 60, 50, 70], 30).sessionPace).toBe(55);
  });

  it("đếm đúng số ngày có hoạt động", () => {
    const { activeDays, sessionPace } = derivePace([0, 0, 40, 50, 60, 0, 0], 30);
    expect(activeDays).toBe(3);
    expect(sessionPace).toBe(50); // median của [40,50,60], ngày 0 không tham gia
  });

  it("ít hơn PACE_MIN_ACTIVE_DAYS ngày → dùng dailyGoalXp", () => {
    // User mới: median trên 1 ngày không đại diện cho nhịp nào cả.
    expect(derivePace([0, 0, 45, 0, 0, 0, 0], 60).sessionPace).toBe(60);
    expect(derivePace([40, 60], 30).sessionPace).toBe(30); // 2 ngày < 3 → fallback
    expect(derivePace([], 60).sessionPace).toBe(60);
  });

  it("đủ ngày hoạt động thì median thắng dailyGoalXp", () => {
    expect(derivePace([100, 0, 120, 110, 0, 0, 0], 60).sessionPace).toBe(110);
  });

  it("sessionPace không bao giờ âm hay NaN", () => {
    const { sessionPace } = derivePace([0, 0, 0, 0, 0, 0, 0], 0);
    expect(Number.isFinite(sessionPace)).toBe(true);
    expect(sessionPace).toBeGreaterThanOrEqual(0);
  });
});

describe("derivePace — dailyPace (nhịp SẢN LƯỢNG TUẦN dùng để hiệu chuẩn rival)", () => {
  it("7 ngày hoạt động ở mức 60 → sessionPace và dailyPace đều là 60", () => {
    const { sessionPace, dailyPace } = derivePace([60, 60, 60, 60, 60, 60, 60], 60);
    expect(sessionPace).toBe(60);
    expect(dailyPace).toBe(60); // round(60 × 7 / 7)
  });

  it("3 ngày hoạt động ở mức 60 (4 ngày nghỉ) → dailyPace co lại còn 26", () => {
    const { sessionPace, dailyPace } = derivePace([60, 0, 60, 0, 60, 0, 0], 90);
    expect(sessionPace).toBe(60); // median của 3 ngày hoạt động, không đổi
    expect(dailyPace).toBe(26); // round(60 × 3 / 7) = round(25.71...) = 26
  });

  it("dữ liệu quá ít → dailyPace bằng THẲNG dailyGoalXp, không bị chia nhỏ theo activeDays", () => {
    // Đây là lỗi một cài đặt cẩu thả hay mắc: áp công thức round(sessionPace *
    // activeDays / 7) ngay cả trong nhánh fallback. Với 1 ngày hoạt động, công
    // thức đó cho round(60 * 1 / 7) = 9 — gần như miễn phí cho rival — thay vì
    // giữ nguyên dailyGoalXp = 60 mà user đã đặt làm mục tiêu MỖI NGÀY.
    expect(derivePace([], 60).dailyPace).toBe(60); // 0 ngày hoạt động
    expect(derivePace([0, 0, 45, 0, 0, 0, 0], 60).dailyPace).toBe(60); // 1 ngày
    expect(derivePace([0, 0, 45, 0, 0, 0, 0], 60).dailyPace).not.toBe(9);
    expect(derivePace([40, 60], 30).dailyPace).toBe(30); // 2 ngày < 3 → fallback
  });

  it("dailyPace không bao giờ âm hay NaN", () => {
    const { dailyPace } = derivePace([0, 0, 0, 0, 0, 0, 0], 0);
    expect(Number.isFinite(dailyPace)).toBe(true);
    expect(dailyPace).toBeGreaterThanOrEqual(0);
  });
});
