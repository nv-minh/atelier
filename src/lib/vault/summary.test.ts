import { describe, it, expect } from "vitest";
import { shapeSummary } from "./summary";

describe("shapeSummary", () => {
  it("learning gộp state 0 và 1 — khớp learningCards + newCardsSeen của /stats", () => {
    const s = shapeSummary({
      cardStates: [
        { state: 0, count: 12 },
        { state: 1, count: 30 },
        { state: 2, count: 1200 },
        { state: 3, count: 4 },
      ],
      knownCount: 87,
      bandLevel: "B1",
      bandTotal: 1500,
      bandLearned: 400,
    });
    expect(s.learning).toBe(42); // 12 + 30
    expect(s.learned).toBe(1204); // 1200 + 4
    expect(s.seen).toBe(1246); // mọi card, bất kể state
    expect(s.known).toBe(87);
  });

  it("user chưa có card nào → mọi số là 0, không NaN", () => {
    const s = shapeSummary({ cardStates: [], knownCount: 0, bandLevel: null });
    expect(s).toMatchObject({ seen: 0, learned: 0, learning: 0, known: 0 });
    expect(s.band).toBeNull();
  });

  it("không có LearnerProfile → band null, dải không vẽ thanh tiến độ", () => {
    const s = shapeSummary({
      cardStates: [{ state: 2, count: 3 }], knownCount: 0, bandLevel: null,
    });
    expect(s.band).toBeNull();
  });

  it("band có nhưng bậc đó chưa có từ nào trong DB → total 0, KHÔNG chia cho 0", () => {
    const s = shapeSummary({
      cardStates: [], knownCount: 0,
      bandLevel: "C1", bandTotal: 0, bandLearned: 0,
    });
    expect(s.band).toEqual({ level: "C1", learned: 0, total: 0 });
  });

  it("state lạ trong DB không làm hỏng phép đếm", () => {
    // Phòng xa: state ngoài 0..3 (dữ liệu cũ/hỏng) chỉ tính vào seen.
    const s = shapeSummary({
      cardStates: [{ state: 9, count: 2 }], knownCount: 0, bandLevel: null,
    });
    expect(s.seen).toBe(2);
    expect(s.learned).toBe(0);
    expect(s.learning).toBe(0);
  });
});
