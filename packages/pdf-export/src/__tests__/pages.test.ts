import { calculate, getRuleSet, type CalculationInputs, type CalculationResult } from "@taxclarity/tax-engine";
import { describe, expect, it } from "vitest";
import { buildSummaryDocument } from "../build.ts";
import { renderSummaryPdf } from "../render.ts";
import { readPdf, type ReadPage } from "../testing.ts";
import type { SummaryDocument } from "../types.ts";
import { FONTS, FORMAT, SOURCE, TEXT } from "./fixtures.ts";

type Year = "2025-26" | "2026-27";
const flat = (s: string) => s.replace(/[\s ]+/g, " ");

/** Every extra filled in, payslip mode, a second job and a debit-order medical aid: the fullest summary the app can make. */
const everything = (year: Year, extra: Partial<CalculationInputs> = {}): CalculationResult =>
  calculate(getRuleSet(year), {
    taxYear: year,
    mode: "PAYSLIP",
    amount: 45_000,
    payslip: { payeMonthly: 9_000 },
    ageBand: "AGE_65_74",
    retirement: { ownMonthly: 3_000, employerMonthly: 1_000, privateRaMonthly: 1_500 },
    medical: { member: true, members: 3, monthlyContribution: 4_000, paidBy: "SELF", outOfPocketAnnual: 12_000, ownSharePaidVia: "DEBIT_ORDER" },
    variablePay: { bonusAnnual: 30_000, overtimeAnnual: 6_000 },
    advanced: { localInterestAnnual: 30_000, travelAllowanceMonthly: 3_000, donations18AAnnual: 5_000, has18AReceipt: true, hasSecondEmployer: true, secondEmployerAnnualGross: 120_000 },
    ...extra,
  });
const docFor = (r: CalculationResult): SummaryDocument => buildSummaryDocument({ result: r, text: TEXT, format: FORMAT, source: SOURCE, generatedOn: "2026-11-20" });

const SIDE = 38; // the page margin is 40: nothing may sit outside it, give or take rounding
const MIN_SIZE = 7.5; // points: smaller than this is not comfortable to read on paper

/** Every piece of text must be on the page, inside the margins, readable, and clear of every other piece. */
function expectTidy(pages: ReadPage[]): void {
  pages.forEach((page, n) => {
    for (const b of page.boxes) {
      expect(b.x, `p${n + 1} "${b.str}" left`).toBeGreaterThanOrEqual(SIDE);
      expect(b.x + b.width, `p${n + 1} "${b.str}" right`).toBeLessThanOrEqual(page.width - SIDE + 1);
      expect(b.y, `p${n + 1} "${b.str}" bottom`).toBeGreaterThan(10);
      expect(b.y + b.height, `p${n + 1} "${b.str}" top`).toBeLessThan(page.height);
      expect(b.height, `p${n + 1} "${b.str}" size`).toBeGreaterThanOrEqual(MIN_SIZE);
    }
    // No two pieces of text may overlap: compare each pair, shrinking the boxes a little so touching lines do not count.
    const inner = page.boxes.map((b) => ({ ...b, top: b.y + b.height * 0.8, bottom: b.y + b.height * 0.1, right: b.x + b.width - 0.5, left: b.x + 0.5 }));
    for (let i = 0; i < inner.length; i++) {
      for (let j = i + 1; j < inner.length; j++) {
        const a = inner[i]!;
        const b = inner[j]!;
        const overlap = a.left < b.right && b.left < a.right && a.bottom < b.top && b.bottom < a.top;
        expect(overlap, `p${n + 1}: "${a.str}" overlaps "${b.str}"`).toBe(false);
      }
    }
  });
}

/** Finds each wanted piece after the one before it: the page reads in the order of the document. */
function expectInOrder(text: string, pieces: string[]): void {
  let from = 0;
  for (const piece of pieces) {
    const at = text.indexOf(flat(piece), from);
    expect(at, `"${piece}" is missing or out of order`).toBeGreaterThanOrEqual(0);
    from = at + flat(piece).length;
  }
}

describe.each<Year>(["2025-26", "2026-27"])("the full summary, %s", (year) => {
  it("has every row of every table, in the order of the document", async () => {
    const doc = docFor(everything(year));
    const pdf = await readPdf(await renderSummaryPdf(doc, FONTS));
    const text = flat(pdf.pages.map((p) => p.text).join(" "));
    const pieces = [
      doc.productName,
      doc.title,
      doc.details.heading,
      ...doc.details.rows.flatMap((x) => [x.label, x.value]),
      ...doc.tables.flatMap((t) => [
        t.heading,
        ...t.rows.flatMap((x) => [x.label, ...(x.month ? [x.month.amount] : []), x.amount]),
        ...t.notes,
        ...(t.id === "comparison" && doc.comparisonVerdict ? [doc.comparisonVerdict.verdict, doc.comparisonVerdict.explain] : []),
      ]),
      ...doc.notices.flatMap((n) => [n.heading, ...n.items.flatMap((i) => [...(i.title ? [i.title] : []), i.body, ...(i.source ? [i.source] : [])])]),
      doc.disclaimer.heading,
      doc.disclaimer.paragraph,
    ];
    expectInOrder(text, pieces);
  });

  it("runs onto more than one page with nothing overlapping, clipped or too small", async () => {
    const pdf = await readPdf(await renderSummaryPdf(docFor(everything(year)), FONTS));
    expect(pdf.pages.length).toBeGreaterThanOrEqual(2);
    expectTidy(pdf.pages);
    pdf.pages.forEach((p, i) => expect(flat(p.text)).toContain(`Page ${i + 1} of ${pdf.pages.length}`));
  });

  it("a plain salary is a tidy summary too", async () => {
    const pdf = await readPdf(await renderSummaryPdf(docFor(calculate(getRuleSet(year), { taxYear: year, mode: "GROSS", amount: 30_000, ageBand: "UNDER_65" })), FONTS));
    expectTidy(pdf.pages);
  });
});

describe("a long summary", () => {
  it("repeats a table's heading on each page it runs onto, and never splits a row", async () => {
    const doc = docFor(everything("2026-27"));
    // Make the exclusions list long enough that it has to break across pages.
    const flags = doc.notices.find((n) => n.id === "flags")!;
    flags.items = [...flags.items, ...flags.items, ...flags.items].map((it, i) => ({ ...it, title: `${it.title} #${i + 1}` }));
    const pdf = await readPdf(await renderSummaryPdf(doc, FONTS));
    const holding = pdf.pages.filter((p) => flat(p.text).includes(flat(flags.heading)));
    expect(holding.length).toBeGreaterThanOrEqual(2); // the bar repeats on each page the table runs onto
    expectTidy(pdf.pages);
    // Every item is whole: its title, text and source sit together on one page.
    for (const it of flags.items) {
      const page = pdf.pages.find((p) => flat(p.text).includes(flat(it.title!)))!;
      expect(flat(page.text), it.title).toContain(flat(it.body));
      expect(flat(page.text), it.title).toContain(flat(it.source!));
    }
  });

  it("the disclaimer and the footer come last, and the footer is on every page", async () => {
    const pdf = await readPdf(await renderSummaryPdf(docFor(everything("2026-27")), FONTS));
    const last = flat(pdf.pages.at(-1)!.text);
    expect(last).toContain(flat(TEXT.disclaimer.paragraph));
    for (const p of pdf.pages) expect(flat(p.text)).toContain("figures last checked");
  });
});
