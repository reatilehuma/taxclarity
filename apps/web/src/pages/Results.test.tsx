// @vitest-environment jsdom
import { buildBreakdown, buildExplanations, buildRecommendations, CurrentTaxRules as rules } from "@taxclarity/tax-engine";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import fc from "fast-check";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { copy } from "../content/strings.ts";
import { formatRand } from "../lib/format.ts";
import { SOURCES } from "../lib/sources.ts";
import { applyPatch, INITIAL_ANSWERS, toEngineInputs, type WizardAnswers } from "../wizard/answers.ts";
import { calculate, WizardProvider } from "../wizard/WizardContext.tsx";
import { ResultsPage } from "./Results.tsx";

afterEach(cleanup);

const t = copy.results;
const b = t.breakdown;
const flat = (s: string | null) => (s ?? "").replace(/\s+/g, " ").trim();
const rand = (n: number) => flat(formatRand(n));

function Where() {
  const l = useLocation();
  return <p data-testid="where">{l.pathname + l.search}</p>;
}

function show(a: WizardAnswers) {
  const user = userEvent.setup({ delay: null });
  const view = render(
    <WizardProvider initial={a}>
      <MemoryRouter initialEntries={["/results"]}>
        <Where />
        <Routes>
          <Route path="results" element={<ResultsPage />} />
          <Route path="wizard" element={<p>wizard</p>} />
        </Routes>
      </MemoryRouter>
    </WizardProvider>,
  );
  return { user, ...view };
}

const base = (mode: WizardAnswers["mode"], amount: number, patch: Partial<WizardAnswers> = {}) =>
  applyPatch(applyPatch(INITIAL_ANSWERS, { mode }), { amount, ...patch });

/** T1: gross R30 000, pension R3 000 a month, a two-person medical aid with nothing to pay. */
const T1 = base("GROSS", 30_000, {
  retirement: { ...INITIAL_ANSWERS.retirement, has: true, payslipMonthly: 3_000 },
  medical: { ...INITIAL_ANSWERS.medical, member: true, members: 2, monthlyTotal: 0 },
});
const engine = (a: WizardAnswers) => calculate(toEngineInputs(a));
const tableByCaption = (caption: string) => within(screen.getByRole("table", { name: caption }));

/**
 * Reads the money in a cell, in cents. A leading minus sign (a line that comes off, or a negative
 * total) makes it negative. A cell with no amount ("—") is null.
 */
function cents(cell: HTMLElement): number | null {
  const text = (cell.textContent ?? "").replace(/s/g, "");
  if (!/[0-9]/.test(text)) return null;
  const n = Math.round(Number(text.replace(/[^0-9,]/g, "").replace(",", ".")) * 100);
  return text.startsWith("−") ? -n : n;
}

