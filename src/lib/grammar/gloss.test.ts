import { describe, expect, it } from "vitest";
import { checkGloss, choiceGlossTargets, joinGloss, stemGlossTarget } from "./gloss";

describe("joinGloss", () => {
  it("joins English and Vietnamese with a plain dash", () => {
    expect(joinGloss("I never drink orange juice.", "Tôi không bao giờ uống nước cam.")).toBe(
      "I never drink orange juice. - Tôi không bao giờ uống nước cam."
    );
  });
  it("returns the English alone when there is no gloss", () => {
    expect(joinGloss("I never drink orange juice.", null)).toBe("I never drink orange juice.");
    expect(joinGloss("I never drink orange juice.", "  ")).toBe("I never drink orange juice.");
    expect(joinGloss("I never drink orange juice.", undefined)).toBe("I never drink orange juice.");
  });
});

describe("checkGloss", () => {
  it("requires the same blank runs as the English stem", () => {
    expect(checkGloss("I have _____ idea.", "Tôi có _____ ý tưởng.")).toEqual({ ok: true });
    expect(checkGloss("I have _____ idea.", "Tôi có ___ ý tưởng.").ok).toBe(false);
    expect(checkGloss("I have _____ idea.", "Tôi có một ý tưởng.").ok).toBe(false);
  });
  it("rejects text without Vietnamese, with markup, or of absurd length", () => {
    expect(checkGloss("He goes home.", "He goes home.").ok).toBe(false);
    expect(checkGloss("He goes home.", "Anh ấy <b>về</b> nhà.").ok).toBe(false);
    expect(checkGloss("He goes home every single day after work.", "Ừ.").ok).toBe(false);
  });
  it("accepts a normal translation", () => {
    expect(checkGloss("He goes home.", "Anh ấy về nhà.")).toEqual({ ok: true });
  });
});

describe("stemGlossTarget", () => {
  it("skips a stem that is only blanks", () => {
    expect(stemGlossTarget("_____", null)).toBeNull();
    expect(stemGlossTarget("___", null)).toBeNull();
  });
  it("targets a fill-in-the-blank sentence whole", () => {
    expect(stemGlossTarget("I have _____ idea.", null)).toBe("I have _____ idea.");
  });
  it("targets only the sentence of a hybrid stem (id 1731)", () => {
    expect(
      stemGlossTarget(
        "Transfer this Active Voice sentence into the Passive one: Britain kept Napoleon on the island of Saint Helena.",
        "Chuyển câu Chủ động này sang câu Bị động: Britain kept Napoleon on the island of Saint Helena."
      )
    ).toBe("Britain kept Napoleon on the island of Saint Helena.");
  });
  it("skips an instruction stem that is already Vietnamese", () => {
    expect(stemGlossTarget("Place the adverb on the correct place in the sentence", "Đặt trạng từ vào đúng vị trí trong câu")).toBeNull();
  });
  it("targets only the quoted speech of a speaker-label stem", () => {
    expect(stemGlossTarget("Tracy: \"I'm driving to work now\".", null)).toBe("\"I'm driving to work now\".");
  });
});

describe("choiceGlossTargets", () => {
  it("keeps only choices that are sentences", () => {
    expect(choiceGlossTargets(["am", "is going", "He is a doctor.", "Darren was eating the chicken"])).toEqual([
      null,
      null,
      "He is a doctor.",
      "Darren was eating the chicken",
    ]);
  });
});
