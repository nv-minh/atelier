import { describe, it, expect } from "vitest";
import { addUtcDays } from "@/lib/utils";
import { buildRivals, type Rival } from "./rivals";
import { lastActiveAt } from "./activity";

const U = "user_abc";
// 2026-08-13 19:00 UTC = 2026-08-14 02:00 giờ VN — đêm khuya theo đồng hồ VN.
const NIGHT_VN = new Date(Date.UTC(2026, 7, 13, 19));
// 2026-08-13 07:00 UTC = 14:00 giờ VN — giữa chiều.
const AFTERNOON_VN = new Date(Date.UTC(2026, 7, 13, 7));

const USERS = Array.from({ length: 25 }, (_, i) => `user_${i}`);
const hoursAgo = (now: Date, then: Date) => (now.getTime() - then.getTime()) / 3600000;

// Số rival của một user có dấu "hoạt động" mới hơn `maxHours` giờ.
function freshCount(userId: string, now: Date, maxHours: number): number {
  return buildRivals(userId, now).filter((r) => hoursAgo(now, lastActiveAt(r, now)) < maxHours)
    .length;
}

describe("lastActiveAt", () => {
  it("luôn ở quá khứ", () => {
    for (const now of [NIGHT_VN, AFTERNOON_VN]) {
      for (const r of buildRivals(U, now)) {
        expect(lastActiveAt(r, now).getTime()).toBeLessThanOrEqual(now.getTime());
      }
    }
  });

  it("tất định", () => {
    const r = buildRivals(U, AFTERNOON_VN)[0];
    expect(lastActiveAt(r, AFTERNOON_VN).getTime()).toBe(lastActiveAt(r, AFTERNOON_VN).getTime());
  });

  it("2h sáng VN: dưới 25% rival trên toàn bộ 25 user là 'vừa hoạt động'", () => {
    // Luật quan trọng nhất của spec: mở app lúc 2h sáng mà thấy cả bảng vừa học
    // là chỗ user bắt được ngay. Kỳ vọng ~12.5%; ngưỡng 25% cách ~6σ.
    const total = USERS.length * 10;
    const fresh = USERS.reduce((n, u) => n + freshCount(u, NIGHT_VN, 6), 0);
    expect(fresh / total).toBeLessThan(0.25);
  });

  it("2h sáng VN: không user nào có từ 7/10 rival trở lên 'vừa hoạt động'", () => {
    for (const u of USERS) {
      expect(freshCount(u, NIGHT_VN, 6), u).toBeLessThan(7);
    }
  });

  it("không bao giờ cả 10 rival cùng dưới 30 phút", () => {
    for (const now of [NIGHT_VN, AFTERNOON_VN]) {
      for (const u of USERS) {
        expect(freshCount(u, now, 0.5)).toBeLessThan(10);
      }
    }
  });

  it("bảng đêm phải im hơn bảng chiều", () => {
    // Tính chất tương đối, mạnh hơn một ngưỡng tuyệt đối: so tổng trên cùng
    // tập user nên không phụ thuộc phân bố đuôi của một roster đơn lẻ.
    const night = USERS.reduce((n, u) => n + freshCount(u, NIGHT_VN, 6), 0);
    const afternoon = USERS.reduce((n, u) => n + freshCount(u, AFTERNOON_VN, 6), 0);
    expect(night).toBeLessThan(afternoon);
  });

  it("buổi chiều thì bảng có người vừa hoạt động", () => {
    expect(USERS.some((u) => freshCount(u, AFTERNOON_VN, 6) > 0)).toBe(true);
  });

  it("cả 4 ngày walk-back đều là ngày nghỉ → rơi vào nhánh fallback, trả về đúng 4 ngày trước now", () => {
    // restProb: 1 làm cho rng() < restProb luôn đúng — makeRng() không bao giờ
    // trả về đúng 1 (numerator tối đa là 4294967295 / 4294967296 < 1) — nên
    // mọi ngày trong 4 ngày walk-back đều là ngày nghỉ, bất kể id hay ngày cụ
    // thể nào. Nhánh này KHÔNG phải lý thuyết: đo được ở ~1.1% rival trên
    // roster thật (xem comment trong activity.ts).
    const alwaysRests: Rival = {
      id: "r_test_always_rests",
      name: "Test Rival",
      colorClass: "bg-ember/12 text-ember",
      paceFactor: 1,
      peakHourVn: 12,
      regularity: 0.2,
      restProb: 1,
      weekendBias: 0,
      formTrend: 0,
    };
    expect(lastActiveAt(alwaysRests, AFTERNOON_VN).getTime()).toBe(
      addUtcDays(AFTERNOON_VN, -4).getTime()
    );
  });
});
