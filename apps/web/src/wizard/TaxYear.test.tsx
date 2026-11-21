// @vitest-environment jsdom
import { calculate as engineCalculate, getRuleSet } from "@taxclarity/tax-engine";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import { TaxYearSelect } from "../components/TaxYearSelect.tsx";
import { copy, yearCopy } from "../content/strings.ts";
import { Landing } from "../pages/Landing.tsx";
import { ResultsPage } from "../pages/Results.tsx";
import { summaryText } from "../results/summaryText.ts";
import { Layout } from "../components/Layout.tsx";
import {
  ageCouldDiffer,
  ageNeedsConfirmation,
  applyPatch,
  changeTaxYear,
  INITIAL_ANSWERS,
  toEngineInputs,
  type WizardAnswers,
} from "./answers.ts";
import { calculate, WizardProvider } from "./WizardContext.tsx";
import { WizardPage } from "./WizardPage.tsx";

/**
 * Phase 18: the tax-year selector. Expected figures for R30 000 a month are the independently worked ones from
 * docs/rulesets/2025-26-vectors.md (2025/26: PAYE R4 783,08) and the PRD's 2026/27 (PAYE R4 681,00).
 */

afterEach(cleanup);

const flat = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim();
const Y25 = getRuleSet("2025-26");
const Y26 = getRuleSet("2026-27");

const gross = (patch: Partial<WizardAnswers> = {}) => applyPatch(applyPatch(INITIAL_ANSWERS, { mode: "GROSS" }), { amount: 30_000, ...patch });
/** Everything answered, so the review step is reachable. */
const complete = (patch: Partial<WizardAnswers> = {}) =>
  gross({
    retirement: { ...INITIAL_ANSWERS.retirement, has: false },
    medical: { ...INITIAL_ANSWERS.medical, member: false },
    variable: { ...INITIAL_ANSWERS.variable, types: [] },
    ...patch,
  });

describe("age group across years", () => {
  it.each([
    // from, to, band, could it differ?
    ["2026-27", "2025-26", "UNDER_65", false],
    ["2026-27", "2025-26", "AGE_65_74", true],
    ["2026-27", "2025-26", "AGE_75_PLUS", true],
    ["2025-26", "2026-27", "UNDER_65", true],
    ["2025-26", "2026-27", "AGE_65_74", true],
    ["2025-26", "2026-27", "AGE_75_PLUS", false],
    ["2026-27", "2026-27", "AGE_65_74", false],
  ] as const)("%s → %s, %s: %s", (from, to, band, expected) => {
    expect(ageCouldDiffer(from, to, band)).toBe(expected);
  });

  it("a year change keeps every answer and only puts the age group in question when it could differ", () => {
    const a = complete({ amount: 31_000, ageBand: "AGE_65_74" });
    const back = changeTaxYear(a, "2025-26");
    expect({ ...back, taxYear: a.taxYear, ageBandYear: a.ageBandYear }).toEqual(a); // nothing else moved
    expect(back.taxYear).toBe("2025-26");
    expect(ageNeedsConfirmation(back)).toBe(true);
    // Under 65 going to an earlier year cannot change: no question.
    expect(ageNeedsConfirmation(changeTaxYear(gross({ ageBand: "UNDER_65" }), "2025-26"))).toBe(false);
    // Switching back to the year the age was given for needs no question either.
    expect(ageNeedsConfirmation(changeTaxYear(back, "2026-27"))).toBe(false);
    // ...even after an under-65 answer went to an earlier year and came back (the first version asked here by mistake).
    const there = changeTaxYear(gross({ ageBand: "UNDER_65" }), "2025-26");
    expect(ageNeedsConfirmation(changeTaxYear(there, "2026-27"))).toBe(false);
    // Confirming moves the anchor: the answer is now for the year on screen.
    const confirmed = { ...back, ageBandYear: back.taxYear };
    expect(ageNeedsConfirmation(confirmed)).toBe(false);
    expect(ageNeedsConfirmation(changeTaxYear(confirmed, "2026-27"))).toBe(true); // 65–74 could have grown a year older
  });

  it("answering the age question answers it for the year on screen", () => {
    const pending = changeTaxYear(gross({ ageBand: "AGE_65_74" }), "2025-26");
    expect(ageNeedsConfirmation(pending)).toBe(true);
    const answered = applyPatch(pending, { ageBand: "UNDER_65" });
    expect(ageNeedsConfirmation(answered)).toBe(false);
    expect(answered.ageBandYear).toBe("2025-26");
  });

  it("the engine inputs carry the year", () => {
    expect(toEngineInputs(gross()).taxYear).toBe("2026-27");
    expect(toEngineInputs(changeTaxYear(gross(), "2025-26")).taxYear).toBe("2025-26");
  });
});

