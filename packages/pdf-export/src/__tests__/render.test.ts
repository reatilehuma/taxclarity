import { calculate, getRuleSet } from "@taxclarity/tax-engine";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildSummaryDocument } from "../build.ts";
import { renderSummaryPdf, toDocDefinition } from "../render.ts";
import { readPdf } from "../testing.ts";
import { FONTS, FORMAT, SOURCE, TEXT } from "./fixtures.ts";

afterEach(() => vi.restoreAllMocks());

const flat = (s: string) => s.replace(/[\s\u00a0]+/g, " ");
const result = (year: "2025-26" | "2026-27", extra = {}) =>
  calculate(getRuleSet(year), {
    taxYear: year,
    mode: "GROSS",
    amount: 30_000,
    ageBand: "UNDER_65",
    retirement: { ownMonthly: 3_000, employerMonthly: 1_000 },
    medical: { member: true, members: 2, monthlyContribution: 0, paidBy: "SELF" },
    variablePay: { bonusAnnual: 30_000 },
    advanced: { localInterestAnnual: 30_000, travelAllowanceMonthly: 3_000 },
    ...extra,
  });
const render = (r: ReturnType<typeof result>) => {
  const doc = buildSummaryDocument({ result: r, text: TEXT, format: FORMAT, source: SOURCE, generatedOn: "2026-11-20" });
  return { doc, bytes: renderSummaryPdf(doc, FONTS) };
};

describe("the PDF, read back as a reader would see it", () => {
  it.each(["2025-26", "2026-27"] as const)("%s: A4 pages with real, searchable text for every part of the summary", async (year) => {
    const r = result(year);
    const { doc, bytes } = render(r);
    const pdf = await readPdf(await bytes);
    for (const page of pdf.pages) {
      expect(Math.round(page.width)).toBe(595); // A4 portrait
      expect(Math.round(page.height)).toBe(842);
    }
    const text = flat(pdf.pages.map((p) => p.text).join(" "));
    const must = [
      TEXT.productName,
      TEXT.title,
      TEXT.subtitle,
      TEXT.detailsHeading,
      TEXT.income.heading,
      TEXT.columns.description,
      TEXT.columns.amount,
      TEXT.disclaimer.heading,
      `Page 1 of ${pdf.pages.length}`,
      ...doc.details.rows.flatMap((x) => [x.label, x.value]),
      ...doc.tables.flatMap((t) => [t.heading, ...t.rows.flatMap((x) => [x.label, flat(x.amount)])]),
      doc.footer.rules,
    ];
    for (const piece of must) expect(text, piece).toContain(flat(piece));
    // The disclaimer, in full.
    expect(text).toContain(flat(TEXT.disclaimer.paragraph));
    // The year on the page is the year of the result, and no other.
    expect(text).toContain(year.replace("-", "/"));
    expect(text).not.toContain(year === "2026-27" ? "2025/26" : "2026/27");
  });

  it("every amount on the page is the engine's figure, to the cent", async () => {
    const r = result("2026-27");
    const pdf = await readPdf(await render(r).bytes);
    const text = flat(pdf.pages.map((p) => p.text).join(" "));
    for (const n of [r.grossAnnual, r.variablePay.totalAnnual, r.travel.taxableAnnual, r.incomeBeforeDeductions]) {
      expect(text, String(n)).toContain(flat(FORMAT.rand(n)));
    }
  });

  it("uses the embedded tabular Inter, not a stand-in", async () => {
    const pdf = await readPdf(await render(result("2026-27")).bytes);
    expect(pdf.raw).toMatch(/\/FontName \/[A-Z]{6}\+InterTabular-Regular/);
    expect(pdf.raw).toMatch(/\/FontName \/[A-Z]{6}\+InterTabular-Bold/);
    expect(pdf.raw).not.toMatch(/\/BaseFont \/Helvetica|\/BaseFont \/Roboto/);
  });

  it("is tagged for assistive technology and names its language", async () => {
    const pdf = await readPdf(await render(result("2026-27")).bytes);
    expect(pdf.raw).toContain("/StructTreeRoot");
    expect(pdf.raw).toContain("/MarkInfo");
    expect(pdf.raw).toMatch(/\/Lang \(en-ZA\)/);
  });

  it("the file's own metadata holds only the app name, the title and the day it was made", async () => {
    const pdf = await readPdf(await render(result("2026-27")).bytes);
    expect(pdf.info["Title"]).toBe(TEXT.title);
    expect(pdf.info["Creator"]).toBe("ClearTax SA");
    expect(pdf.info["Producer"]).toBe("ClearTax SA");
    for (const key of ["Author", "Subject", "Keywords"]) expect(pdf.info[key] ?? "", key).toBe("");
    expect(String(pdf.info["CreationDate"])).toMatch(/^D:\d{14}/);
    // Nothing else is there: no author, no subject, no keywords, no custom field, and none of the person's amounts.
    const technical = ["PDFFormatVersion", "Language", "EncryptFilterName", "IsLinearized", "IsAcroFormPresent", "IsXFAPresent", "IsCollectionPresent", "IsSignaturesPresent"];
    expect(Object.keys(pdf.info).filter((k) => !technical.includes(k)).sort()).toEqual(["CreationDate", "Creator", "Producer", "Title"]);
    const r = result("2026-27");
    for (const n of [r.grossAnnual, r.takeHomeMonthly, r.monthlyPaye, r.annualLiability]) {
      expect(JSON.stringify(pdf.info).replace(/\s/g, ""), String(n)).not.toContain(String(Math.round(n)));
    }
  });

  it("makes no network request while drawing", async () => {
    const fetchSpy = vi.fn(() => Promise.reject(new Error("the network must not be used")));
    vi.stubGlobal("fetch", fetchSpy);
    const pdf = await readPdf(await render(result("2026-27")).bytes);
    expect(pdf.pages.length).toBeGreaterThan(0);
    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("a table row is never split and its heading repeats if the table runs onto another page", () => {
    const def = toDocDefinition(render(result("2026-27")).doc);
    const tables = (def.content as { table?: { headerRows?: number; keepWithHeaderRows?: number; dontBreakRows?: boolean } }[]).filter((c) => c.table?.dontBreakRows);
    expect(tables.length).toBeGreaterThan(4);
    for (const t of tables) {
      expect(t.table?.headerRows, "headings repeat").toBeGreaterThanOrEqual(1);
      expect(t.table?.keepWithHeaderRows, "never left alone at a page foot").toBe(1);
    }
  });
});