describe("results page: T1", () => {
  it("headline sentence, badge, tax year", () => {
    show(T1);
    const h1 = screen.getByRole("heading", { level: 1 });
    expect(flat(h1.textContent)).toBe("Your estimated monthly PAYE is R 3 149,00, and your take-home salary is R 23 673,88.");
    expect(screen.getByText(copy.common.payslipAccurate)).toBeTruthy();
    expect(screen.getByText(/2026\/27 tax year · 1 March 2026 – 28 February 2027/)).toBeTruthy();
  });

  it("gross-to-net table: the rows in PRD order, with monthly and annual columns", () => {
    show(T1);
    const table = screen.getByRole("table", { name: b.payslipCaption });
    const labels = within(table)
      .getAllByRole("rowheader")
      .map((h) => flat(h.textContent).replace(/About .*$/, "").trim());
    expect(labels).toEqual([
      b.rows.GROSS.label,
      b.rows.RETIREMENT_OWN.label,
      b.rows.PAYE.label,
      b.rows.UIF.label,
      b.rows.TAKE_HOME.label,
    ]);
    const paye = within(table).getByRole("row", { name: new RegExp(b.rows.PAYE.label.replace(/[()]/g, "\\$&")) });
    expect(flat(paye.textContent)).toContain(rand(3_149));
    const takeHome = within(table).getByRole("row", { name: new RegExp(b.rows.TAKE_HOME.label) });
    expect(flat(takeHome.textContent)).toContain(rand(23_673.88));
  });

  it("every row of every table has an explanation", () => {
    show(T1);
    for (const table of screen.getAllByRole("table")) {
      const rows = within(table).queryAllByRole("rowheader");
      for (const row of rows) {
        // The bracket table's rows are brackets, not lines with tooltips.
        if (table.closest("[aria-label]")?.getAttribute("aria-label") === b.bracketsCaption) continue;
        expect(within(row).getByRole("tooltip").textContent!.length).toBeGreaterThan(10);
      }
    }
  });

  it("taxable income and tax for the year are the engine's", () => {
    show(T1);
    const r = engine(T1);
    const income = tableByCaption(b.taxCaption);
    expect(flat(income.getByRole("row", { name: /Taxable income/ }).textContent)).toContain(rand(r.taxableIncome));
    const after = tableByCaption(b.afterCaption);
    expect(flat(after.getByRole("row", { name: /Your tax for the year/ }).textContent)).toContain(rand(r.annualLiability));
    expect(flat(after.getByRole("row", { name: /Medical aid credit/ }).textContent)).toContain(rand(r.medical6A.appliedAnnual));
  });

  it("bracket table is the engine's bracket walk, with one 'Your top bracket' tag", () => {
    show(T1);
    const r = engine(T1);
    const table = tableByCaption(b.bracketsCaption);
    const rows = table.getAllByRole("row").slice(1);
    expect(rows).toHaveLength(rules.brackets.length);
    r.bracketWalk.forEach((w, i) => {
      const text = flat(rows[i]!.textContent);
      expect(text).toContain(rand(w.amountInBracket));
      expect(text).toContain(rand(w.taxInBracket));
      expect(text).toContain(rand(w.runningTotal));
    });
    expect(table.getAllByText(copy.results.walk.topBracket)).toHaveLength(1);
    expect(flat(rows[r.bracketIndex]!.textContent)).toContain(copy.results.walk.topBracket);
  });

  it("has one h1 and h2 section headings, and no comparison panel without payslip figures", () => {
    show(T1);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getAllByRole("heading", { level: 2 }).length).toBeGreaterThanOrEqual(5);
    expect(screen.queryByText(t.comparison.heading)).toBeNull();
  });

  it("filing block: nothing to pay or claim when payroll got it right", () => {
    show(T1);
    const filing = tableByCaption(b.filingCaption);
    expect(filing.getByRole("row", { name: new RegExp(b.balance.even.label) })).toBeTruthy();
  });
});

describe("results page: buttons", () => {
  it("'Adjust my answers' goes to the review step", async () => {
    const { user } = show(T1);
    await user.click(screen.getByRole("link", { name: t.adjust }));
    expect(screen.getByTestId("where").textContent).toBe("/wizard?step=8");
  });

  it("'Start over' clears the answers and goes to the first step", async () => {
    const { user } = show(T1);
    await user.click(screen.getByRole("button", { name: t.startOver }));
    expect(screen.getByTestId("where").textContent).toBe("/wizard?step=0");
  });

  it("without answers it goes back to the start", () => {
    show(INITIAL_ANSWERS);
    expect(screen.getByTestId("where").textContent).toBe("/wizard?step=0");
  });
});

describe("results page: copy summary", () => {
  const stubClipboard = (writeText: (s: string) => Promise<void>) =>
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });

  it("copies the headline, key numbers and an estimate label, then says so", async () => {
    const write = vi.fn(async (_s: string) => {});
    const { user } = show(T1);
    stubClipboard(write); // after userEvent's own clipboard stand-in is installed
    await user.click(screen.getByRole("button", { name: t.copy.button }));
    expect(write).toHaveBeenCalledTimes(1);
    const text = write.mock.calls[0]![0].replace(/ /g, " ");
    expect(text).toContain("Your estimated monthly PAYE is R 3 149,00, and your take-home salary is R 23 673,88.");
    expect(text).toContain("Tax for the year: R 37 788,00");
    expect(text).toContain("2026/27");
    expect(text).toContain("Estimate only. Not tax advice, not a SARS assessment.");
    expect(await screen.findByText(t.copy.done)).toBeTruthy();
  });

  it("when the browser refuses, shows the text to select instead", async () => {
    const { user } = show(T1);
    stubClipboard(async () => {
      throw new Error("denied");
    });
    await user.click(screen.getByRole("button", { name: t.copy.button }));
    expect(await screen.findByText(t.copy.failed)).toBeTruthy();
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toContain("Estimate only");
  });

  it("sends nothing anywhere: no network calls happen on the results page", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const { user } = show(T1);
    stubClipboard(async () => {});
    await user.click(screen.getByRole("button", { name: t.copy.button }));
    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});

