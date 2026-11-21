import { describe, expect, it } from "vitest";
import { formatDate, formatPercent, formatPercentPoints, formatRand } from "./format.ts";

describe("formatDate", () => {
  it.each([
    ["2026-03-01", "1 March 2026"],
    ["2027-02-28", "28 February 2027"],
    ["2026-11-18", "18 November 2026"],
    ["not a date", "not a date"],
    ["2026-13-01", "2026-13-01"],
  ])("%s → %s", (iso, expected) => {
    expect(formatDate(iso)).toBe(expected);
  });
});

const s = (text: string) => text.replace(/ /g, " ");

describe("formatRand", () => {
  it.each([
    [30_000, "R 30 000,00"],
    [1_234.56, "R 1 234,56"],
    [177.12, "R 177,12"],
    [0, "R 0,00"],
    [1_878_600, "R 1 878 600,00"],
    [0.005, "R 0,01"],
    [-4_681, "−R 4 681,00"],
  ])("%s → %s", (value, expected) => {
    expect(s(formatRand(value))).toBe(expected);
  });

  it("can drop cents", () => {
    expect(s(formatRand(245_100, { decimals: 0 }))).toBe("R 245 100");
  });

  it("uses non-breaking spaces so amounts never wrap", () => {
    expect(formatRand(30_000)).not.toContain(" ");
  });

  it("handles non-finite values safely", () => {
    expect(s(formatRand(Number.NaN))).toBe("R 0,00");
  });
});

describe("formatPercentPoints", () => {
  it.each([
    [11.1, "11,1%"],
    [0, "0%"],
    [5, "5%"],
    [12.34, "12,3%"],
    [Number.NaN, "0%"],
  ])("%s → %s", (points, expected) => {
    expect(formatPercentPoints(points)).toBe(expected);
  });
});

describe("formatPercent", () => {
  it.each([
    [0.26, "26%"],
    [0.45, "45%"],
    [0, "0%"],
    [0.156034, "15,6%"],
  ])("%s → %s", (rate, expected) => {
    expect(formatPercent(rate)).toBe(expected);
  });
});
