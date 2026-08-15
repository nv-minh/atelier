import { describe, expect, it } from "vitest";
import {
  checkEntriesVi,
  checkExplanationVi,
  checkLessonVi,
  isBlankStem,
  isInflectionPattern,
  repairConfusedEntriesVi,
  repairExplanationVi,
  repairLessonViHtml,
  repairMistakeTitleVi,
} from "./vi-repair";

describe("isInflectionPattern", () => {
  it("nhận ra mẫu biến đổi hình thái: vế sau nối dài vế đầu", () => {
    expect(isInflectionPattern("tomato => tomatoes")).toBe(true);
    expect(isInflectionPattern("dictionary => dictionaries")).toBe(true);
    expect(isInflectionPattern("clean → cleaner → (the) cleanest")).toBe(true);
    // Thẻ HTML bị lột trước khi so, vì nguồn hay chèn <b> vào giữa đuôi từ.
    expect(isInflectionPattern("tomato => tomato<b>es</b>")).toBe(true);
  });

  it("KHÔNG nhận nhầm câu văn có mũi tên là mẫu biến đổi", () => {
    // Cặp nhãn — bản dịch "Số ít → Số nhiều" là đúng, không được đè tiếng Anh.
    expect(isInflectionPattern("Singular → Plural")).toBe(false);
    expect(isInflectionPattern("Beer is uncount noun → singular verb is used")).toBe(false);
    expect(isInflectionPattern("yes → go on with No. 3")).toBe(false);
    // Không có mũi tên thì không bao giờ là mẫu.
    expect(isInflectionPattern("Adjectives tell us something about a person.")).toBe(false);
  });
});

