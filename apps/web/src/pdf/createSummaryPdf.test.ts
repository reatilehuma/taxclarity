// @vitest-environment node
import { readPdf } from "@taxclarity/pdf-export/testing";
import { calculate, getRuleSet, type CalculationInputs } from "@taxclarity/tax-engine";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { pdfText } from "../content/strings.ts";
import { createSummaryPdf, summaryDocumentFor, todayIso } from "./createSummaryPdf.ts";

/** The real adapter, the real renderer and the real fonts; only the network is replaced by the files on disk. */
const FONT_DIR = new URL("../../../../packages/pdf-export/fonts/", import.meta.url);
function serveFontsFromDisk() {
  const fetchSpy = vi.fn(async (url: string | URL | Request) => {
    const name = String(url).match(/InterTabular-(400|700)/)?.[0];
    if (!name) return new Response("not found", { status: 404 });
    return new Response(readFileSync(new URL(`${name}.ttf`, FONT_DIR)));
  });
  vi.stubGlobal("fetch", fetchSpy);
  return fetchSpy;
}
afterEach(() => vi.unstubAllGlobals());

const inputs = (year: "2025-26" | "2026-27", extra: Partial<CalculationInputs> = {}): CalculationInputs => ({
  taxYear: year,
  mode: "GROSS",
  amount: 30_000,
  ageBand: "UNDER_65",
  retirement: { ownMonthly: 3_000, employerMonthly: 1_000 },
  medical: { member: true, members: 2, monthlyContribution: 0, paidBy: "SELF" },
  variablePay: { bonusAnnual: 30_000 },
  advanced: { localInterestAnnual: 30_000 },
  ...extra,
});
const flat = (s: string) => s.replace(/[\s ]+/g, " ");

describe("the date on the page", () => {
  it("is the person's own day, written as an ISO date", () => {
    expect(todayIso(new Date(2026, 10, 20, 23, 59))).toBe("2026-11-20");
    expect(todayIso(new Date(2027, 0, 5))).toBe("2027-01-05");
  });
});

describe.each(["2025-26", "2026-27"] as const)("createSummaryPdf, %s", (year) => {
  const result = () => calculate(getRuleSet(year), inputs(year));

  it("makes a real PDF, named for the year and the day, whose text is the app's own wording and figures", async () => {
    serveFontsFromDisk();
    const r = result();
    const { blob, fileName } = await createSummaryPdf(r, "2026-11-20");
    expect(fileName).toBe(`cleartax-sa-summary-${year}-2026-11-20.pdf`);
    expect(blob.type).toBe("application/pdf");
    const pdf = await readPdf(new Uint8Array(await blob.arrayBuffer()));
    const text = flat(pdf.pages.map((p) => p.text).join(" "));
    const d = pdfText;
    for (const piece of [d.title, d.subtitle, d.income.heading, d.deductions.heading, d.tax.heading, d.reconciliation.heading, d.disclaimer.heading, d.disclaimer.paragraph, `Page 1 of ${pdf.pages.length}`, year.replace("-", "/")]) {
      expect(text, piece).toContain(flat(piece));
    }
    // Every row of every table is on the page, with the same amount the results page shows.
    for (const table of summaryDocumentFor(r, "2026-11-20").tables) {
      for (const row of table.rows) {
        expect(text, row.label).toContain(flat(row.label));
        expect(text, row.amount).toContain(flat(row.amount));
      }
    }
    // The exclusions link to this year's sources, written out as text.
    expect(text).toContain("sars.gov.za");
  });

  it("downloads only the two font files, from this site, and nothing else", async () => {
    const spy = serveFontsFromDisk();
    await createSummaryPdf(result(), "2026-11-20");
    const urls = spy.mock.calls.map((c) => String(c[0]));
    expect(urls).toHaveLength(2);
    for (const u of urls) expect(u).toMatch(/InterTabular-(400|700)\.ttf/);
    for (const u of urls) expect(u.startsWith("http")).toBe(false); // the app's own address, not another site
  });
});

describe("when something goes wrong", () => {
  it("a font that cannot be loaded is an error the caller can show, not a broken file", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 404 })));
    await expect(createSummaryPdf(calculate(getRuleSet("2026-27"), inputs("2026-27")), "2026-11-20")).rejects.toThrow(/font/);
  });
});
