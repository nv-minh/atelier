import { describe, it, expect } from "vitest";
import { LEECH_THRESHOLD, leechCardWhere } from "./leech";

describe("leechCardWhere", () => {
  it("là predicate KHÔNG chứa userId, để module thuần dùng lại được", () => {
    // scope.ts (thuần) cần predicate này bên trong một relation filter trên Word;
    // nếu nó dính userId thì không nhúng được và repo sẽ có định nghĩa leech thứ hai.
    expect(leechCardWhere()).toEqual({
      lapses: { gte: LEECH_THRESHOLD },
      state: { gte: 1 },
    });
    expect("userId" in leechCardWhere()).toBe(false);
  });

  it("ngưỡng vẫn là 4 — đổi số này là đổi ý nghĩa 'từ khó' của cả app", () => {
    expect(LEECH_THRESHOLD).toBe(4);
  });
});