describe("repairLessonViHtml", () => {
  it("trả ô <td> về tiếng Anh nhưng giữ nhãn cột <th> tiếng Việt", () => {
    // Rút gọn từ bài 'can and must in sentences and questions' (dữ liệu thật).
    const en =
      "<table><thead><tr><th>Long form</th></tr></thead><tbody><tr>" +
      '<td>I <span class="auxiliary">can</span><span class="negation">not</span> play football.</td>' +
      "</tr></tbody></table>";
    const vi =
      "<table><thead><tr><th>Biểu mẫu dài</th></tr></thead><tbody><tr>" +
      '<td>tôi <span class="auxiliary">có thể</span><span class="negation">không</span> chơi bóng đá.</td>' +
      "</tr></tbody></table>";

    const out = repairLessonViHtml(en, vi);
    expect(out).not.toBeNull();
    expect(out!.html).toContain("<th>Biểu mẫu dài</th>");
    expect(out!.html).toContain(
      '<td>I <span class="auxiliary">can</span><span class="negation">not</span> play football.</td>'
    );
    expect(out!.restored).toBeGreaterThan(0);
  });

  it("trả <li> về tiếng Anh nhưng giữ <p> giải thích tiếng Việt", () => {
    const en = "<p>Adjectives tell us something.</p><ul><li>a fat old cat</li></ul>";
    const vi = "<p>Tính từ cho ta biết điều gì đó.</p><ul><li>một con mèo già béo</li></ul>";

    const out = repairLessonViHtml(en, vi)!;
    expect(out.html).toContain("<p>Tính từ cho ta biết điều gì đó.</p>");
    expect(out.html).toContain("<li>a fat old cat</li>");
  });

  it("quyết định theo KHỐI nên mẫu bị <b> cắt làm ba vẫn về nguyên vẹn", () => {
    // Sửa từng node lẻ sẽ ra "dictionary => dictionarphải." — đây là hồi quy đó.
    const en = "<p>dictionary => dictionar<b>ies</b></p>";
    const vi = "<p>dictionary => dictionar<b>phải. </b></p>";

    const out = repairLessonViHtml(en, vi)!;
    expect(out.html).toBe(en);
  });

  it("trả CẢ câu ví dụ trong <p> về tiếng Anh, không chỉ mỗi span", () => {
    // Bài 245 thật: 'draws' bị tra từ điển thành 'vẽ, kéo' + 's', khung câu
    // cũng bị dịch nốt — người học đọc được đúng cái sai.
    const en =
      '<p>My friend often <span class="infinitive">draw</span><span class="ending">s</span> nice posters.</p>';
    const vi =
      '<p>Bạn tôi thường xuyên <span class="infinitive">vẽ, kéo</span><span class="ending">s</span> áp phích đẹp.</p>';

    expect(repairLessonViHtml(en, vi)!.html).toBe(en);
  });

  it("chừa câu HƯỚNG DẪN tiếng Việt, chỉ kéo dạng được trích dẫn về EN", () => {
    // Cùng mang span vai trò như câu ví dụ, nhưng đây là câu nói VỀ ngữ pháp.
    const en =
      '<p>You need the auxiliary <span class="auxiliary">do/does</span> and the infinitive.</p>';
    const vi =
      '<p>Bạn cần trợ động từ <span class="auxiliary">làm/thực hiện</span> và động từ nguyên thể.</p>';

    expect(repairLessonViHtml(en, vi)!.html).toBe(
      '<p>Bạn cần trợ động từ <span class="auxiliary">do/does</span> và động từ nguyên thể.</p>'
    );
  });

  it("giữ công thức tiếng Anh dù nó cũng gọi tên loại từ", () => {
    const en = '<p><span class="auxiliary">will</span> + infinitive</p>';
    const vi = '<p><span class="auxiliary">sẽ</span> + nguyên thể</p>';

    expect(repairLessonViHtml(en, vi)!.html).toBe(en);
  });

  it("giữ chất liệu trong <i> — tên thì, dạng trích dẫn, danh sách động từ", () => {
    const en = "<h3>with special verbs <i>be, believe, belong, hate</i></h3>";
    const vi = "<h3>với động từ đặc biệt <i>được, tin, thuộc về, ghét</i></h3>";

    expect(repairLessonViHtml(en, vi)!.html).toBe(
      "<h3>với động từ đặc biệt <i>be, believe, belong, hate</i></h3>"
    );
  });

  it("giữ hình vị đang được dạy ở tiếng Anh ngay giữa câu văn tiếng Việt", () => {
    const en = '<p>Add <span class="ending">es</span> to the verb.</p>';
    const vi = '<p>Thêm <span class="ending">phải</span> vào động từ.</p>';

    const out = repairLessonViHtml(en, vi)!;
    expect(out.html).toBe('<p>Thêm <span class="ending">es</span> vào động từ.</p>');
  });

  it("trả null khi chuỗi thẻ hai bên lệch nhau, thay vì ghép sai chỗ", () => {
    expect(repairLessonViHtml("<p>a</p><p>b</p>", "<p>a</p>")).toBeNull();
    expect(repairLessonViHtml("<p>a</p>", "<div>a</div>")).toBeNull();
  });

  it("không đếm là đã sửa khi ô vốn đã trùng tiếng Anh", () => {
    const html = "<table><tbody><tr><td>I can swim.</td></tr></tbody></table>";
    expect(repairLessonViHtml(html, html)!.restored).toBe(0);
  });
});

describe("isBlankStem", () => {
  it("nhận ra câu đề có chỗ trống — thứ chỉ chạy được bằng tiếng Anh", () => {
    expect(isBlankStem("The dog ___ small.")).toBe(true);
    expect(isBlankStem("A horse is _____ (fast) than an elephant.")).toBe(true);
    expect(isBlankStem("He is …… tall.")).toBe(true);
  });

  it("không nhận nhầm câu hỏi siêu ngữ — loại này dịch được", () => {
    expect(isBlankStem(`What's the plural of "Aircraft"?`)).toBe(false);
    expect(isBlankStem("This cool breeze feels great.")).toBe(false);
  });
});

