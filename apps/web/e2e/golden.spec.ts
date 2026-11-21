import { expect, test } from "@playwright/test";
import { calculate, CurrentTaxRules as rules, type CalculationInputs } from "@taxclarity/tax-engine";
import { flat, Wizard } from "./driver";

const rand = (n: number) => flat(
  `R ${Math.abs(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, " ").replace(".", ",")}`.replace(/^R (.*)/, (_m, rest: string) => `R ${rest}`),
);

/** The sentence and tables the page shows must be the engine's own figures. */
async function expectResult(page: import("@playwright/test").Page, inputs: CalculationInputs) {
  const r = calculate(rules, inputs);
  const h1 = flat(await page.getByRole("heading", { level: 1 }).innerText());
  const sentence = r.comparison
    ? `Your employer deducted ${rand(r.comparison.payslipPaye)}; based on the SARS 2026/27 rules, our calculation gives ${rand(r.comparison.calcPaye)}.`
    : `Your estimated monthly PAYE is ${rand(r.monthlyPaye)}, and your take-home salary is ${rand(r.takeHomeMonthly)}.`;
  expect(h1).toBe(sentence);
  const main = flat(await page.locator("main").innerText());
  expect(main).toContain(rand(r.annualLiability));
  const takeHomeRow = page.getByRole("table", { name: /Pay, deductions, tax and take-home/ }).getByRole("row", { name: /Take-home pay/ });
  await expect(takeHomeRow).toContainText(rand(r.takeHomeMonthly));
  return r;
}

test.describe("golden paths: the three ways to start", () => {
  test("bank amount (estimate): R23 673,88 take-home comes back as a gross near R30 000", async ({ page }) => {
    const w = new Wizard(page);
    await w.run({ mode: "take-home", amount: "23673.88", retirement: { payslip: "3000" }, medical: { members: 2, total: "0" } });
    const r = await expectResult(page, {
      mode: "TAKE_HOME",
      amount: 23_673.88,
      ageBand: "UNDER_65",
      retirement: { ownMonthly: 3_000, employerMonthly: 0 },
      medical: { member: true, members: 2, monthlyContribution: 0, paidBy: "SELF" },
    });
    expect(r.confidence).toBe("ESTIMATE");
    await expect(page.getByText("Estimate", { exact: true }).first()).toBeVisible();
    await expect(page.getByText(/We estimate your gross salary at/)).toBeVisible();
    expect(Math.abs(r.grossMonthly - 30_000)).toBeLessThan(1);
  });

  test("gross salary: T1 gives PAYE R3 149,00 and take-home R23 673,88", async ({ page }) => {
    const w = new Wizard(page);
    await w.run({ mode: "gross", amount: "30000", retirement: { payslip: "3000" }, medical: { members: 2, total: "0" } });
    await expectResult(page, {
      mode: "GROSS",
      amount: 30_000,
      ageBand: "UNDER_65",
      retirement: { ownMonthly: 3_000, employerMonthly: 0 },
      medical: { member: true, members: 2, monthlyContribution: 0, paidBy: "SELF" },
    });
    expect(flat(await page.locator("main").innerText())).toContain("R 3 149,00");
    expect(flat(await page.locator("main").innerText())).toContain("R 23 673,88");
    await expect(page.getByText("Payslip-accurate").first()).toBeVisible();
  });

  test("payslip: the comparison panel appears with the neutral explanation", async ({ page }) => {
    const w = new Wizard(page);
    await w.run({
      mode: "payslip",
      amount: "30000",
      retirement: { payslip: "3000" },
      medical: { members: 2, total: "0" },
      payslip: { paye: "3500", uif: "177.12" },
    });
    const r = await expectResult(page, {
      mode: "PAYSLIP",
      amount: 30_000,
      ageBand: "UNDER_65",
      retirement: { ownMonthly: 3_000, employerMonthly: 0 },
      medical: { member: true, members: 2, monthlyContribution: 0, paidBy: "SELF" },
      payslip: { payeMonthly: 3_500, uifMonthly: 177.12 },
    });
    expect(r.comparison!.diff).toBeGreaterThan(0);
    await expect(page.getByRole("heading", { level: 2, name: /Your payslip compared with our calculation/ })).toBeVisible();
    await expect(page.getByText(/doesn’t automatically mean your employer made a mistake/)).toBeVisible();
  });
});

test.describe("golden paths: results page behaviour", () => {
  test("Adjust my answers returns to the review with answers kept, and a change updates the result", async ({ page }) => {
    const w = new Wizard(page);
    await w.run({ mode: "gross", amount: "30000" });
    await page.getByRole("link", { name: "Adjust my answers" }).click();
    await expect(page).toHaveURL(/step=8/);
    await expect(page.getByRole("heading", { level: 1, name: "Check your answers" })).toBeVisible();
    await page.getByRole("link", { name: "Edit Your income" }).click();
    await page.getByRole("textbox").first().fill("");
    await page.getByRole("textbox").first().pressSequentially("40000");
    await w.next("Back to review");
    await w.finish();
    await expectResult(page, { mode: "GROSS", amount: 40_000, ageBand: "UNDER_65" });
  });

  test("Start over clears everything", async ({ page }) => {
    const w = new Wizard(page);
    await w.run({ mode: "gross", amount: "30000" });
    await page.getByRole("button", { name: "Start over" }).click();
    await expect(page).toHaveURL(/step=0/);
    for (const radio of await page.getByRole("radio").all()) await expect(radio).not.toBeChecked();
  });

  test("refreshing the results sends you to the start: nothing is stored", async ({ page }) => {
    const w = new Wizard(page);
    await w.run({ mode: "gross", amount: "30000" });
    await page.reload();
    await expect(page).toHaveURL(/step=0/);
    expect(await page.evaluate(() => localStorage.length + sessionStorage.length)).toBe(0);
  });

  test("copy summary puts an estimate-labelled summary on the clipboard", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    const w = new Wizard(page);
    await w.run({ mode: "gross", amount: "30000" });
    await page.getByRole("button", { name: "Copy summary" }).click();
    await expect(page.getByText(/^Copied/)).toBeVisible();
    const text = flat(await page.evaluate(() => navigator.clipboard.readText()));
    expect(text).toContain("Estimate only. Not tax advice, not a SARS assessment.");
    expect(text).toContain("2026/27");
  });
});
