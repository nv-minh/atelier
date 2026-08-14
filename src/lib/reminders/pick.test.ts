import { describe, it, expect } from "vitest";
import { pickReminder, countDaysInactive, isSaturdayAppDay, type ReminderInput } from "./pick";

const base: ReminderInput = {
  studiedToday: false,
  streak: 0,
  dueCount: 0,
  leechCount: 0,
  daysInactive: 0,
  isSaturday: false,
};

describe("pickReminder — thứ tự ưu tiên", () => {
  it("đứt chuỗi THẮNG đến hạn khi cả hai đều đúng", () => {
    // Mất chuỗi 30 ngày là thiệt hại không lấy lại được; 12 từ đến hạn thì mai ôn
    // vẫn được. Một suất mỗi ngày nên phải chọn cái đắt hơn.
    const r = pickReminder({ ...base, streak: 30, dueCount: 12 });
    expect(r?.kind).toBe("streak-risk");
    expect(r?.n).toBe(30);
  });

  it("không có chuỗi nhưng có từ đến hạn → nhắc đến hạn, mang theo số lượng", () => {
    const r = pickReminder({ ...base, streak: 0, dueCount: 24 });
    expect(r).toEqual({ kind: "due", url: "/study", n: 24 });
  });

  it("leech chỉ bắn thứ Bảy, và chỉ khi tích đủ ngưỡng", () => {
    expect(pickReminder({ ...base, studiedToday: true, leechCount: 9, isSaturday: false })).toBeNull();
    expect(pickReminder({ ...base, studiedToday: true, leechCount: 4, isSaturday: true })).toBeNull();
    const r = pickReminder({ ...base, studiedToday: true, leechCount: 9, isSaturday: true });
    expect(r).toEqual({ kind: "leech", url: "/study/cram?scope=leeches", n: 9 });
  });

  it("win-back CHỈ ở mốc 3, 7, 14 — ngày 4/5/6 im lặng", () => {
    for (const d of [3, 7, 14]) {
      expect(pickReminder({ ...base, daysInactive: d })?.kind).toBe("winback");
    }
    for (const d of [1, 2, 4, 5, 6, 8, 13, 15, 30]) {
      expect(pickReminder({ ...base, daysInactive: d })).toBeNull();
    }
  });

  it("sau ngày 14 thì ngừng hẳn — người rời app 3 tuần thì đó là spam", () => {
    expect(pickReminder({ ...base, daysInactive: 21 })).toBeNull();
    expect(pickReminder({ ...base, daysInactive: 400 })).toBeNull();
  });

  it("win-back xếp SAU đến hạn: vắng 3 ngày mà có từ đến hạn thì nói về từ", () => {
    const r = pickReminder({ ...base, daysInactive: 3, dueCount: 40 });
    expect(r?.kind).toBe("due");
  });
});

describe("pickReminder — im lặng", () => {
  it("đã học hôm nay → null (trừ leech thứ Bảy)", () => {
    // Nhắc tiếp người vừa học xong là hình phạt cho việc xuất hiện.
    expect(pickReminder({ ...base, studiedToday: true, streak: 10, dueCount: 50 })).toBeNull();
    expect(pickReminder({ ...base, studiedToday: true, leechCount: 9, isSaturday: true })?.kind).toBe("leech");
  });

  it("không có gì đáng nói → null, và cron vẫn phải đẩy nextRemindAt sang mai", () => {
    expect(pickReminder(base)).toBeNull();
  });

  it("chưa học, không chuỗi, không từ đến hạn, chưa vắng đủ → null", () => {
    expect(pickReminder({ ...base, daysInactive: 1 })).toBeNull();
  });
});

describe("countDaysInactive", () => {
  it("có hoạt động hôm nay → 0", () => {
    expect(countDaysInactive(["2026-08-13", "2026-08-12"], "2026-08-13")).toBe(0);
  });

  it("hoạt động gần nhất là hôm qua → 1", () => {
    expect(countDaysInactive(["2026-08-12"], "2026-08-13")).toBe(1);
  });

  it("đếm đúng qua mốc tháng", () => {
    expect(countDaysInactive(["2026-07-29"], "2026-08-01")).toBe(3);
  });

  it("chưa từng học → trả 0, KHÔNG phải vô cực", () => {
    // User mới toanh không phải người "bỏ app": trả 0 để win-back không bắn ngay
    // ngày đăng ký.
    expect(countDaysInactive([], "2026-08-13")).toBe(0);
  });

  it("bỏ qua ngày trong tương lai (lệch đồng hồ) thay vì ra số âm", () => {
    expect(countDaysInactive(["2026-08-20"], "2026-08-13")).toBe(0);
  });
});

describe("isSaturdayAppDay — ghim mốc ngày UTC của app (§4 của spec)", () => {
  it("thứ Bảy tính theo app-day (UTC), KHÔNG theo đồng hồ người dùng", () => {
    // 2026-08-15 là thứ Bảy. App đổi ngày lúc 00:00 UTC = 07:00 giờ VN, nên
    // 23:00 UTC thứ Bảy vẫn là thứ Bảy dù ở VN đã 06:00 sáng Chủ nhật.
    expect(isSaturdayAppDay(new Date("2026-08-15T00:00:00Z"))).toBe(true);
    expect(isSaturdayAppDay(new Date("2026-08-15T23:59:59Z"))).toBe(true);
    expect(isSaturdayAppDay(new Date("2026-08-16T00:00:00Z"))).toBe(false);
  });

  it("KHÔNG dùng giờ địa phương của máy chạy code", () => {
    // Nếu ai đó đổi sang getDay() (giờ local) thì test này đổ trên máy lệch múi:
    // 2026-08-14T23:00Z là thứ Sáu theo UTC nhưng đã là thứ Bảy ở VN.
    expect(isSaturdayAppDay(new Date("2026-08-14T23:00:00Z"))).toBe(false);
  });
});