describe("results page: payslip comparison", () => {
  const withPayslip = (paye: number, uif: number | null = null) =>
    base("PAYSLIP", 30_000, {
      retirement: T1.retirement,
      medical: T1.medical,
      payslip: { paye, uif },
    });

  it("appears with payslip PAYE, and the headline switches to the payslip pattern", () => {
    show(withPayslip(3_149));
    expect(screen.getByRole("heading", { level: 2, name: t.comparison.heading })).toBeTruthy();
    expect(flat(screen.getByRole("heading", { level: 1 }).textContent)).toBe(
      "Your employer deducted R 3 149,00; based on the SARS 2026/27 rules, our calculation gives R 3 149,00.",
    );
    expect(screen.getByText(t.comparison.match)).toBeTruthy();
  });

  it("is neutral: shows both numbers, the difference in rands and %, and the PRD explanation", () => {
    show(withPayslip(3_500));
    const r = engine(withPayslip(3_500));
    const panel = within(screen.getByRole("heading", { level: 2, name: t.comparison.heading }).closest("section")!);
    expect(flat(panel.getByText(t.comparison.payslip).parentElement!.textContent)).toContain(rand(3_500));
    expect(flat(panel.getByText(t.comparison.calc).parentElement!.textContent)).toContain(rand(r.comparison!.calcPaye));
    expect(flat(panel.getByText(/higher than our calculation/).textContent)).toContain(rand(r.comparison!.diff));
    expect(flat(panel.getByText(/higher than our calculation/).textContent)).toContain("(11,1%)");
    expect(panel.getByText(/doesn’t automatically mean your employer made a mistake/)).toBeTruthy();
    expect(panel.getByText(/doesn’t guarantee a SARS refund/)).toBeTruthy();
    // Neutral: no words of blame or alarm.
    expect(flat(document.body.textContent)).not.toMatch(/overcharg|underpa|error by|wrong|illegal|fraud/i);
  });

  it("says 'lower' when the payslip is below our figure, and notes an assumed UIF", () => {
    show(withPayslip(2_000));
    expect(screen.getByText(/lower than our calculation/)).toBeTruthy();
    expect(screen.getByText(t.comparison.uifAssumed)).toBeTruthy();
    expect(screen.getByText(copy.results.notes.PAYSLIP_UIF_ASSUMED)).toBeTruthy();
  });

  it("is not shown in bank-account mode", () => {
    show(base("TAKE_HOME", 20_000));
    expect(screen.queryByText(t.comparison.heading)).toBeNull();
  });
});