describe("repairExplanationVi", () => {
  it("chỉ đè lại dòng mẫu biến đổi, chừa nguyên dòng văn tiếng Việt", () => {
    const en = "<b>Plurals</b>\nSome nouns ending with o:\ntomato => tomato<b>es</b>";
    const vi = "<b>Số nhiều</b>\nMột số danh từ tận cùng bằng o:\ncà chua => cà chua<b>es</b>";

    const out = repairExplanationVi(en, vi)!;
    expect(out.restored).toBe(1);
    expect(out.text.split("\n")[1]).toBe("Một số danh từ tận cùng bằng o:");
    expect(out.text.split("\n")[2]).toBe("tomato => tomato<b>es</b>");
  });

  it("giữ nhãn 'Ví dụ:' tiếng Việt nhưng trả lại mẫu vật tiếng Anh", () => {
    // Dữ liệu thật: 'Example: deer' bị dịch thành 'Ví dụ: hươu', xoá sạch
    // chính cái ví dụ danh từ bất biến mà câu giải thích đang dạy.
    const out = repairExplanationVi("Example:  deer", "Ví dụ:  hươu")!;
    expect(out.text).toBe("Ví dụ:  deer");
    expect(out.restored).toBe(1);

    expect(repairExplanationVi("Example: key => keys", "Ví dụ: phím => phím")!.text).toBe(
      "Ví dụ: key => keys"
    );
  });

  it("dùng nhãn tiếng Anh khi bản dịch không giữ nhãn nào", () => {
    expect(repairExplanationVi("Example: deer", "hươu")!.text).toBe("Example: deer");
  });

  it("trả null khi số dòng lệch, vì không còn cách ghép an toàn", () => {
    expect(repairExplanationVi("a\nb", "a")).toBeNull();
  });
});

describe("repairConfusedEntriesVi", () => {
  const en = [
    { w: "Bare", m: "without cover or clothing", examples: ["his chest was bare"] },
    { w: "Bear", m: "to hold up or tolerate", examples: ["the grizzly bear"] },
  ];

  it("giữ từ khoá và ví dụ ở tiếng Anh, chỉ lấy phần nghĩa tiếng Việt", () => {
    const vi = [
      { w: "trần", m: "không che chắn, không mặc quần áo", examples: ["ngực trần"] },
      { w: "gấu", m: "đỡ, chịu đựng", examples: ["con gấu xám"] },
    ];
    const out = repairConfusedEntriesVi(en, vi)!;
    expect(out[0]).toEqual({
      w: "Bare",
      m: "không che chắn, không mặc quần áo",
      examples: ["his chest was bare"],
    });
    expect(out[1].w).toBe("Bear");
    expect(out[1].examples).toEqual(["the grizzly bear"]);
  });

  it("trả null khi thiếu bản dịch hoặc hai bên lệch số mục", () => {
    expect(repairConfusedEntriesVi(en, null)).toBeNull();
    expect(repairConfusedEntriesVi(en, [{ w: "trần", m: "x", examples: [] }])).toBeNull();
    const empty = en.map((e) => ({ ...e, m: "  " }));
    expect(repairConfusedEntriesVi(en, empty)).toBeNull();
  });
});

describe("repairMistakeTitleVi", () => {
  it("ghép từ khoá tiếng Anh với phần chú giải tiếng Việt", () => {
    expect(repairMistakeTitleVi("Absorbed ( = very much interested)", "Hấp thụ (= rất quan tâm)")).toBe(
      "Absorbed (= rất quan tâm)"
    );
  });

  it("trả null khi tiêu đề không có dạng 'từ khoá (chú giải)'", () => {
    expect(repairMistakeTitleVi("Absorbed", "Hấp thụ")).toBeNull();
    expect(repairMistakeTitleVi("Absorbed (= interested)", null)).toBeNull();
  });
});

