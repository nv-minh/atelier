import { describe, it, expect } from "vitest";
import { weekKey, weekIndex, weekDates, isMondayUtc } from "./week";

const utc = (y: number, m: number, d: number, h = 0) => new Date(Date.UTC(y, m - 1, d, h));

describe("weekKey", () => {
  it("mọi ngày trong cùng tuần cho cùng key", () => {
    const mon = weekKey(utc(2026, 8, 10));
    expect(weekKey(utc(2026, 8, 13))).toBe(mon);
    expect(weekKey(utc(2026, 8, 16, 23))).toBe(mon); // Chủ nhật
  });

  it("thứ Hai kế tiếp là key khác", () => {
    expect(weekKey(utc(2026, 8, 17))).not.toBe(weekKey(utc(2026, 8, 16)));
  });

  it("đúng định dạng YYYY-Www", () => {
    expect(weekKey(utc(2026, 8, 13))).toMatch(/^\d{4}-W\d{2}$/);
  });

  it("tuần chứa 4 tháng 1 là tuần 01 (quy tắc ISO)", () => {
    // 2026-01-04 là Chủ nhật → tuần bắt đầu 2025-12-29, và đó là W01 của 2026
    expect(weekKey(utc(2026, 1, 4))).toBe("2026-W01");
    expect(weekKey(utc(2025, 12, 29))).toBe("2026-W01");
  });
});

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