describe("the selector", () => {
  const withProvider = (ui: React.ReactNode, initial?: WizardAnswers) =>
    render(<WizardProvider {...(initial ? { initial } : {})}>{ui}</WizardProvider>);

  it("is a labelled select with each year's dates, 2026/27 chosen first, and drafts tagged", () => {
    withProvider(<TaxYearSelect />);
    const select = screen.getByLabelText(copy.taxYear.label) as HTMLSelectElement;
    expect(select.value).toBe("2026-27");
    const options = within(select).getAllByRole("option").map((o) => flat(o.textContent));
    expect(options).toEqual([
      `2025/26 · 1 March 2025 – 28 February 2026 · ${copy.taxYear.draftTag}`,
      "2026/27 · 1 March 2026 – 28 February 2027",
    ]);
  });

  it("with one year to offer it shows the year as plain text, not a control that does nothing", () => {
    withProvider(<TaxYearSelect years={[Y26]} />);
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.getByTestId("tax-year-fixed").textContent).toBe("2026/27 · 1 March 2026 – 28 February 2027");
    expect(screen.getByText(copy.taxYear.label)).toBeTruthy();
  });

  it("can be told apart from a second selector by its name, and is reachable by keyboard", async () => {
    const user = userEvent.setup({ delay: null });
    withProvider(
      <>
        <TaxYearSelect />
        <TaxYearSelect label={copy.taxYear.previewLabel} />
      </>,
    );
    expect(screen.getAllByRole("combobox").map((c) => c.getAttribute("id"))[0]).not.toBe(screen.getAllByRole("combobox")[1]!.getAttribute("id"));
    expect(screen.getByLabelText(copy.taxYear.previewLabel)).toBeTruthy();
    await user.tab();
    expect(document.activeElement?.tagName).toBe("SELECT");
  });

  it("choosing a year changes it everywhere it is shown, and says so politely without blocking", async () => {
    const user = userEvent.setup({ delay: null });
    withProvider(
      <MemoryRouter>
        <Layout />
        <TaxYearSelect />
      </MemoryRouter>,
    );
    const notice = screen.getByTestId("year-notice");
    expect(notice.getAttribute("role")).toBe("status");
    expect(notice.getAttribute("aria-live")).toBe("polite");
    expect(notice.textContent).toBe("");
    await user.selectOptions(screen.getByLabelText(copy.taxYear.label), "2025-26");
    expect(flat(notice.textContent)).toContain("Tax year changed to 2025/26. Your results have been recalculated using that year's rules.");
    expect(flat(document.querySelector("header")?.textContent)).toContain("2025/26 tax year");
    expect(flat(document.querySelector("footer")?.textContent)).toContain("Rules for the 2025/26 tax year: 1 March 2025 to 28 February 2026.");
    await user.click(within(notice).getByRole("button", { name: copy.taxYear.dismiss }));
    expect(notice.textContent).toBe("");
  });

  it("ignores a year it cannot offer", async () => {
    // Unknown years never reach the store: the select only lists what the build allows.
    withProvider(<TaxYearSelect />);
    const values = within(screen.getByLabelText(copy.taxYear.label)).getAllByRole("option").map((o) => (o as HTMLOptionElement).value);
    expect(values).toEqual(["2025-26", "2026-27"]);
  });
});

/** The phone bar is the preview in jsdom's default (phone-sized) window; its two figures are the engine's. */
const bar = () => flat(screen.getByRole("button", { name: /Take-home/ }).textContent);

