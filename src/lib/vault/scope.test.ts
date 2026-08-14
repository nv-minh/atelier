import { describe, it, expect } from "vitest";
import { STATES, LEARNED_STATES } from "../fsrs";
import { leechCardWhere } from "../leech";
import {
  BROWSE_SCOPES, STUDY_SCOPES, EXPORT_SCOPES,
  parseScope, parseFilter, scopeWhere, filterWhere,
} from "./scope";

const U = "user_1";

describe("scopeWhere", () => {
  it("all không lọc gì", () => {
    expect(scopeWhere("all", U)).toEqual({});
  });

  it("mine = có card HOẶC có mark starred/known", () => {
    // "Từ của tôi" là quan hệ của người học với từ, không riêng lịch ôn: một từ
    // được đánh dấu "đã biết" mà chưa từng vào phiên vẫn là từ của họ.
    expect(scopeWhere("mine", U)).toEqual({
      OR: [
        { cards: { some: { userId: U } } },
        { marks: { some: { userId: U, OR: [{ starred: true }, { known: true }] } } },
      ],
    });
  });

  it("learned dùng LEARNED_STATES, không phải số cứng", () => {
    expect(scopeWhere("learned", U)).toEqual({
      cards: { some: { userId: U, state: { in: [...LEARNED_STATES] } } },
    });
  });

  it("learning GỒM state 0 — card chỉ tồn tại sau khi từ đã vào một phiên", () => {
    // Bỏ state 0 ra thì nhóm "đã gặp, chưa tốt nghiệp" không thuộc phạm vi nào
    // ngoài mine, và người học không tìm lại được chúng.
    expect(scopeWhere("learning", U)).toEqual({
      cards: { some: { userId: U, state: { in: [STATES.New, STATES.Learning] } } },
    });
  });

  it("known đọc WordMark.known", () => {
    expect(scopeWhere("known", U)).toEqual({ marks: { some: { userId: U, known: true } } });
  });

  it("unseen = KHÔNG có card, VÀ KHÔNG bị đánh dấu đã biết", () => {
    // Đánh dấu "đã biết" cũng là một hình thức đã gặp: nếu không loại trừ,
    // một từ vừa bấm "đã biết" sẽ mắc kẹt vĩnh viễn trong "Chưa gặp", đúng nơi
    // người học vừa bấm nút đó nhiều nhất.
    expect(scopeWhere("unseen", U)).toEqual({
      cards: { none: { userId: U } },
      marks: { none: { userId: U, known: true } },
    });
  });

  it("leeches nhúng leechCardWhere, không chép lại ngưỡng", () => {
    expect(scopeWhere("leeches", U)).toEqual({
      cards: { some: { userId: U, ...leechCardWhere() } },
    });
  });

  it("weak lọc theo state >= Learning — thứ tự yếu-nhất-trước nằm ở weak-server.ts, không ở đây", () => {
    // weak không dùng được từ bất kỳ consumer nào qua parseScope (không có
    // trong BROWSE_SCOPES/STUDY_SCOPES/EXPORT_SCOPES ở scope-level filter),
    // nhưng buildCramQueue gọi scopeWhere("weak", …) gián tiếp qua filterWhere
    // bên trong weak-server.ts — nếu không test riêng, định nghĩa "weak" ở
    // đây có thể trôi khỏi thực tế mà không bài test nào bắt được.
    expect(scopeWhere("weak", U)).toEqual({
      cards: { some: { userId: U, state: { gte: STATES.Learning } } },
    });
  });
});

describe("parseScope", () => {
  it("trả null với rác và với scope không nằm trong tập cho phép", () => {
    expect(parseScope("nonsense", BROWSE_SCOPES)).toBeNull();
    expect(parseScope(null, BROWSE_SCOPES)).toBeNull();
    expect(parseScope("weak", BROWSE_SCOPES)).toBeNull(); // weak là ý định học, không phải cách xem
    expect(parseScope("mine", STUDY_SCOPES)).toBeNull();
  });

  it("nhận scope hợp lệ trong tập cho phép", () => {
    expect(parseScope("learned", BROWSE_SCOPES)).toBe("learned");
    expect(parseScope("weak", STUDY_SCOPES)).toBe("weak");
  });

  it("weak KHÔNG thuộc EXPORT_SCOPES — 'yếu nhất' chỉ có nghĩa cùng một limit", () => {
    expect(parseScope("weak", EXPORT_SCOPES)).toBeNull();
  });
});

