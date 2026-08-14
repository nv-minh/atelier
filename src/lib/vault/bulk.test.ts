import { describe, it, expect } from "vitest";
import { parseBulkRequest, BULK_MAX } from "./bulk";

describe("parseBulkRequest", () => {
  it("nhận yêu cầu hợp lệ", () => {
    expect(parseBulkRequest({ wordIds: ["a", "b"], action: "mark-known" })).toEqual({
      ok: true, wordIds: ["a", "b"], action: "mark-known",
    });
  });

  it("từ chối action lạ", () => {
    expect(parseBulkRequest({ wordIds: ["a"], action: "delete-card" })).toMatchObject({ ok: false });
    expect(parseBulkRequest({ wordIds: ["a"], action: "drop" })).toMatchObject({ ok: false });
  });

  it("từ chối danh sách rỗng và danh sách không phải chuỗi", () => {
    expect(parseBulkRequest({ wordIds: [], action: "star" })).toMatchObject({ ok: false });
    expect(parseBulkRequest({ wordIds: [1, 2], action: "star" })).toMatchObject({ ok: false });
    expect(parseBulkRequest({ action: "star" })).toMatchObject({ ok: false });
    expect(parseBulkRequest(null)).toMatchObject({ ok: false });
  });

  it(`chặn ở ${BULK_MAX} id — bằng perPage của /browse`, () => {
    // Không có "chọn tất cả 8.011 từ": một cú reset như thế không có đường lùi.
    const ids = Array.from({ length: BULK_MAX + 1 }, (_, i) => `w${i}`);
    expect(parseBulkRequest({ wordIds: ids, action: "reset" })).toMatchObject({ ok: false });
    expect(parseBulkRequest({ wordIds: ids.slice(0, BULK_MAX), action: "reset" })).toMatchObject({ ok: true });
  });

  it("loại id trùng nhau trước khi trả về", () => {
    const r = parseBulkRequest({ wordIds: ["a", "a", "b"], action: "star" });
    expect(r).toMatchObject({ ok: true });
    if (r.ok) expect(r.wordIds).toEqual(["a", "b"]);
  });
});