describe("checkLessonVi — validator Tầng 1", () => {
  const en =
    "<table><thead><tr><th>Long form</th></tr></thead><tbody><tr>" +
    '<td>I <span class="auxiliary">can</span> play football.</td>' +
    '</tr></tbody></table><p>Add <span class="ending">es</span> to the verb.</p>';

  it("chấp nhận bản dịch giữ nguyên vùng bảo vệ", () => {
    const vi =
      "<table><thead><tr><th>Biểu mẫu dài</th></tr></thead><tbody><tr>" +
      '<td>I <span class="auxiliary">can</span> play football.</td>' +
      '</tr></tbody></table><p>Thêm <span class="ending">es</span> vào động từ.</p>';
    expect(checkLessonVi(en, vi)).toEqual({ ok: true });
  });

  it("từ chối khi đụng ô <td> tiếng Anh", () => {
    const vi =
      "<table><thead><tr><th>Biểu mẫu dài</th></tr></thead><tbody><tr>" +
      '<td>Tôi <span class="auxiliary">có thể</span> chơi bóng đá.</td>' +
      '</tr></tbody></table><p>Thêm <span class="ending">es</span> vào động từ.</p>';
    const r = checkLessonVi(en, vi);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("protected");
  });

  it("từ chối khi dịch mất hình vị trong span ending", () => {
    const vi =
      "<table><thead><tr><th>Biểu mẫu dài</th></tr></thead><tbody><tr>" +
      '<td>I <span class="auxiliary">can</span> play football.</td>' +
      '</tr></tbody></table><p>Thêm <span class="ending">phải</span> vào động từ.</p>';
    expect(checkLessonVi(en, vi).ok).toBe(false);
  });

  it("từ chối khi dịch cả câu ví dụ trong <p>", () => {
    const enP = '<p>The sun <span class="infinitive">rise</span>s in the east.</p>';
    const viP = '<p>Mặt Trời <span class="infinitive">mọc lên</span>s ở phía đông.</p>';
    expect(checkLessonVi(enP, viP).ok).toBe(false);
  });

  it("từ chối khi chuỗi thẻ bị thay đổi", () => {
    expect(checkLessonVi("<p>a</p>", '<div>a</div>').ok).toBe(false);
    expect(checkLessonVi("<p>a</p><p>b</p>", "<p>a</p>").ok).toBe(false);
  });
});

describe("checkExplanationVi — validator Tầng 1", () => {
  it("chấp nhận khi giữ dòng Example: + mẫu vật EN, dịch dòng văn", () => {
    const en = "Some nouns:\nExample:  deer\ntomato => tomato<b>es</b>";
    const vi = "Một số danh từ:\nVí dụ:  deer\ntomato => tomato<b>es</b>";
    expect(checkExplanationVi(en, vi)).toEqual({ ok: true });
  });

  it("từ chối khi dịch mất mẫu vật sau nhãn", () => {
    expect(checkExplanationVi("Example: deer", "Ví dụ: hươu").ok).toBe(false);
  });

  it("từ chối khi đổi dòng mẫu biến đổi", () => {
    expect(checkExplanationVi("tomato => tomatoes", "cà chua => cà chuaes").ok).toBe(false);
  });

  it("từ chối khi lệch số dòng", () => {
    expect(checkExplanationVi("a\nb", "a").ok).toBe(false);
  });
});

describe("checkEntriesVi — validator Tầng 1", () => {
  const en = [
    { w: "Bare", m: "without cover", examples: ["his chest was bare"] },
    { w: "Bear", m: "to tolerate", examples: ["the grizzly bear"] },
  ];

  it("chấp nhận JSON đúng shape, w/examples giữ EN, m là tiếng Việt", () => {
    const vi = JSON.stringify([
      { w: "Bare", m: "trần, không che", examples: ["his chest was bare"] },
      { w: "Bear", m: "chịu đựng", examples: ["the grizzly bear"] },
    ]);
    const r = checkEntriesVi(en, vi);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.entries[0]).toEqual({ w: "Bare", m: "trần, không che", examples: en[0].examples });
  });

  it("dung nạp thiếu examples — tự đổ từ EN", () => {
    const vi = JSON.stringify([{ w: "Bare", m: "trần" }, { w: "Bear", m: "chịu đựng" }]);
    const r = checkEntriesVi(en, vi);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.entries[1].examples).toEqual(en[1].examples);
  });

  it("từ chối: sai JSON / sai số mục / đổi w / đổi examples / m rỗng", () => {
    expect(checkEntriesVi(en, "not json").ok).toBe(false);
    expect(checkEntriesVi(en, JSON.stringify([{ w: "Bare", m: "trần" }])).ok).toBe(false);
    expect(checkEntriesVi(en, JSON.stringify([{ w: "trần", m: "x" }, { w: "Bear", m: "y" }])).ok).toBe(false);
    expect(
      checkEntriesVi(en, JSON.stringify([
        { w: "Bare", m: "trần", examples: ["ngực trần"] },
        { w: "Bear", m: "gấu", examples: ["con gấu"] },
      ])).ok
    ).toBe(false);
    expect(checkEntriesVi(en, JSON.stringify([{ w: "Bare", m: "  " }, { w: "Bear", m: "y" }])).ok).toBe(false);
  });
});
