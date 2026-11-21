import { describe, expect, it } from "vitest";
import { amountFromText, caretAfterFormat, formatFinal, formatWhileTyping, parseAmountParts } from "./currency.ts";

describe("amountFromText: the ways people write amounts", () => {
  it.each([
    ["30000", 30_000],
    ["R30 000", 30_000],
    ["R 30 000", 30_000],
    ["30,000.00", 30_000],
    ["30 000,50", 30_000.5],
    ["30,000", 30_000],
    ["1,234,567", 1_234_567],
    ["1.234,56", 1_234.56],
    ["1,234.56", 1_234.56],
    ["1.234.567", 1_234_567],
    ["12,5", 12.5],
    ["12.5", 12.5],
    ["0", 0],
    ["0,00", 0],
    ["007", 7],
    ["1234,567", 1_234_567], // one comma + exactly three digits reads as thousands, like "30,000"
    ["1234,56", 1_234.56],
    ["  R 8 250  ", 8_250],
  ])("%j → %s", (raw, expected) => {
    expect(amountFromText(raw)).toBe(expected);
  });

  it.each(["", "   ", "R", "abc", ",", "-"])("%j → no amount", (raw) => {
    expect(amountFromText(raw)).toBeNull();
  });

  it("keeps a minus sign so the form can say amounts can't be negative", () => {
    expect(amountFromText("-5000")).toBe(-5_000);
    expect(amountFromText("−5 000,50")).toBe(-5_000.5);
    expect(amountFromText("-0")).toBe(0);
  });

  it("ignores letters and symbols mixed into the number", () => {
    expect(amountFromText("R30k000")).toBe(30_000);
    expect(amountFromText("30 000 rand")).toBe(30_000);
  });

  it("caps very long numbers at 13 whole digits so they stay exact", () => {
    expect(parseAmountParts("123456789012345678").integer).toHaveLength(13);
  });
});

describe("formatWhileTyping", () => {
  it.each([
    ["3", "3"],
    ["30000", "30 000"],
    ["1234567", "1 234 567"],
    ["1234,5", "1 234,5"],
    ["1234.", "1 234,"],
    [",5", "0,5"],
    ["R30 000", "30 000"],
    ["-1200", "-1 200"],
    ["-", "-"],
    ["", ""],
    ["30,000.00", "30 000,00"],
  ])("%j → %j", (typed, shown) => {
    expect(formatWhileTyping(parseAmountParts(typed))).toBe(shown);
  });

  it("is stable: formatting formatted text changes nothing", () => {
    for (const shown of ["30 000", "1 234,5", "0,5", "-1 200", "12 345 678,90"]) {
      expect(formatWhileTyping(parseAmountParts(shown))).toBe(shown);
    }
  });
});

describe("formatFinal", () => {
  it.each([
    [30_000, "30 000,00"],
    [0, "0,00"],
    [1_234.5, "1 234,50"],
    [-250, "-250,00"],
    [177.12, "177,12"],
    [1_000_000, "1 000 000,00"],
  ])("%s → %s", (value, shown) => {
    expect(formatFinal(value)).toBe(shown);
  });

  it("shows nothing for numbers that aren't finite", () => {
    expect(formatFinal(Number.NaN)).toBe("");
  });

  it("round trips through the parser", () => {
    for (const v of [0, 1, 99.99, 1_234.56, 30_000, 8_250.5, 9_999_999.99]) {
      expect(amountFromText(formatFinal(v))).toBe(v);
    }
  });
});

describe("caretAfterFormat", () => {
  it("follows the end of the text when typing at the end", () => {
    expect(caretAfterFormat("30000", 5, "30 000")).toBe(6);
  });

  it("keeps the cursor beside the same digit when a space appears before it", () => {
    // "1234" with the cursor after "12" (position 2), reformatted as "1 234": after the "2".
    expect(caretAfterFormat("1234", 2, "1 234")).toBe(3);
  });

  it("keeps the cursor beside the same digit when a space disappears", () => {
    // "1 23" → user deletes one digit elsewhere, cursor after the 1: "123", position 1.
    expect(caretAfterFormat("1 23", 1, "123")).toBe(1);
  });

  it("puts the cursor at the start when nothing precedes it", () => {
    expect(caretAfterFormat("12345", 0, "12 345")).toBe(0);
    expect(caretAfterFormat("-12345", 1, "-12 345")).toBe(1);
  });
});
