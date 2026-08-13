import { describe, it, expect } from "vitest";
import { buildBoard } from "./board";
import { RIVAL_COUNT, WEEKLY_CAP_MULTIPLIER } from "./constants";

const utc = (y: number, m: number, d: number, h = 12) => new Date(Date.UTC(y, m - 1, d, h));
// 2026-08-13 là thứ Năm (giữa tuần); 2026-08-10 là thứ Hai.
const THU = utc(2026, 8, 13);
const MON = utc(2026, 8, 10);
const PACE = 60;

const base = {
  userId: "user_abc",
  userName: "Minh",
  userStreak: 12,
  pace: PACE,
  now: THU,
};

const rankOfUser = (b: ReturnType<typeof buildBoard>) =>
  b.find((e) => e.kind === "user")!.rank;

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
    const rank = rankOfUser(buildBoard({ ...base, userWeeklyXp: PACE * 4 }));
    expect(rank).toBeGreaterThanOrEqual(4);
    expect(rank).toBeLessThanOrEqual(8);
  });

  it("cày mạnh → top 3", () => {
    const rank = rankOfUser(buildBoard({ ...base, userWeeklyXp: PACE * 7 * 2 }));
    expect(rank).toBeLessThanOrEqual(3);
  });

  it("nghỉ gần hết tuần → tụt khỏi top 8", () => {
    const rank = rankOfUser(buildBoard({ ...base, userWeeklyXp: 20 }));
    expect(rank).toBeGreaterThan(8);
  });

  it("không rival nào vượt cap", () => {
    const board = buildBoard({ ...base, userWeeklyXp: 300 });
    const cap = WEEKLY_CAP_MULTIPLIER * PACE * 7;
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
    const board = buildBoard({ ...base, now: MON, userWeeklyXp: 40 });
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
});
