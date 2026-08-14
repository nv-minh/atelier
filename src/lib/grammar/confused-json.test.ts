import { describe, expect, it } from "vitest";
import { parseEntriesEn, parseEntriesVi } from "./confused-json";

describe("parseEntriesEn", () => {
  it("parses a well-formed body and splits examples out of m", () => {
    const body = JSON.stringify([
      { w: "A few", m: '"A few" is a phrase.\n# Hurry up if you want yellow.' },
      { w: "Afew", m: '"Afew" is an incorrect spelling.' },
    ]);
    const entries = parseEntriesEn(body);
    expect(entries).toHaveLength(2);
    expect(entries[0]).toEqual({
      w: "A few",
      m: '"A few" is a phrase.',
      examples: ["Hurry up if you want yellow."],
    });
    expect(entries[1].examples).toEqual([]);
  });
  it("throws on garbage so the importer can skip + report the row", () => {
    expect(() => parseEntriesEn("not json")).toThrow();
    expect(() => parseEntriesEn('{"w":"solo object"}')).toThrow();
  });
});

describe("parseEntriesVi", () => {
  it('repairs the `"w">value` mangling (real row id=1)', () => {
    const broken =
      '[{"w">Một vài","m":"\\"Một vài\\" là một cụm từ.\\n# Hãy nhanh lên nếu bạn muốn màu vàng."},' +
      '{"w"Afew","m":"Afew\\" là cách viết sai."}]';
    const entries = parseEntriesVi(broken);
    expect(entries).not.toBeNull();
    expect(entries![0].w).toBe("Một vài");
    expect(entries![0].examples).toEqual(["Hãy nhanh lên nếu bạn muốn màu vàng."]);
    expect(entries![1].w).toBe("Afew");
  });
  it('repairs the `"m">value` mangling (real row id=2)', () => {
    const broken = '[{"w"A hold","m">Ahold\\" là một cụm từ."}]';
    const entries = parseEntriesVi(broken);
    expect(entries).not.toBeNull();
    expect(entries![0].w).toBe("A hold");
  });
  it("returns null for empty or unrepairable input", () => {
    expect(parseEntriesVi("")).toBeNull();
    expect(parseEntriesVi("hoàn toàn không phải json {{{")).toBeNull();
  });
});
