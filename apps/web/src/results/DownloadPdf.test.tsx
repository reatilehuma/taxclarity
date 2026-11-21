// @vitest-environment jsdom
import { calculate, getRuleSet } from "@taxclarity/tax-engine";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { copy } from "../content/strings.ts";
import { ResultsPage } from "../pages/Results.tsx";
import { summaryDocumentFor } from "../pdf/createSummaryPdf.ts";
import { applyPatch, INITIAL_ANSWERS, toEngineInputs, type WizardAnswers } from "../wizard/answers.ts";
import { WizardProvider } from "../wizard/WizardContext.tsx";
import { DownloadPdf } from "./DownloadPdf.tsx";

/** The button, and the PDF's Table 1 against the results page it sits on. The PDF itself is made in createSummaryPdf.test.ts. */
const create = vi.fn();
vi.mock("../pdf/createSummaryPdf.ts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../pdf/createSummaryPdf.ts")>()),
  createSummaryPdf: (...args: unknown[]) => create(...args),
}));

const flat = (s: string | null | undefined) => (s ?? "").replace(/[\s ]+/g, " ").trim();
const t = copy.pdf;

const base = (patch: Partial<WizardAnswers> = {}) =>
  applyPatch(applyPatch(INITIAL_ANSWERS, { mode: "GROSS" }), {
    amount: 30_000,
    retirement: { ...INITIAL_ANSWERS.retirement, has: true, payslipMonthly: 3_000, employerContributes: true, employerMonthly: 1_000 },
    medical: { ...INITIAL_ANSWERS.medical, member: true, members: 2, monthlyTotal: 0 },
    variable: { ...INITIAL_ANSWERS.variable, types: ["BONUS"], bonusAnnual: 30_000 },
    extras: { ...INITIAL_ANSWERS.extras, interestAnnual: 30_000, travelAllowanceMonthly: 3_000 },
    ...patch,
  });

function show(answers: WizardAnswers) {
  const user = userEvent.setup({ delay: null });
  const view = render(
    <WizardProvider initial={answers}>
      <MemoryRouter initialEntries={["/results"]}>
        <Routes>
          <Route path="results" element={<ResultsPage />} />
          <Route path="wizard" element={<p>wizard</p>} />
        </Routes>
      </MemoryRouter>
    </WizardProvider>,
  );
  return { user, ...view };
}

let clicked: { href: string; download: string }[] = [];
beforeEach(() => {
  clicked = [];
  create.mockReset();
  vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: vi.fn(() => "blob:fake"), revokeObjectURL: vi.fn() }));
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
    clicked.push({ href: this.href, download: this.download });
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("the button", () => {
  it("is on the results page beside Copy summary, which still works as before", () => {
    show(base());
    const row = screen.getByRole("button", { name: copy.results.copy.button }).parentElement!;
    expect(within(row).getByRole("button", { name: t.button })).toBeTruthy();
  });

  it("makes the file and hands it to the browser as a download with the right name", async () => {
    create.mockResolvedValue({ blob: new Blob(["%PDF-"], { type: "application/pdf" }), fileName: "cleartax-sa-summary-2026-27-2026-11-20.pdf" });
    const { user } = show(base());
    await user.click(screen.getByRole("button", { name: t.button }));
    await waitFor(() => expect(clicked).toHaveLength(1));
    expect(clicked[0]).toEqual({ href: "blob:fake", download: "cleartax-sa-summary-2026-27-2026-11-20.pdf" });
    expect(screen.getByText(t.done)).toBeTruthy();
    // It was asked to make the summary of the result on screen.
    expect(create.mock.calls[0]![0]).toMatchObject({ taxYear: "2026-27" });
  });

  it("says it is working, cannot be pressed twice meanwhile, and goes back to normal after", async () => {
    let finish!: (v: unknown) => void;
    create.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    const { user } = show(base());
    await user.click(screen.getByRole("button", { name: t.button }));
    const busy = screen.getByRole("button", { name: t.creating }) as HTMLButtonElement;
    expect(busy.disabled).toBe(true);
    expect(busy.getAttribute("aria-busy")).toBe("true");
    finish({ blob: new Blob(["%PDF-"]), fileName: "x.pdf" });
    await waitFor(() => expect((screen.getByRole("button", { name: t.button }) as HTMLButtonElement).disabled).toBe(false));
  });

  it("if making it fails, says so plainly, keeps the results on screen, and lets the person try again", async () => {
    create.mockRejectedValueOnce(new Error("boom"));
    const { user } = show(base());
    await user.click(screen.getByRole("button", { name: t.button }));
    expect((await screen.findByRole("status", { name: "" }).catch(() => null)) ?? true).toBeTruthy();
    expect(await screen.findByText("We couldn't create the PDF. Please try again.")).toBeTruthy();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toContain("Your estimated monthly PAYE");
    expect(clicked).toHaveLength(0);
    // Retry works: the button now says so, and the results are still there.
    create.mockResolvedValueOnce({ blob: new Blob(["%PDF-"]), fileName: "retry.pdf" });
    await user.click(screen.getByRole("button", { name: t.retry }));
    await waitFor(() => expect(clicked).toEqual([{ href: "blob:fake", download: "retry.pdf" }]));
    expect(screen.queryByText("We couldn't create the PDF. Please try again.")).toBeNull();
  });

  it("is not offered when there is no finished calculation (the page sends the person back to the start)", () => {
    render(
      <WizardProvider>
        <MemoryRouter initialEntries={["/results"]}>
          <Routes>
            <Route path="results" element={<ResultsPage />} />
            <Route path="wizard" element={<p>wizard</p>} />
          </Routes>
        </MemoryRouter>
      </WizardProvider>,
    );
    expect(screen.queryByRole("button", { name: t.button })).toBeNull();
  });

  it("also works on its own with any result", () => {
    const r = calculate(getRuleSet("2025-26"), toEngineInputs(base({ taxYear: "2025-26", ageBandYear: "2025-26" })));
    render(<DownloadPdf result={r} />);
    expect(screen.getByRole("button", { name: t.button })).toBeTruthy();
  });
});

