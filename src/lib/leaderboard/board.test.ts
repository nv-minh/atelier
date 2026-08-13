import { describe, it, expect } from "vitest";
import { buildBoard } from "./board";
import { RIVAL_COUNT, WEEKLY_CAP_MULTIPLIER } from "./constants";

const utc = (y: number, m: number, d: number, h = 12) => new Date(Date.UTC(y, m - 1, d, h));
// 2026-08-13 là thứ Năm (giữa tuần); 2026-08-10 là thứ Hai; 2026-08-16 là Chủ Nhật.
// Cả ba đều nằm trong cùng một tuần ISO.
const THU = utc(2026, 8, 13);
const MON = utc(2026, 8, 10);
const SUN = utc(2026, 8, 16);
const PACE = 60;

const base = {
  userId: "user_abc",
  userName: "Minh",
  userStreak: 12,
  pace: PACE,
  now: THU,
  // Giữa tuần: 3 ngày đã qua tính đến hôm qua (Mon–Wed), thấp hơn một chút
  // so với userWeeklyXp (Mon–Thu) ở các test không kiểm tra delta cụ thể.
  userWeeklyXpThroughYesterday: PACE * 3,
};

const rankOfUser = (b: ReturnType<typeof buildBoard>) =>
  b.find((e) => e.kind === "user")!.rank;

const sumRivalXp = (b: ReturnType<typeof buildBoard>) =>
  b.filter((e) => e.kind === "rival").reduce((sum, e) => sum + e.weeklyXp, 0);

