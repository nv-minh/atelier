import { describe, it, expect, vi, afterEach } from "vitest";
import { parseZenQuote, fallbackQuote, dayKey, getDailyQuote, resetQuoteCache } from "./quote";

describe("parseZenQuote", () => {
  it("reads the single-element array ZenQuotes actually returns", () => {
    const parsed = parseZenQuote([{ q: "Little by little, one travels far.", a: "Tolkien", h: "<p/>" }]);
    expect(parsed).toEqual({ text: "Little by little, one travels far.", author: "Tolkien" });
  });

  it("trims the whitespace ZenQuotes pads quotes with", () => {
    expect(parseZenQuote([{ q: "  Keep going.  ", a: "  Anon  " }])).toEqual({
      text: "Keep going.",
      author: "Anon",
    });
  });

  // The reason this function exists. ZenQuotes answers a throttled request
  // with HTTP 200 and a quote-shaped body, so only the content reveals it.
  it("rejects the rate-limit notice disguised as a quote", () => {
    expect(
      parseZenQuote([
        {
          q: "Too many requests. Obtain an auth key for unlimited access.",
          a: "zenquotes.io",
          h: "<blockquote>…</blockquote>",
        },
      ])
    ).toBeNull();
  });

  it("rejects the notice even if the attribution changes", () => {
    expect(parseZenQuote([{ q: "Too many requests, slow down.", a: "Someone Else" }])).toBeNull();
  });

  it("returns null for empty, malformed, or textless payloads", () => {
    expect(parseZenQuote([])).toBeNull();
    expect(parseZenQuote(null)).toBeNull();
    expect(parseZenQuote("nope")).toBeNull();
    expect(parseZenQuote([{ a: "No text here" }])).toBeNull();
    expect(parseZenQuote([{ q: "   ", a: "Blank" }])).toBeNull();
  });

  it("accepts a bare object as well as an array", () => {
    expect(parseZenQuote({ q: "Direct object.", a: "X" })).toEqual({ text: "Direct object.", author: "X" });
  });

  it("labels a missing author rather than dropping the quote", () => {
    expect(parseZenQuote([{ q: "Unattributed." }])).toEqual({ text: "Unattributed.", author: "Unknown" });
  });
});

describe("fallbackQuote", () => {
  it("is stable for a given day", () => {
    expect(fallbackQuote("2026-08-13")).toEqual(fallbackQuote("2026-08-13"));
  });

  it("rotates across days", () => {
    const week = ["2026-08-13", "2026-08-14", "2026-08-15", "2026-08-16", "2026-08-17"];
    const texts = new Set(week.map((d) => fallbackQuote(d).text));
    expect(texts.size).toBeGreaterThan(1);
  });

  it("always yields a usable quote", () => {
    const q = fallbackQuote(dayKey(new Date("2026-01-01T00:00:00Z")));
    expect(q.text.length).toBeGreaterThan(0);
    expect(q.author.length).toBeGreaterThan(0);
  });
});

describe("getDailyQuote", () => {
  afterEach(() => {
    resetQuoteCache();
    vi.unstubAllGlobals();
  });

  it("serves the live quote when ZenQuotes answers", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify([{ q: "Live one.", a: "Author" }]), { status: 200 }))
    );
    const q = await getDailyQuote(new Date("2026-08-13T10:00:00Z"));
    expect(q).toMatchObject({ text: "Live one.", author: "Author", day: "2026-08-13", source: "zenquotes" });
  });

  it("memoizes so one page-load does not spend the rate limit", async () => {
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify([{ q: "Cached.", a: "Author" }]), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);
    const now = new Date("2026-08-13T10:00:00Z");
    await getDailyQuote(now);
    await getDailyQuote(now);
    await getDailyQuote(now);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("falls back to /api/random when /api/today fails", async () => {
    const fetchMock = vi.fn(async (url: any) =>
      String(url).includes("/today")
        ? new Response("boom", { status: 500 })
        : new Response(JSON.stringify([{ q: "Random one.", a: "Author" }]), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);
    const q = await getDailyQuote(new Date("2026-08-13T10:00:00Z"));
    expect(q).toMatchObject({ text: "Random one.", source: "zenquotes" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("serves a curated quote — never an error — when ZenQuotes is unreachable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      })
    );
    const q = await getDailyQuote(new Date("2026-08-13T10:00:00Z"));
    expect(q.source).toBe("fallback");
    expect(q.text).toBe(fallbackQuote("2026-08-13").text);
  });

  it("does not hold a fallback for the whole day", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("nope", { status: 429 }))
    );
    const first = await getDailyQuote(new Date("2026-08-13T10:00:00Z"));
    expect(first.source).toBe("fallback");

    // 11 minutes later ZenQuotes is healthy again — the cooldown has expired,
    // so the real quote takes over without waiting for midnight.
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify([{ q: "Back up.", a: "Author" }]), { status: 200 }))
    );
    const second = await getDailyQuote(new Date("2026-08-13T10:11:00Z"));
    expect(second).toMatchObject({ text: "Back up.", source: "zenquotes" });
  });
});