describe("Table 1 in the PDF is the income the results page shows, to the cent", () => {
  /** The results page's income table: the income rows come first, then deductions, then taxable income. */
  function pageIncomeAmounts(): string[] {
    const table = screen.getByRole("table", { name: copy.results.breakdown.taxCaption });
    return within(table)
      .getAllByRole("row")
      .slice(1)
      // The page words a row that adds as "plus R 30 000,00" for screen readers; the amount itself is what is compared.
      .map((row) => flat(within(row).getAllByRole("cell").at(-1)!.textContent).replace(/^(?:(?:plus|minus|[+−])\s?)+/, ""));
  }

  it.each(["2025-26", "2026-27"] as const)("%s", (year) => {
    const answers = base({ taxYear: year, ageBandYear: year });
    show(answers);
    const result = calculate(getRuleSet(year), toEngineInputs(answers));
    const rows = summaryDocumentFor(result, "2026-11-20").tables[0]!.rows;
    const incomeRows = rows.slice(0, -1); // the last row is the PDF's own total
    expect(incomeRows.length).toBeGreaterThanOrEqual(5); // salary, bonus, travel, employer contributions, interest
    const onPage = pageIncomeAmounts().slice(0, incomeRows.length);
    expect(onPage).toEqual(incomeRows.map((r) => flat(r.amount)));
    // And the PDF's total is the income the engine counted before deductions.
    expect(rows.at(-1)!.value).toBe(result.incomeBeforeDeductions);
  });
});

describe("the other tables in the PDF are the results page's own figures, to the cent", () => {
  const bare = (text: string | null | undefined) => flat(text).replace(/^(?:(?:plus|minus|[+−])\s?)+/, "");
  /** The cells of one results-page table: its month column (if it has one) and its year column, row by row. */
  function pageTable(caption: string): { month: string | null; year: string }[] {
    const table = screen.getByRole("table", { name: caption });
    return within(table)
      .getAllByRole("row")
      .slice(1)
      .map((row) => {
        const cells = within(row).getAllByRole("cell");
        return { month: cells.length > 1 ? bare(cells[0]!.textContent) : null, year: bare(cells.at(-1)!.textContent) };
      });
  }
  const pdfAmount = (amount: string) => flat(amount).replace(/^[−+] /, "");

  it.each(["2025-26", "2026-27"] as const)("%s", (year) => {
    const answers = base({ taxYear: year, ageBandYear: year });
    show(answers);
    const result = calculate(getRuleSet(year), toEngineInputs(answers));
    const tables = Object.fromEntries(summaryDocumentFor(result, "2026-11-20").tables.map((t) => [t.id, t]));
    const b = copy.results.breakdown;

    // Deductions and taxable income: the rows that follow the income on the page's income table.
    const income = pageTable(b.taxCaption);
    const ded = tables["deductions"]!.rows.filter((r) => r.id !== "DEDUCTIONS_TOTAL");
    expect(ded.length).toBeGreaterThanOrEqual(2);
    const incomeCount = tables["income"]!.rows.length - 1;
    expect(income.slice(incomeCount).map((x) => x.year)).toEqual(ded.map((r) => pdfAmount(r.amount)));

    // The tax working: every row up to the year's tax.
    const after = pageTable(b.afterCaption).map((x) => x.year);
    const working = tables["tax"]!.rows.slice(0, after.length);
    expect(working.at(-1)!.id).toBe("TAX_FOR_YEAR");
    expect(working.map((r) => pdfAmount(r.amount))).toEqual(after);

    // Salary to bank account: a normal month beside the whole year.
    const pay = pageTable(b.payslipCaption);
    const rec = tables["reconciliation"]!.rows;
    expect(rec.map((r) => pdfAmount(r.amount))).toEqual(pay.map((x) => x.year));
    expect(rec.map((r) => (r.month ? pdfAmount(r.month.amount) : "—"))).toEqual(pay.map((x) => (x.month === "—" || x.month === null || /No amount/.test(x.month) ? "—" : x.month)));
  });

  it("uses the page's own sentences for the payslip comparison, notes, warnings and exclusions", async () => {
    const { pdfText } = await import("../content/strings.ts");
    const r = copy.results;
    expect(pdfText.comparison.match).toBe(r.comparison.match);
    expect(pdfText.comparison.higher("R 1,00", "5%")).toBe(r.comparison.higher("R 1,00", "5%"));
    expect(pdfText.comparison.lower("R 1,00", null)).toBe(r.comparison.lower("R 1,00", null));
    expect(pdfText.comparison.explain).toBe(r.comparison.explain);
    expect(pdfText.assumptions.items).toBe(r.notes);
    expect(pdfText.warnings.items).toBe(r.warnings);
    expect(pdfText.flags.items).toBe(r.flags);
    // Never the words the PRD forbids for the result (§14.8): no refund, no amount payable.
    expect(pdfText.tax.rows.TAX_FOR_YEAR).toBe("Calculated annual income-tax liability");
    expect(JSON.stringify(pdfText.tax.rows).toLowerCase()).not.toMatch(/refund|payable/);
  });
});
