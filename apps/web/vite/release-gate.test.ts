import { describe, expect, it } from "vitest";
// @ts-expect-error plain script with no type declarations
import { releaseProblems, signedRows } from "../scripts/release-gate.mjs";

const blank = "## Sign-off\n\n| Reviewer | Date | Rows checked |\n|---|---|---|\n| | | |\n| | | |\n";
const signed = "## Sign-off\n\n| Reviewer | Date | Rows checked |\n|---|---|---|\n| A. Reviewer | 2026-12-01 | all |\n";
const ok = { year: "2026-27", status: "verified", inVerifiedList: true, sourcesFile: null };

describe("release gate", () => {
  it("ignores an empty sign-off table and the header row", () => {
    expect(signedRows(blank)).toEqual([]);
    expect(signedRows(signed)).toHaveLength(1);
    expect(signedRows("no such section")).toEqual([]);
  });
  it("allows a release only when every year is verified, listed and signed", () => {
    expect(releaseProblems([ok, { ...ok, year: "2025-26", sourcesFile: signed }])).toEqual([]);
  });
  it("blocks a draft year, an unlisted year and an unsigned sources file", () => {
    expect(releaseProblems([ok, { year: "2025-26", status: "draft", inVerifiedList: false, sourcesFile: "**Status: DRAFT.**\n" + blank }])).toHaveLength(4);
  });
  it("blocks a year flipped to verified with no recorded sign-off", () => {
    const p = releaseProblems([{ ...ok, year: "2025-26", sourcesFile: blank }]);
    expect(p).toHaveLength(1);
    expect(p[0]).toContain("no reviewer and date");
  });
});
