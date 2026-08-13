import { describe, it, expect } from "vitest";
import { weekIndex, weekDates, isMondayUtc } from "./week";

const utc = (y: number, m: number, d: number, h = 0) => new Date(Date.UTC(y, m - 1, d, h));

describe("weekIndex", () => {
  it("tăng đúng 1 mỗi tuần", () => {
    const a = weekIndex(utc(2026, 8, 13));
    expect(weekIndex(utc(2026, 8, 20))).toBe(a + 1);
    expect(weekIndex(utc(2026, 8, 6))).toBe(a - 1);
  });

  it("không đổi trong cùng tuần", () => {
    const a = weekIndex(utc(2026, 8, 10));
    expect(weekIndex(utc(2026, 8, 16, 23))).toBe(a);
  });
});

describe("weekDates", () => {
  it("7 ngày từ thứ Hai đến Chủ nhật", () => {
    expect(weekDates(utc(2026, 8, 13))).toEqual([
      "2026-08-10", "2026-08-11", "2026-08-12", "2026-08-13",
      "2026-08-14", "2026-08-15", "2026-08-16",
    ]);
  });

  it("Chủ nhật vẫn trả về tuần đang chạy", () => {
    expect(weekDates(utc(2026, 8, 16))[0]).toBe("2026-08-10");
  });
});

describe("isMondayUtc", () => {
  it("nhận đúng thứ Hai theo UTC", () => {
    expect(isMondayUtc(utc(2026, 8, 10, 12))).toBe(true);
    expect(isMondayUtc(utc(2026, 8, 11))).toBe(false);
  });

  it("23:00 UTC Chủ nhật chưa phải thứ Hai (dù giờ VN đã sang)", () => {
    // 2026-08-16 23:00 UTC = 2026-08-17 06:00 giờ VN, nhưng app tính theo UTC
    expect(isMondayUtc(utc(2026, 8, 16, 23))).toBe(false);
  });
});