describe("results page: notes, warnings and flags", () => {
  it("shows every engine flag with its SARS link, opening safely in a new tab", () => {
    show(T1);
    const r = engine(T1);
    const section = within(screen.getByRole("heading", { level: 2, name: t.flagsHeading }).closest("section")!);
    expect(section.getAllByRole("listitem")).toHaveLength(r.flags.length);
    for (const f of r.flags) {
      const text = t.flags[f.code];
      const item = section.getByText(text.title).closest("li")!;
      expect(flat(item.textContent)).toContain(text.body);
      const link = within(item).getByRole("link");
      expect(link.getAttribute("href")).toBe(SOURCES[f.source].url);
      expect(link.getAttribute("target")).toBe("_blank");
      expect(link.getAttribute("rel")).toContain("noreferrer");
    }
  });

  it("flags follow the situation: donations without a receipt, a travel allowance, a second job", () => {
    const a = base("GROSS", 30_000, {
      extras: {
        ...INITIAL_ANSWERS.extras,
        donationsAnnual: 5_000,
        has18AReceipt: false,
        travelAllowanceMonthly: 3_000,
        hasSecondEmployer: true,
        secondEmployerAnnual: 100_000,
      },
    });
    show(a);
    for (const code of ["DONATION_RECEIPT_NEEDED", "TRAVEL_LOGBOOK_REQUIRED", "MULTIPLE_EMPLOYERS"] as const) {
      expect(screen.getByText(t.flags[code].title)).toBeTruthy();
    }
  });

  it("bank-account mode discloses that gross was estimated", () => {
    show(base("TAKE_HOME", 20_000));
    expect(screen.getByText(copy.common.estimate)).toBeTruthy();
    expect(screen.getByText(t.notes.ESTIMATED_FROM_TAKE_HOME)).toBeTruthy();
    expect(screen.getByText(/We estimate your gross salary at/)).toBeTruthy();
  });

  it("a bonus adds an 'extras' line (whole year only), and discloses the method used", () => {
    const a = base("GROSS", 30_000, { variable: { types: ["BONUS"], bonusAnnual: 30_000, overtimeAnnual: null, commissionAnnual: null } });
    show(a);
    const table = tableByCaption(b.payslipCaption);
    const row = table.getByRole("row", { name: new RegExp(b.rows.EXTRAS.label) });
    expect(flat(row.textContent)).toContain(rand(30_000));
    expect(within(row).getByText(b.none)).toBeTruthy();
    expect(screen.getByText(b.yearNote)).toBeTruthy();
    expect(screen.getByText(t.notes.VARIABLE_PAY_BALANCE_METHOD)).toBeTruthy();
  });

  it("medical aid by debit order is listed apart from the payslip, with the filing note", () => {
    const a = base("GROSS", 30_000, {
      medical: { ...INITIAL_ANSWERS.medical, member: true, members: 1, monthlyTotal: 3_000, ownSharePaidVia: "DEBIT_ORDER" },
    });
    show(a);
    expect(screen.getByRole("heading", { level: 3, name: b.offPayslipHeading })).toBeTruthy();
    const payslip = tableByCaption(b.payslipCaption);
    expect(payslip.queryByRole("row", { name: new RegExp(b.rows.MEDICAL_OWN.label) })).toBeNull();
    expect(screen.getByText(t.notes.MEDICAL_CREDIT_CLAIMED_ON_FILING)).toBeTruthy();
  });

  it("a payslip PAYE above the salary shows a 'Please check' notice", () => {
    show(base("PAYSLIP", 10_000, { payslip: { paye: 20_000, uif: null } }));
    expect(screen.getByText(t.warningsHeading)).toBeTruthy();
    expect(screen.getByText(t.warnings.PAYSLIP_PAYE_ABOVE_GROSS)).toBeTruthy();
  });

  it("a low earner: unused rebates are shown, and no negative tax", () => {
    show(base("GROSS", 6_000));
    const after = tableByCaption(b.afterCaption);
    expect(after.getByRole("row", { name: new RegExp(b.rows.REBATE_UNUSED.label) })).toBeTruthy();
    expect(flat(after.getByRole("row", { name: /Your tax for the year/ }).textContent)).toContain(rand(0));
    expect(screen.getByText(t.flags.BELOW_THRESHOLD_MAY_NOT_NEED_TO_FILE.title)).toBeTruthy();
  });

  it("refund: a retirement annuity paid by debit order shows 'Refund when you file'", () => {
    const a = base("GROSS", 40_000, {
      retirement: { ...INITIAL_ANSWERS.retirement, has: true, payslipMonthly: null, raMonthly: 5_000 },
    });
    show(a);
    const r = engine(a);
    expect(r.filing.refundAnnual).toBeGreaterThan(0);
    const filing = tableByCaption(b.filingCaption);
    const row = filing.getByRole("row", { name: new RegExp(b.balance.refund.label) });
    expect(flat(row.textContent)).toContain(rand(r.filing.refundAnnual));
  });

  it("owing: a second job shows 'You owe when you file'", () => {
    const a = base("GROSS", 40_000, { extras: { ...INITIAL_ANSWERS.extras, hasSecondEmployer: true, secondEmployerAnnual: 400_000 } });
    show(a);
    const r = engine(a);
    expect(r.filing.owedAnnual).toBeGreaterThan(0);
    const row = tableByCaption(b.filingCaption).getByRole("row", { name: new RegExp(b.balance.owed.label) });
    expect(flat(row.textContent)).toContain(rand(r.filing.owedAnnual));
  });
});

