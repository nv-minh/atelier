import { describe, it, expect } from "vitest";
import { nextRemindAt, localHourIn, tzOffsetMs } from "./schedule";

const VN = "Asia/Ho_Chi_Minh"; // UTC+7 quanh năm, không DST
const NY = "America/New_York";

describe("tzOffsetMs", () => {
  it("VN luôn +7 giờ, bất kể tháng nào", () => {
    const H = 3_600_000;
    expect(tzOffsetMs(new Date("2026-01-15T00:00:00Z"), VN)).toBe(7 * H);
    expect(tzOffsetMs(new Date("2026-07-15T00:00:00Z"), VN)).toBe(7 * H);
  });

  it("New York đổi giữa -5 và -4 theo DST", () => {
    const H = 3_600_000;
    expect(tzOffsetMs(new Date("2026-01-15T12:00:00Z"), NY)).toBe(-5 * H);
    expect(tzOffsetMs(new Date("2026-07-15T12:00:00Z"), NY)).toBe(-4 * H);
  });
});

describe("nextRemindAt — múi giờ không DST (giá trị chính xác)", () => {
  it("21h giờ VN = 14:00 UTC cùng ngày, khi hiện tại còn sớm hơn", () => {
    const now = new Date("2026-08-13T03:00:00Z"); // 10:00 sáng VN
    expect(nextRemindAt(now, VN, 21).toISOString()).toBe("2026-08-13T14:00:00.000Z");
  });

  it("giờ nhắc đã trôi qua hôm nay → nhảy sang mai, KHÔNG trả về quá khứ", () => {
    const now = new Date("2026-08-13T15:00:00Z"); // 22:00 VN, đã qua 21h
    expect(nextRemindAt(now, VN, 21).toISOString()).toBe("2026-08-14T14:00:00.000Z");
  });

  it("đang đúng ngay giờ nhắc → suất kế tiếp là ngày mai", () => {
    // Nếu trả về chính lúc này, cron vừa gửi xong sẽ thấy nextRemindAt <= now và
    // gửi lần nữa trong cùng phút.
    const now = new Date("2026-08-13T14:00:00Z"); // đúng 21:00 VN
    expect(nextRemindAt(now, VN, 21).toISOString()).toBe("2026-08-14T14:00:00.000Z");
  });

  it("qua giao thừa vẫn đúng", () => {
    const now = new Date("2026-12-31T16:00:00Z"); // 23:00 VN ngày 31/12
    expect(nextRemindAt(now, VN, 21).toISOString()).toBe("2027-01-01T14:00:00.000Z");
  });

  it("nhắc 0h (nửa đêm giờ địa phương) không bị hiểu thành 24h", () => {
    // Intl với hour12:false trả "24" cho nửa đêm ở một số phiên bản ICU.
    const now = new Date("2026-08-13T03:00:00Z"); // 10:00 VN
    const at = nextRemindAt(now, VN, 0);
    expect(localHourIn(at, VN)).toBe(0);
    expect(at.getTime()).toBeGreaterThan(now.getTime());
  });
});

describe("nextRemindAt — DST (kiểm tính chất, không kiểm timestamp cứng)", () => {
  it("luôn ở tương lai và luôn rơi vào đúng giờ địa phương đã chọn", () => {
    const now = new Date("2026-11-01T05:30:00Z");
    const at = nextRemindAt(now, NY, 21);
    expect(at.getTime()).toBeGreaterThan(now.getTime());
    expect(localHourIn(at, NY)).toBe(21);
  });

  it("giờ 02:00 KHÔNG TỒN TẠI ngày spring-forward → trôi tối đa 1 giờ, không nổ", () => {
    // 2026-03-08, New York nhảy từ 01:59 sang 03:00: giờ 2 không có trên đồng hồ.
    // Yêu cầu: không ném lỗi, không trả về quá khứ, và giờ địa phương là 2 hoặc 3.
    const now = new Date("2026-03-08T04:00:00Z"); // 23:00 ngày 7/3 giờ NY
    const at = nextRemindAt(now, NY, 2);
    expect(at.getTime()).toBeGreaterThan(now.getTime());
    expect([2, 3]).toContain(localHourIn(at, NY));
  });

  it("giờ 02:00 XẢY RA HAI LẦN ngày fall-back → chọn một lần, cách nhau 23–25 giờ", () => {
    // 2026-11-01, New York lặp lại giờ 1; quanh mốc đó khoảng cách giữa hai lần
    // nhắc liên tiếp không còn đúng 24 giờ. Điều phải giữ: vẫn đúng giờ địa
    // phương, và không bao giờ ra 0 giờ (gửi trùng) hay 48 giờ (nhảy mất ngày).
    const first = nextRemindAt(new Date("2026-10-31T20:00:00Z"), NY, 2);
    const second = nextRemindAt(new Date(first.getTime() + 60_000), NY, 2);
    const gapH = (second.getTime() - first.getTime()) / 3_600_000;
    expect(gapH).toBeGreaterThanOrEqual(23);
    expect(gapH).toBeLessThanOrEqual(25);
    expect(localHourIn(second, NY)).toBe(2);
  });

  it("tz rác → không nổ, coi như UTC", () => {
    // Giá trị này đến từ trình duyệt; một tz lạ không được làm chết cả cron.
    const now = new Date("2026-08-13T03:00:00Z");
    const at = nextRemindAt(now, "Không/Phải_Múi_Giờ", 21);
    expect(at.toISOString()).toBe("2026-08-13T21:00:00.000Z");
  });
});