describe("buildBoard", () => {
  it("có đúng RIVAL_COUNT + 1 dòng, xếp hạng liên tục từ 1", () => {
    const board = buildBoard({ ...base, userWeeklyXp: 300 });
    expect(board).toHaveLength(RIVAL_COUNT + 1);
    expect(board.map((e) => e.rank)).toEqual(
      Array.from({ length: RIVAL_COUNT + 1 }, (_, i) => i + 1)
    );
  });

  it("đúng một dòng kind=user", () => {
    const board = buildBoard({ ...base, userWeeklyXp: 300 });
    expect(board.filter((e) => e.kind === "user")).toHaveLength(1);
  });

  it("sort giảm dần theo XP tuần", () => {
    const board = buildBoard({ ...base, userWeeklyXp: 300 });
    for (let i = 1; i < board.length; i++) {
      expect(board[i - 1].weeklyXp).toBeGreaterThanOrEqual(board[i].weeklyXp);
    }
  });

  it("user học đều theo nhịp → hạng 4–8", () => {
    // Tiêu chí 1 của spec: 4 ngày × nhịp 60 = 240 XP giữa tuần.
    const rank = rankOfUser(
      buildBoard({ ...base, userWeeklyXp: PACE * 4, userWeeklyXpThroughYesterday: PACE * 3 })
    );
    expect(rank).toBeGreaterThanOrEqual(4);
    expect(rank).toBeLessThanOrEqual(8);
  });

  it("cày mạnh → top 3", () => {
    const rank = rankOfUser(
      buildBoard({
        ...base,
        userWeeklyXp: PACE * 7 * 2,
        userWeeklyXpThroughYesterday: PACE * 7 * 2 - PACE,
      })
    );
    expect(rank).toBeLessThanOrEqual(3);
  });

  it("nghỉ gần hết tuần → tụt khỏi top 8", () => {
    const rank = rankOfUser(
      buildBoard({ ...base, userWeeklyXp: 20, userWeeklyXpThroughYesterday: 20 })
    );
    expect(rank).toBeGreaterThan(8);
  });

  it("không rival nào vượt cap", () => {
    const board = buildBoard({ ...base, userWeeklyXp: 300 });
    // Đến thứ Năm mới có 4/7 ngày trôi qua, cap co lại theo số ngày đã qua.
    const cap = WEEKLY_CAP_MULTIPLIER * PACE * 4;
    for (const e of board) {
      if (e.kind === "rival") expect(e.weeklyXp).toBeLessThanOrEqual(cap);
    }
  });

  it("không XP rival nào tròn chục", () => {
    for (let i = 0; i < 15; i++) {
      const board = buildBoard({ ...base, userId: `user_${i}`, userWeeklyXp: 300 });
      for (const e of board) {
        if (e.kind === "rival" && e.weeklyXp > 0) expect(e.weeklyXp % 10).not.toBe(0);
      }
    }
  });

  it("giữa tuần thì có Δ hạng", () => {
    const board = buildBoard({ ...base, userWeeklyXp: 300 });
    expect(board.every((e) => e.delta !== null)).toBe(true);
  });

  it("thứ Hai thì Δ là null cho mọi dòng", () => {
    const board = buildBoard({
      ...base,
      now: MON,
      userWeeklyXp: 40,
      userWeeklyXpThroughYesterday: 0,
    });
    expect(board.every((e) => e.delta === null)).toBe(true);
  });

  it("rival có lastActiveAt, user thì null", () => {
    const board = buildBoard({ ...base, userWeeklyXp: 300 });
    for (const e of board) {
      if (e.kind === "rival") expect(typeof e.lastActiveAt).toBe("string");
      else expect(e.lastActiveAt).toBeNull();
    }
  });

  it("streak là số nguyên không âm với mọi dòng", () => {
    const board = buildBoard({ ...base, userWeeklyXp: 300 });
    for (const e of board) {
      expect(e.streak).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(e.streak)).toBe(true);
    }
  });

  it("tất định", () => {
    expect(buildBoard({ ...base, userWeeklyXp: 300 })).toEqual(
      buildBoard({ ...base, userWeeklyXp: 300 })
    );
  });

  it("giữ nguyên streak thật của user", () => {
    const board = buildBoard({ ...base, userWeeklyXp: 300 });
    expect(board.find((e) => e.kind === "user")!.streak).toBe(12);
  });

  it("XP rival cộng dồn theo số ngày đã qua trong tuần (Hai < Năm < Chủ Nhật)", () => {
    const mon = buildBoard({
      ...base,
      now: MON,
      userWeeklyXp: 300,
      userWeeklyXpThroughYesterday: 0,
    });
    const thu = buildBoard({ ...base, now: THU, userWeeklyXp: 300 });
    const sun = buildBoard({
      ...base,
      now: SUN,
      userWeeklyXp: 300,
      userWeeklyXpThroughYesterday: 300,
    });
    expect(sumRivalXp(mon)).toBeLessThan(sumRivalXp(thu));
    expect(sumRivalXp(thu)).toBeLessThan(sumRivalXp(sun));
  });

  it("thứ Hai học một ngày đúng nhịp thì không bị xếp cuối bảng", () => {
    const board = buildBoard({
      ...base,
      now: MON,
      userWeeklyXp: PACE,
      userWeeklyXpThroughYesterday: 0,
    });
    const rank = rankOfUser(board);
    expect(rank).toBeLessThan(RIVAL_COUNT + 1);
    // Một ngày học đúng nhịp nên nằm giữa bảng, không phải ở rìa trên/dưới.
    expect(rank).toBeGreaterThanOrEqual(2);
    expect(rank).toBeLessThanOrEqual(9);
  });

  it("Δ của user đi theo XP thật của họ, không phải phép nội suy", () => {
    const studiedHard = buildBoard({
      ...base,
      userWeeklyXpThroughYesterday: 50,
      userWeeklyXp: 50 + PACE * 10,
    });
    const userStudiedHard = studiedHard.find((e) => e.kind === "user")!;
    expect(userStudiedHard.delta).not.toBeNull();
    expect(userStudiedHard.delta!).toBeGreaterThanOrEqual(0);

    const didNothingToday = buildBoard({
      ...base,
      userWeeklyXpThroughYesterday: 200,
      userWeeklyXp: 200,
    });
    const userDidNothing = didNothingToday.find((e) => e.kind === "user")!;
    expect(userDidNothing.delta).not.toBeNull();
    expect(userDidNothing.delta!).toBeLessThanOrEqual(0);
  });
});