describe("results page: the table reconciles to the cent (PRD §14.2)", () => {
  const money = (max: number) => fc.integer({ min: 0, max: max * 100 }).map((c) => c / 100);
  const answers = fc
    .record({
      mode: fc.constantFrom<WizardAnswers["mode"]>("GROSS", "TAKE_HOME", "PAYSLIP"),
      amount: money(200_000),
      payFrequency: fc.constantFrom<WizardAnswers["payFrequency"]>("MONTHLY", "WEEKLY", "FORTNIGHTLY"),
      ageBand: fc.constantFrom<WizardAnswers["ageBand"]>("UNDER_65", "AGE_65_74", "AGE_75_PLUS"),
      pension: fc.option(money(20_000), { nil: null }),
      ra: fc.option(money(10_000), { nil: null }),
      medical: fc.option(fc.record({ members: fc.integer({ min: 1, max: 6 }), total: money(12_000), via: fc.constantFrom<"PAYROLL" | "DEBIT_ORDER">("PAYROLL", "DEBIT_ORDER") }), { nil: null }),
      bonus: fc.option(money(150_000), { nil: null }),
      travel: fc.option(fc.integer({ min: 0, max: 8_000 }), { nil: null }),
    })
    .map((x) => {
      const a = base(x.mode, x.amount, {
        payFrequency: x.payFrequency,
        ageBand: x.ageBand,
        retirement: { ...INITIAL_ANSWERS.retirement, has: x.pension !== null || x.ra !== null, payslipMonthly: x.pension, raMonthly: x.ra },
        medical: x.medical
          ? { ...INITIAL_ANSWERS.medical, member: true, members: x.medical.members, monthlyTotal: x.medical.total, ownSharePaidVia: x.medical.via }
          : INITIAL_ANSWERS.medical,
        variable: x.bonus === null ? INITIAL_ANSWERS.variable : { types: ["BONUS"], bonusAnnual: x.bonus, overtimeAnnual: null, commissionAnnual: null },
        extras: { ...INITIAL_ANSWERS.extras, travelAllowanceMonthly: x.travel },
      });
      return a;
    });

  it("gross − own deductions − PAYE − UIF = take-home, read from the page, monthly and annual", () => {
    fc.assert(
      fc.property(answers, (a) => {
        const { unmount } = show(a);
        try {
          const rows = within(screen.getByRole("table", { name: b.payslipCaption })).getAllByRole("row").slice(1);
          const cellsOf = (row: HTMLElement) => within(row).getAllByRole("cell");
          for (const col of [0, 1]) {
            const values = rows.map((row) => cents(cellsOf(row)[col]!));
            const total = values[values.length - 1]!;
            const parts = values.slice(0, -1).reduce<number>((sum, v) => sum + (v ?? 0), 0);
            expect(parts).toBe(total);
          }
          // And the total is the take-home in the headline tile.
          const r = engine(a);
          expect(cents(cellsOf(rows[rows.length - 1]!)[0]!)).toBe(Math.round(r.takeHomeMonthly * 100));
        } finally {
          unmount();
        }
      }),
      { numRuns: 40 },
    );
  });

  it("the page's tables are exactly the engine's breakdown", () => {
    fc.assert(
      fc.property(answers, (a) => {
        const { unmount } = show(a);
        try {
          const r = engine(a);
          const rows = within(screen.getByRole("table", { name: b.payslipCaption })).getAllByRole("rowheader");
          expect(rows).toHaveLength(buildBreakdown(r).payslip.length);
        } finally {
          unmount();
        }
      }),
      { numRuns: 25 },
    );
  });
});

// ---------------------------------------------------------------------------
// Education and recommendations (PRD §14.5, §14.6)
// ---------------------------------------------------------------------------