function renderWizard(initial: WizardAnswers, path = "/wizard?step=2") {
  const user = userEvent.setup({ delay: null });
  const view = render(
    <WizardProvider initial={initial}>
      <MemoryRouter initialEntries={[path]}>
        <Layout />
        <Routes>
          <Route element={<Layout />}>
            <Route path="wizard" element={<WizardPage />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </WizardProvider>,
  );
  return { user, ...view };
}

describe("in the wizard", () => {
  it("is at the top of the wizard and in the preview, and changing it keeps the answers and recalculates", async () => {
    const { user } = renderWizard(gross());
    expect(screen.getByLabelText(copy.taxYear.label)).toBeTruthy();
    expect(bar()).toContain("R 4 681,00"); // 2026/27: PAYE on R30 000
    await user.selectOptions(screen.getByLabelText(copy.taxYear.label), "2025-26");
    expect(bar()).toContain("R 4 783,08"); // 2025/26, worked independently
    expect(bar()).not.toContain("R 4 681,00"); // the old year's number is gone
    expect(flat(document.body.textContent)).toContain("Tax year changed to 2025/26.");
    // Back to the first year: the original result to the cent.
    await user.selectOptions(screen.getByLabelText(copy.taxYear.label), "2026-27");
    expect(bar()).toContain("R 4 681,00");
    expect(bar()).not.toContain("R 4 783,08");
  });

  it("asks for the age group again when it could differ, and shows no numbers until it is confirmed", async () => {
    const { user } = renderWizard(gross({ ageBand: "AGE_65_74" }));
    expect(bar()).toContain("R 3 867,25"); // 65–74 in 2026/27: (73 992 − 27 585) ÷ 12
    await user.selectOptions(screen.getByLabelText(copy.taxYear.label), "2025-26");
    // Step 2 is the age question: the confirmation takes its place, and the preview has no numbers.
    expect(screen.getAllByTestId("age-confirm").length).toBeGreaterThan(0);
    expect(screen.getAllByText(copy.taxYear.ageConfirm.title("2025/26")).length).toBeGreaterThan(0);
    expect(bar()).not.toMatch(/R\s*\d/);
    // Confirming it shows the new year's numbers: 65–74 in 2025/26 is (74 632 − 26 679) ÷ 12.
    await user.click(screen.getAllByRole("button", { name: copy.taxYear.ageConfirm.confirm })[0]!);
    expect(screen.queryByTestId("age-confirm")).toBeNull();
    expect(bar()).toContain("R 3 996,08");
  });

  it("choosing a different age group answers the question too", async () => {
    const { user } = renderWizard(gross({ ageBand: "AGE_65_74" }));
    await user.selectOptions(screen.getByLabelText(copy.taxYear.label), "2025-26");
    const confirm = screen.getAllByTestId("age-confirm")[0]!;
    await user.click(within(confirm).getByRole("radio", { name: "Younger than 65" }));
    expect(screen.queryByTestId("age-confirm")).toBeNull();
    expect(bar()).toContain("R 4 783,08");
  });

  it("an age group that cannot change (under 65, going to an earlier year) is not asked about", async () => {
    const { user } = renderWizard(gross({ ageBand: "UNDER_65" }));
    await user.selectOptions(screen.getByLabelText(copy.taxYear.label), "2025-26");
    expect(screen.queryByTestId("age-confirm")).toBeNull();
    expect(bar()).toContain("R 4 783,08");
  });

  it("the age question names the chosen year's date", async () => {
    const { user } = renderWizard(gross());
    expect(screen.getAllByText(/Your age group at 28 February 2027/).length).toBeGreaterThan(0);
    await user.selectOptions(screen.getByLabelText(copy.taxYear.label), "2025-26");
    expect(flat(document.body.textContent)).toContain("(28 February 2026)");
    expect(flat(document.body.textContent)).not.toContain("(28 February 2027)");
  });

  it("the review screen shows the year, and its Change link moves focus to the selector at the top", async () => {
    const { user } = renderWizard(complete(), "/wizard?step=8");
    const row = screen.getByText("Tax year", { selector: "dt" }).closest("div")!;
    expect(flat(row.textContent)).toContain("2026/27 · 1 March 2026 – 28 February 2027");
    await user.click(within(row).getByRole("button", { name: /Change Tax year/ }));
    expect(document.activeElement?.id).toBe("wizard-tax-year");
    await user.selectOptions(document.activeElement as HTMLElement, "2025-26");
    expect(flat(screen.getByText("Tax year", { selector: "dt" }).closest("div")!.textContent)).toContain("2025/26 · 1 March 2025 – 28 February 2026");
    expect(flat(document.body.textContent)).toContain("estimate for the 2025/26 tax year (1 March 2025 to 28 February 2026)");
  });

  it("the review screen asks the age question too when a year change put it in doubt", async () => {
    const { user } = renderWizard(complete({ ageBand: "AGE_75_PLUS" }), "/wizard?step=8");
    await user.selectOptions(screen.getByLabelText(copy.taxYear.label), "2025-26");
    expect(screen.getAllByTestId("age-confirm").length).toBeGreaterThan(0);
  });
});

function renderResults(initial: WizardAnswers) {
  const user = userEvent.setup({ delay: null });
  const view = render(
    <WizardProvider initial={initial}>
      <MemoryRouter initialEntries={["/results"]}>
        <Routes>
          <Route element={<Layout />}>
            <Route path="results" element={<ResultsPage />} />
            <Route path="wizard" element={<p>wizard</p>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </WizardProvider>,
  );
  return { user, ...view };
}

const headline = () => flat(screen.getByRole("heading", { level: 1 }).textContent);

describe("on the results page", () => {
  it("2025/26: the year line, the bracket table, the headline and the sentence all say 2025/26", () => {
    renderResults(complete({ taxYear: "2025-26", ageBandYear: "2025-26" }));
    expect(headline()).toBe("Your estimated monthly PAYE is R 4 783,08, and your take-home salary is R 25 039,80.");
    expect(screen.getByText("2025/26 tax year · 1 March 2025 – 28 February 2026")).toBeTruthy();
    const table = within(screen.getByRole("table", { name: yearCopy(Y25).bracketsCaption }));
    expect(flat(table.getAllByRole("row")[1]!.textContent)).toContain("R 0 – R 237 100"); // 2025/26's first bracket, not R245 100
    expect(flat(document.body.textContent)).not.toContain("R 245 100");
  });

  it("payslip mode: the comparison sentence names the chosen year", () => {
    renderResults(
      complete({
        mode: "PAYSLIP",
        amount: 30_000,
        taxYear: "2025-26",
        ageBandYear: "2025-26",
        payslip: { paye: 4_700, uif: null },
      }),
    );
    expect(headline()).toContain("based on the SARS 2025/26 rules, our calculation gives R 4 783,08");
  });

  it("has the selector, and switching back restores the first year's figures to the cent", async () => {
    const { user } = renderResults(complete());
    expect(headline()).toContain("R 4 681,00");
    await user.selectOptions(screen.getByLabelText(copy.taxYear.label), "2025-26");
    expect(headline()).toContain("R 4 783,08");
    expect(headline()).not.toContain("R 4 681,00");
    await user.selectOptions(screen.getByLabelText(copy.taxYear.label), "2026-27");
    expect(headline()).toBe("Your estimated monthly PAYE is R 4 681,00, and your take-home salary is R 25 141,88.");
  });

  it("after a year change that could alter the age group, shows the question instead of numbers, then the numbers", async () => {
    const { user } = renderResults(complete({ ageBand: "AGE_65_74" }));
    await user.selectOptions(screen.getByLabelText(copy.taxYear.label), "2025-26");
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull(); // no headline, so no numbers
    expect(flat(document.body.textContent)).not.toMatch(/R 3 996,08|R 3 867,25/);
    expect(screen.getByText(copy.taxYear.ageConfirm.title("2025/26"))).toBeTruthy();
    await user.click(screen.getByRole("button", { name: copy.taxYear.ageConfirm.confirm }));
    expect(headline()).toContain("R 3 996,08");
  });

  it("Copy summary text carries the result's own year and dates", () => {
    const i25 = toEngineInputs(complete({ taxYear: "2025-26", ageBandYear: "2025-26" }));
    const text = summaryText(engineCalculate(Y25, i25));
    expect(text).toContain("2025/26");
    expect(text).toContain("1 March 2025");
    expect(text).toContain("28 February 2026");
    expect(text).not.toContain("2026/27");
    const text26 = summaryText(calculate(toEngineInputs(complete())));
    expect(text26).toContain("2026/27");
    expect(text26).not.toContain("2025/26");
  });
});

describe("the landing page", () => {
  it("has the selector beside the start buttons", () => {
    render(
      <WizardProvider>
        <MemoryRouter>
          <Landing />
        </MemoryRouter>
      </WizardProvider>,
    );
    const select = screen.getByLabelText(copy.taxYear.label);
    const hero = select.closest("section")!;
    expect(within(hero).getByRole("link", { name: copy.hero.primaryCta })).toBeTruthy();
  });
});

describe("year-specific wording and links (Phase 19)", () => {
  const page = () => flat(document.body.textContent);

  it("the retirement FAQ quotes the chosen year's limit", async () => {
    const { user } = renderWizard(complete(), "/wizard?step=3");
    expect(page()).toContain("capped at R 430 000 a year (2026/27)");
    await user.selectOptions(screen.getByLabelText(copy.taxYear.label), "2025-26");
    expect(page()).toContain("capped at R 350 000 a year (2025/26)");
    expect(page()).not.toContain("R 430 000");
    expect(page()).toContain("Up to 27,5% of your income");
  });

  it("the medical aid FAQ quotes the chosen year's credits", async () => {
    const { user } = renderWizard(complete(), "/wizard?step=4");
    expect(page()).toMatch(/R\s?376/);
    await user.selectOptions(screen.getByLabelText(copy.taxYear.label), "2025-26");
    expect(page()).toMatch(/R\s?364/);
    expect(page()).toMatch(/R\s?246/);
    expect(page()).not.toMatch(/R\s?376|R\s?254/);
  });

  it("the payslip step's UIF warning names the chosen year", async () => {
    const { user } = renderWizard(complete({ mode: "PAYSLIP", payslip: { paye: 0, uif: 300 } }), "/wizard?step=7");
    expect(page()).toContain("isn't possible under 2026/27 rules");
    await user.selectOptions(screen.getByLabelText(copy.taxYear.label), "2025-26");
    expect(page()).toContain("isn't possible under 2025/26 rules");
    expect(page()).not.toContain("2026/27 rules");
  });

  it("the results page quotes the chosen year's tax-free savings limit in its tips", async () => {
    const { user } = renderResults(complete({ retirement: { ...INITIAL_ANSWERS.retirement, has: true, payslipMonthly: 3_000 }, medical: { ...INITIAL_ANSWERS.medical, member: true, members: 2, monthlyTotal: 0 } }));
    expect(page()).toMatch(/R\s?46\s?000/);
    await user.selectOptions(screen.getByLabelText(copy.taxYear.label), "2025-26");
    expect(page()).toMatch(/R\s?36\s?000/);
    expect(page()).not.toMatch(/R\s?46\s?000/);
  });

  it("flag links that name a year follow the result's year", async () => {
    const withInterest = complete({ extras: { ...INITIAL_ANSWERS.extras, interestAnnual: 5_000 } });
    const { user } = renderResults(withInterest);
    const flags = () => screen.getByRole("heading", { name: copy.results.flagsHeading }).closest("section")!;
    expect(within(flags()).getAllByRole("link", { name: /National Treasury: 2026 Budget/ }).length).toBeGreaterThan(0);
    await user.selectOptions(screen.getByLabelText(copy.taxYear.label), "2025-26");
    expect(within(flags()).getAllByRole("link", { name: /National Treasury: 2025 Budget/ }).length).toBeGreaterThan(0);
    expect(within(flags()).queryAllByRole("link", { name: /2026 Budget/ })).toHaveLength(0);
  });
});
