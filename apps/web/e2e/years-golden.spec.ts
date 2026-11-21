import { expect, test, type Page } from "@playwright/test";
import { calculate, getRuleSet, type CalculationInputs, type TaxYear } from "@taxclarity/tax-engine";
import { expectAccessible } from "./axe";
import { flat, Wizard } from "./driver";

/**
 * Phase 19: the golden paths for BOTH tax years, in all three ways to start, beginning on the landing page with the year
 * chosen (so the choice is carried into the wizard). Every figure is the engine's own for that year, and the year-specific
 * wording (limits in the FAQs, the year line, the bracket table, the footer, the assistant) is checked against the same rule
 * set. Runs against the test build that offers the draft year (playwright.config.ts, port 4175).
 */
test.use({ baseURL: "http://localhost:4175" });

const YEARS: TaxYear[] = ["2025-26", "2026-27"];
const money = (n: number) => {
  const [whole = "0", cents = "00"] = Math.abs(n).toFixed(2).split(".");
  return `${n < 0 ? "−" : ""}R ${whole.replace(/\B(?=(\d{3})+(?!\d))/g, " ")},${cents}`;
};
const whole = (n: number) => money(n).replace(/,00$/, "");

const MODES = [
  { name: "gross salary", start: "gross", mode: "GROSS", amount: "30000", payslip: undefined },
  { name: "bank amount", start: "take-home", mode: "TAKE_HOME", amount: "23500", payslip: undefined },
  { name: "payslip", start: "payslip", mode: "PAYSLIP", amount: "30000", payslip: { paye: "3275" } },
] as const;

const inputs = (m: (typeof MODES)[number], year: TaxYear): CalculationInputs => ({
  taxYear: year,
  mode: m.mode,
  amount: Number(m.amount),
  ageBand: "UNDER_65",
  retirement: { ownMonthly: 3_000, employerMonthly: 0 },
  medical: { member: true, members: 2, monthlyContribution: 0, paidBy: "SELF" },
  ...(m.payslip ? { payslip: { payePerPeriod: Number(m.payslip.paye) } } : {}),
});

const sentence = (r: ReturnType<typeof calculate>, label: string) =>
  r.comparison
    ? `Your employer deducted ${money(r.comparison.payslipPaye)}; based on the SARS ${label} rules, our calculation gives ${money(r.comparison.calcPaye)}.`
    : `Your estimated monthly PAYE is ${money(r.monthlyPaye)}, and your take-home salary is ${money(r.takeHomeMonthly)}.`;

/** All the text in the page, including answers inside closed FAQ sections (which `innerText` leaves out). */
const bodyText = async (page: Page) => flat(await page.locator("body").textContent());

for (const year of YEARS) {
  const rules = getRuleSet(year);
  test.describe(`golden paths in ${rules.label}`, () => {
    for (const m of MODES) {
      test(`${m.name}: from the landing page to a result that is all ${rules.label}`, async ({ page }) => {
        const w = new Wizard(page);
        await w.run({
          year,
          mode: m.start,
          amount: m.amount,
          retirement: { payslip: "3000" },
          medical: { members: 2, total: "0" },
          ...(m.payslip ? { payslip: m.payslip } : {}),
        });
        const r = calculate(rules, inputs(m, year));

        // The numbers.
        expect(flat(await page.getByRole("heading", { level: 1 }).innerText())).toBe(sentence(r, rules.label));
        await expect(page.getByRole("table", { name: /Pay, deductions, tax and take-home/ }).getByRole("row", { name: /Take-home pay/ })).toContainText(
          money(r.takeHomeMonthly),
        );
        expect(flat(await page.locator("main").innerText())).toContain(money(r.annualLiability));

        // The year's words and tables.
        const main = flat(await page.locator("main").innerText());
        expect(main).toContain(`${rules.label} tax year ·`);
        const brackets = page.getByRole("table", { name: new RegExp(`SARS income tax brackets for ${rules.label}`) });
        await expect(brackets.getByRole("row").nth(1)).toContainText(`R 0 – ${whole(rules.brackets[0]!.to!)}`);
        await expect(page.getByRole("contentinfo")).toContainText(`Rules for the ${rules.label} tax year`);
        // Nothing from the other year.
        for (const other of YEARS.filter((y) => y !== year)) {
          const otherRules = getRuleSet(other);
          expect(main, `${other} figure left over`).not.toContain(whole(otherRules.brackets[0]!.to!));
          expect(main).not.toContain(`${otherRules.label} tax year`);
        }
        await expectAccessible(page, `results, ${rules.label}, ${m.name}`);
      });
    }

    test(`the questions quote ${rules.label}'s own limits`, async ({ page }) => {
      const w = new Wizard(page);
      await w.startFromLanding("gross", year);
      await w.amount("30000");
      await w.next();
      await w.age("Younger than 65");
      await w.next();
      // Retirement: the FAQ states this year's limit.
      expect(await bodyText(page)).toContain(`capped at ${whole(rules.retirement11F.annualCap)} a year (${rules.label})`);
      await w.retirement(false);
      await w.next();
      // Medical aid: the FAQ states this year's credits.
      const medical = await bodyText(page);
      expect(medical).toContain(whole(rules.medical6A.monthlyMain));
      expect(medical).toContain(whole(rules.medical6A.monthlyAdditionalDep));
      for (const other of YEARS.filter((y) => y !== year)) {
        const o = getRuleSet(other);
        if (o.medical6A.monthlyMain !== rules.medical6A.monthlyMain) expect(medical).not.toContain(whole(o.medical6A.monthlyMain));
      }
    });

    test(`the assistant names ${rules.label} and quotes only ${rules.label}'s figures`, async ({ page }) => {
      const w = new Wizard(page);
      await w.run({ year, mode: "gross", amount: "30000", retirement: { payslip: "3000" }, medical: { members: 2, total: "0" } });
      await page.getByRole("button", { name: "Ask the assistant" }).click();
      await page.getByRole("dialog", { name: "Turn on the assistant?" }).getByRole("button", { name: "Enable assistant" }).click();
      const dialog = page.getByRole("dialog", { name: "Assistant" });
      await dialog.getByLabel("Your question").fill("How much would an RA save me?");
      await dialog.getByRole("button", { name: "Send" }).click();
      const log = dialog.getByRole("log");
      await expect(log).toContainText(`These figures are for the ${rules.label} tax year.`);
      await expect(log).toContainText(whole(rules.retirement11F.annualCap));
      for (const other of YEARS.filter((y) => y !== year)) {
        const o = getRuleSet(other);
        if (o.retirement11F.annualCap !== rules.retirement11F.annualCap) expect(flat(await log.innerText())).not.toContain(whole(o.retirement11F.annualCap));
      }
    });
  });
}
