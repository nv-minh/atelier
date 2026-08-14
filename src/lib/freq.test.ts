import { describe, expect, it } from "vitest";
import {
  PACK_FREQ_SOURCE,
  freqPctFromRank,
  freqForPackWord,
  freqPctFromZipf,
  ZIPF_MID,
  ZIPF_HALF_RANGE,
} from "./freq";

describe("freqPctFromRank", () => {
  it("puts the top of a list at ~1 and the bottom at 0", () => {
    expect(freqPctFromRank(1, 1000)).toBeCloseTo(0.999, 3);
    expect(freqPctFromRank(500, 1000)).toBeCloseTo(0.5, 6);
    expect(freqPctFromRank(1000, 1000)).toBe(0);
  });

  it("clamps rank 0 to 1 — NGSL-Spoken starts at 0, the service lists at 1", () => {
    expect(freqPctFromRank(0, 721)).toBe(1);
  });

  it("clamps a rank past the end of its list instead of going negative", () => {
    expect(freqPctFromRank(1500, 1000)).toBe(0);
  });

  it("returns null rather than a made-up number for unusable input", () => {
    expect(freqPctFromRank(null, 1000)).toBeNull();
    expect(freqPctFromRank(undefined, 1000)).toBeNull();
    expect(freqPctFromRank(NaN, 1000)).toBeNull();
    expect(freqPctFromRank(-3, 1000)).toBeNull();
    expect(freqPctFromRank(5, 0)).toBeNull();
    expect(freqPctFromRank(5, -10)).toBeNull();
  });
});

describe("freqForPackWord", () => {
  // The bug this module exists to prevent: `mister` is rank 1 in BOTH the
  // Business Service List (1744 words) and the TOEIC Service List (1250). A
  // shared raw-rank column would make it the most frequent word in English.
  // Percentiles keep the two scales separate and comparable.
  it("normalizes the same raw rank differently per list, and never exposes the rank", () => {
    const bsl = freqForPackWord("business", 1, 1744);
    const tsl = freqForPackWord("toeic", 1, 1250);

    expect(bsl.freqSource).toBe("bsl");
    expect(tsl.freqSource).toBe("tsl");
    // Both are near the top of their own list — that is the honest statement.
    expect(bsl.freqPct).toBeGreaterThan(0.99);
    expect(tsl.freqPct).toBeGreaterThan(0.99);
    // …and neither leaks the raw rank.
    expect(bsl.freqPct).not.toBe(1);
    expect(tsl.freqPct).not.toBe(1);
  });

  it("ranks a mid-list word below a top-of-list word on the same scale", () => {
    const top = freqForPackWord("business", 10, 1744).freqPct!;
    const mid = freqForPackWord("business", 900, 1744).freqPct!;
    expect(top).toBeGreaterThan(mid);
  });

  it("gives a pack with no rank source null on BOTH fields", () => {
    // oxford-c1, it-programming and every pack in the 2026-08-13 crawl batch
    // carry no rank; null must not be paired with a guessed source, or a later
    // reader cannot tell which scale a percentile came from.
    for (const pack of ["oxford-c1", "it-programming", "medical", "daily-communication"]) {
      expect(freqForPackWord(pack, 5, 500)).toEqual({ freqPct: null, freqSource: null });
    }
  });

  it("gives null when the pack has a source but the word has no rank", () => {
    expect(freqForPackWord("business", undefined, 1744)).toEqual({ freqPct: null, freqSource: null });
    expect(freqForPackWord("business", null, 1744)).toEqual({ freqPct: null, freqSource: null });
  });

  it("only claims a scale for packs actually built from a ranked list", () => {
    expect(Object.keys(PACK_FREQ_SOURCE).sort()).toEqual(["business", "conversation", "toeic"]);
  });
});

describe("freqPctFromZipf", () => {
  it("giữ đúng thứ tự: từ phổ biến hơn thì percentile cao hơn", () => {
    const rare = freqPctFromZipf(2.5)!;
    const mid = freqPctFromZipf(4.0)!;
    const common = freqPctFromZipf(5.5)!;
    expect(rare).toBeLessThan(mid);
    expect(mid).toBeLessThan(common);
  });

  it("zipf ở giữa dải rơi ĐÚNG điểm trung tính — đây là điều giữ hành vi chọn từ không đảo", () => {
    // 0.4667 = (freqUnknown 0.6 − freqFloor 0.25) / freqSpan 0.75, tức đúng điểm
    // số mà một từ KHÔNG có dữ liệu tần suất đang nhận hôm nay.
    expect(freqPctFromZipf(ZIPF_MID)).toBeCloseTo((0.6 - 0.25) / 0.75, 6);
  });

  it("bị NÉN trong dải quanh điểm trung tính, không bao giờ đội sàn 0 hay chạm trần 1", () => {
    // Đây là cả lý do tầng này tồn tại: nó chỉ phá thế hoà, không được phép đẩy
    // 2.813 từ chuyên ngành xuống dưới mọi từ đã có rank.
    for (const z of [0.5, 1, 2, 3, 4, 5, 6, 7, 8, 99]) {
      const p = freqPctFromZipf(z);
      if (p === null) continue;
      expect(p).toBeGreaterThan(0.1);
      expect(p).toBeLessThan(0.8);
    }
  });

  it("bão hoà ở hai đầu thay vì trôi ra ngoài dải", () => {
    expect(freqPctFromZipf(99)).toBe(freqPctFromZipf(ZIPF_MID + ZIPF_HALF_RANGE));
    expect(freqPctFromZipf(0.01)).toBe(freqPctFromZipf(ZIPF_MID - ZIPF_HALF_RANGE));
  });

  it("zipf = 0 là 'wordfreq không biết từ này' → null, KHÔNG phải 'hiếm nhất'", () => {
    // Bịa ra 'hiếm nhất' cho một từ chỉ vì corpus không chứa nó là chế dữ liệu.
    expect(freqPctFromZipf(0)).toBeNull();
    expect(freqPctFromZipf(-1)).toBeNull();
    expect(freqPctFromZipf(null)).toBeNull();
    expect(freqPctFromZipf(undefined)).toBeNull();
    expect(freqPctFromZipf(NaN)).toBeNull();
  });

  it("không bao giờ vượt một từ có rank thật ở đỉnh list tổng quát", () => {
    // `the` = 0.9996 qua đường NGSL. Không giá trị zipf nào được lên tới đó.
    expect(freqPctFromZipf(8)!).toBeLessThan(0.9996);
  });
});