const sectionOf = (name: string) => within(screen.getByRole("heading", { level: 2, name }).closest("section")!);
const cardIds = (container: HTMLElement, attr: string) =>
  [...container.querySelectorAll(`[${attr}]`)].map((el) => el.getAttribute(attr));

describe("results page: how your answers shaped your tax", () => {
  it("T1: retirement, medical credit and UIF cards, in that order, with the engine's rand effects", () => {
    show(T1);
    const section = sectionOf(t.explainHeading);
    expect(cardIds(section.getByRole("list"), "data-explanation")).toEqual(["RETIREMENT", "MEDICAL_CREDIT", "UIF"]);
    const ret = section.getByRole("heading", { name: t.explain.RETIREMENT.title }).closest("li")!;
    const text = flat(ret.textContent);
    expect(text).toContain("R 3 000,00 a month");
    expect(text).toContain("R 780,00 a month (R 9 360,00 a year)");
    expect(text).toContain("26% top rate");
    expect(text).toContain(`${t.effectLabel} R 9 360,00 ${t.perYear}`);
    const med = flat(section.getByRole("heading", { name: t.explain.MEDICAL_CREDIT.title }).closest("li")!.textContent);
    expect(med).toContain("R 752,00 a month");
    expect(med).toContain("R 376,00 for you and R 376,00 for your dependant");
    expect(flat(section.getByRole("heading", { name: "UIF" }).closest("li")!.textContent)).toContain("R 177,12");
  });

  it("only answered things get a card", () => {
    show(base("GROSS", 20_000));
    const section = sectionOf(t.explainHeading);
    expect(cardIds(section.getByRole("list"), "data-explanation")).toEqual(["UIF"]);
  });

  it("age, donations, a bonus, travel and interest each explain themselves", () => {
    const a = base("GROSS", 40_000, {
      ageBand: "AGE_75_PLUS",
      variable: { types: ["BONUS"], bonusAnnual: 30_000, overtimeAnnual: null, commissionAnnual: null },
      extras: { ...INITIAL_ANSWERS.extras, donationsAnnual: 4_000, has18AReceipt: false, travelAllowanceMonthly: 3_000, travelKmAnnual: 8_000, interestAnnual: 40_000 },
    });
    show(a);
    const section = sectionOf(t.explainHeading);
    expect(cardIds(section.getByRole("list"), "data-explanation")).toEqual(["AGE_REBATE", "DONATIONS", "VARIABLE_PAY", "UIF", "TRAVEL", "INTEREST"]);
    expect(flat(section.getByRole("heading", { name: t.explain.AGE_REBATE.title }).closest("li")!.textContent)).toContain("75 or older");
    expect(section.getByText(t.explain.DONATIONS.receipt)).toBeTruthy();
    expect(flat(section.getByRole("heading", { name: t.explain.INTEREST.title }).closest("li")!.textContent)).toMatch(/R 34 500,00 is tax-free/);
  });
});