describe("parseFilter", () => {
  it("scope thiếu/không hợp lệ → all, và ALL bị coi như không lọc", () => {
    expect(parseFilter({}, BROWSE_SCOPES)).toEqual({ scope: "all" });
    expect(parseFilter({ scope: "rác", cefr: "ALL", topic: "ALL" }, BROWSE_SCOPES)).toEqual({
      scope: "all",
    });
  });

  it("giữ nguyên cefr/topic/q hợp lệ và hạ q về lowercase", () => {
    expect(parseFilter({ scope: "learned", cefr: "B2", topic: "medical", q: "AbAndon" }, BROWSE_SCOPES))
      .toEqual({ scope: "learned", cefr: "B2", topic: "medical", q: "abandon" });
  });

  it("nhận alias cefr:B2 của ExportScope cũ → { scope: all, cefr: B2 }", () => {
    // Mọi URL /api/export?scope=cefr:B2 đang chạy phải tiếp tục chạy.
    expect(parseFilter({ scope: "cefr:B2" }, EXPORT_SCOPES)).toEqual({ scope: "all", cefr: "B2" });
    expect(parseFilter({ scope: "cefr:XX" }, EXPORT_SCOPES)).toEqual({ scope: "all" });
  });

  it("topic là slug hợp lệ → giữ nguyên", () => {
    expect(parseFilter({ topic: "medical" }, BROWSE_SCOPES)).toEqual({ scope: "all", topic: "medical" });
  });

  it("topic là slug KHÔNG tồn tại → bị bỏ, y như cefr sai", () => {
    expect(parseFilter({ topic: "not-a-real-topic" }, BROWSE_SCOPES)).toEqual({ scope: "all" });
  });

  it("topic mang chuỗi cố tình chèn header → bị bỏ (không lọt tới Content-Disposition)", () => {
    // Chuỗi này từng khiến /api/export dựng filename có hai tham số filename.
    expect(parseFilter({ topic: 'x";filename="report.csv' }, BROWSE_SCOPES)).toEqual({ scope: "all" });
  });
});

describe("filterWhere", () => {
  it("ghép scope + cefr + topic + q vào một where", () => {
    expect(filterWhere({ scope: "learned", cefr: "B2", topic: "medical", q: "ab" }, U)).toEqual({
      cefr: "B2",
      topics: { contains: '"medical"' },
      word: { contains: "ab" },
      cards: { some: { userId: U, state: { in: [...LEARNED_STATES] } } },
    });
  });

  it("userId null → bỏ hẳn phần scope, chỉ còn lọc trên Word", () => {
    // Guest: không có Card nào nên mọi phạm vi ngoài all đều rỗng; UI khoá chip,
    // còn ở đây phải trả về where hợp lệ chứ không phải { cards: { some: { userId: null } } }.
    expect(filterWhere({ scope: "learned", cefr: "A1" }, null)).toEqual({ cefr: "A1" });
  });

  it("mine + cefr + topic + q cùng lúc — OR của mine không đè lên cefr/topics/word của Object.assign", () => {
    // mine là scope DUY NHẤT phát ra một OR ở cấp cao nhất, và filterWhere ghép
    // scopeWhere vào bằng Object.assign — đúng chỗ một scope tương lai có thể
    // đè mất key anh em của nó (ví dụ nếu ai đó lỡ đặt tên field "OR" trùng).
    expect(filterWhere({ scope: "mine", cefr: "B2", topic: "medical", q: "ab" }, U)).toEqual({
      cefr: "B2",
      topics: { contains: '"medical"' },
      word: { contains: "ab" },
      OR: [
        { cards: { some: { userId: U } } },
        { marks: { some: { userId: U, OR: [{ starred: true }, { known: true }] } } },
      ],
    });
  });
});
