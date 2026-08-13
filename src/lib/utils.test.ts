import { describe, it, expect } from "vitest";
import { addUtcDays, isoWeekMonday, todayStr } from "./utils";

describe("addUtcDays", () => {
  it("cộng đúng số ngày trên trục UTC", () => {
    const base = new Date(Date.UTC(2026, 7, 13)); // thứ Năm 2026-08-13
    expect(todayStr(addUtcDays(base, 3))).toBe("2026-08-16");
    expect(todayStr(addUtcDays(base, -13))).toBe("2026-07-31");
  });

  it("giữ nguyên nửa đêm UTC, không bị giờ địa phương kéo lệch", () => {
    const base = new Date(Date.UTC(2026, 7, 13));
    const out = addUtcDays(base, 1);
    expect(out.getUTCHours()).toBe(0);
    expect(out.getUTCMinutes()).toBe(0);
  });
});

describe("isoWeekMonday", () => {
  it("trả về thứ Hai của tuần chứa ngày đó", () => {
    // 2026-08-13 là thứ Năm; thứ Hai cùng tuần là 2026-08-10
    expect(todayStr(isoWeekMonday(new Date(Date.UTC(2026, 7, 13))))).toBe("2026-08-10");
  });

  it("thứ Hai trả về chính nó", () => {
    expect(todayStr(isoWeekMonday(new Date(Date.UTC(2026, 7, 10))))).toBe("2026-08-10");
  });

  it("Chủ nhật thuộc tuần đang chạy, không phải tuần sau", () => {
    // 2026-08-16 là Chủ nhật → vẫn thuộc tuần bắt đầu 2026-08-10
    expect(todayStr(isoWeekMonday(new Date(Date.UTC(2026, 7, 16))))).toBe("2026-08-10");
  });

  it("luôn là nửa đêm UTC", () => {
    const m = isoWeekMonday(new Date(Date.UTC(2026, 7, 13, 23, 59)));
    expect(m.getUTCHours()).toBe(0);
    expect(m.getUTCDay()).toBe(1);
  });
});