describe("results page: ways to keep more of your pay", () => {
  const advice = () => sectionOf(t.adviceHeading);

  it("T1: R1, R3, R5, R8, R7, with the example and its saving from the engine", () => {
    show(T1);
    const list = advice().getByRole("list");
    expect(cardIds(list, "data-recommendation")).toEqual(["R1", "R3", "R5", "R8", "R7"]);
    const r1 = flat(advice().getByRole("heading", { name: t.advice.R1.title }).closest("li")!.textContent);
    expect(r1).toContain("R 1 000 more a month");
    expect(r1).toContain("R 260,00 a month (R 3 120,00 a year)");
    expect(flat(advice().getByRole("heading", { name: t.advice.R5.title }).closest("li")!.textContent)).toContain("R 260,00 in tax");
  });

  it("says plainly that it is education, not advice", () => {
    show(T1);
    expect(advice().getByText(t.adviceDisclaimer)).toBeTruthy();
  });

  it("no pension: R2 and an example of R2 000 a month", () => {
    show(base("GROSS", 30_000));
    expect(cardIds(advice().getByRole("list"), "data-recommendation")).toContain("R2");
    expect(cardIds(advice().getByRole("list"), "data-recommendation")).not.toContain("R1");
    const r2 = flat(advice().getByRole("heading", { name: t.advice.R2.title }).closest("li")!.textContent);
    expect(r2).toContain("R 2 000 a month");
    expect(r2).toContain("R 520,00 a month");
  });

  it("a 39% bracket: R9 with the cents per rand, and a different saving from the 26% case", () => {
    const high = base("GROSS", 65_000);
    show(high);
    expect(flat(advice().getByRole("heading", { name: t.advice.R9.title }).closest("li")!.textContent)).toContain("saves you 39 cents");
    const r2 = flat(advice().getByRole("heading", { name: t.advice.R2.title }).closest("li")!.textContent);
    expect(r2).toContain("R 780,00 a month"); // 24 000 × 39% ÷ 12
    cleanup();
    show(base("GROSS", 30_000));
    expect(cardIds(advice().getByRole("list"), "data-recommendation")).not.toContain("R9");
  });

  it("only CALCULATED ideas carry savings; the others are labelled and have no saving", () => {
    show(T1);
    const label = (id: string) => advice().getByRole("list").querySelector(`[data-recommendation=${id}]`)!;
    expect(label("R1").textContent).toContain(t.confidence.CALCULATED);
    expect(label("R8").textContent).toContain(t.confidence.ESTIMATED);
    expect(label("R7").textContent).toContain(t.confidence.INFORMATIONAL);
    expect(label("R8").textContent).not.toMatch(/R\s?\d/);
    expect(label("R8").textContent).not.toMatch(/saves?|cut your tax/i);
  });

  it("a person who owes no tax is not told how much they could save", () => {
    show(base("GROSS", 6_000));
    const ids = cardIds(advice().getByRole("list"), "data-recommendation");
    for (const id of ["R1", "R2", "R4", "R5", "R9"]) expect(ids).not.toContain(id);
  });

  it("R4 for someone without a medical aid; R3 for someone with", () => {
    show(base("GROSS", 30_000));
    expect(cardIds(advice().getByRole("list"), "data-recommendation")).toContain("R4");
    expect(flat(advice().getByRole("heading", { name: t.advice.R4.title }).closest("li")!.textContent)).toContain("R 376,00 a month");
  });
});

describe("results page: every rand figure in the guidance comes from the engine", () => {
  const profiles: [string, WizardAnswers][] = [
    ["T1", T1],
    ["no pension, 39% bracket", base("GROSS", 65_000)],
    [
      "busy: 65+, donations, bonus, travel, interest, medical",
      base("GROSS", 45_000, {
        ageBand: "AGE_65_74",
        retirement: { ...INITIAL_ANSWERS.retirement, has: true, payslipMonthly: 2_500 },
        medical: { ...INITIAL_ANSWERS.medical, member: true, members: 3, monthlyTotal: 5_000 },
        variable: { types: ["BONUS"], bonusAnnual: 50_000, overtimeAnnual: null, commissionAnnual: null },
        extras: { ...INITIAL_ANSWERS.extras, donationsAnnual: 3_000, travelAllowanceMonthly: 2_000, travelKmAnnual: 6_000, interestAnnual: 30_000 },
      }),
    ],
    ["bank amount", base("TAKE_HOME", 22_000)],
  ];

  const numbersIn = (o: unknown): number[] => (typeof o === "number" ? [o] : o && typeof o === "object" ? Object.values(o).flatMap(numbersIn) : []);

  it.each(profiles)("%s", (_name, a) => {
    show(a);
    const inputs = toEngineInputs(a);
    const r = engine(a);
    const allowed = new Set(
      [...buildExplanations(rules, inputs, r), ...buildRecommendations(rules, inputs, r)]
        .flatMap(numbersIn)
        .flatMap((n) => [rand(n), flat(formatRand(n, { decimals: 0 }))]),
    );
    const text = [t.explainHeading, t.adviceHeading].map((h) => sectionOf(h).getByRole("list").textContent ?? "").join(" ");
    const tokens = flat(text).match(/R [\d ]+(?:,\d\d)?/g) ?? [];
    expect(tokens.length).toBeGreaterThan(0);
    for (const token of tokens) expect(allowed, `"${token}" is not an engine figure`).toContain(token.trim());
  });
});
