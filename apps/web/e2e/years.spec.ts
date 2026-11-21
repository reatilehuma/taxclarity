import { expect, test, type Page } from "@playwright/test";
import { calculate, getRuleSet, type CalculationInputs } from "@taxclarity/tax-engine";
import { expectAccessible } from "./axe";
import { flat, Wizard } from "./driver";

/**
 * Phase 18: the tax-year selector, in the real browser. This runs against the test build that also offers the draft
 * year 2025/26 (playwright.config.ts, port 4175). Every figure expected here is the engine's own for that year.
 */
test.use({ baseURL: "http://localhost:4175" });

const Y25 = getRuleSet("2025-26");
const Y26 = getRuleSet("2026-27");

const money = (n: number) => {
  const [whole = "0", cents = "00"] = Math.abs(n).toFixed(2).split(".");
  return `${n < 0 ? "−" : ""}R ${whole.replace(/\B(?=(\d{3})+(?!\d))/g, " ")},${cents}`;
};
const sentence = (r: ReturnType<typeof calculate>, label: string) =>
  r.comparison
    ? `Your employer deducted ${money(r.comparison.payslipPaye)}; based on the SARS ${label} rules, our calculation gives ${money(r.comparison.calcPaye)}.`
    : `Your estimated monthly PAYE is ${money(r.monthlyPaye)}, and your take-home salary is ${money(r.takeHomeMonthly)}.`;

const yearSelect = (page: Page) => page.getByLabel("Tax year", { exact: true });
const headline = async (page: Page) => flat(await page.getByRole("heading", { level: 1 }).innerText());

/** The preview's own figures: the side panel on a wide screen, the bar on a phone. */
async function previewText(page: Page) {
  const wide = (page.viewportSize()?.width ?? 0) >= 1024;
  return flat(await (wide ? page.getByRole("complementary") : page.getByRole("button", { name: /Take-home/ })).innerText());
}

const MODES = [
  { name: "gross salary", start: "gross", mode: "GROSS", amount: "30000", payslip: undefined },
  { name: "bank amount", start: "take-home", mode: "TAKE_HOME", amount: "23500", payslip: undefined },
  { name: "payslip", start: "payslip", mode: "PAYSLIP", amount: "30000", payslip: { paye: "4681" } },
] as const;

const inputsFor = (m: (typeof MODES)[number], year: "2025-26" | "2026-27"): CalculationInputs => ({
  mode: m.mode,
  amount: Number(m.amount),
  ageBand: "UNDER_65",
  taxYear: year,
  ...(m.payslip ? { payslip: { payePerPeriod: Number(m.payslip.paye) } } : {}),
});

test.describe("switching year on the results page, in all three modes", () => {
  for (const m of MODES) {
    test(m.name, async ({ page }) => {
      await new Wizard(page).run({ mode: m.start, amount: m.amount, ...(m.payslip ? { payslip: m.payslip } : {}) });
      const r26 = calculate(Y26, inputsFor(m, "2026-27"));
      const r25 = calculate(Y25, inputsFor(m, "2025-26"));
      expect(r25.annualLiability).not.toBe(r26.annualLiability); // otherwise this test proves nothing

      await expect(page.getByText("2026/27 tax year · 1 March 2026 – 28 February 2027")).toBeVisible();
      expect(await headline(page)).toBe(sentence(r26, "2026/27"));

      await yearSelect(page).selectOption("2025-26");
      await expect(page.getByText("2025/26 tax year · 1 March 2025 – 28 February 2026")).toBeVisible();
      expect(await headline(page)).toBe(sentence(r25, "2025/26"));
      await expect(page.getByTestId("year-notice")).toContainText("Tax year changed to 2025/26. Your results have been recalculated using that year's rules.");
      const bracketTable = page.getByRole("table", { name: /SARS income tax brackets for 2025\/26/ });
      await expect(bracketTable.getByRole("row").nth(1)).toContainText("R 0 – R 237 100");
      expect(flat(await page.locator("main").innerText())).not.toContain("R 245 100"); // nothing left over from 2026/27
      await expect(page.getByRole("table", { name: /Pay, deductions, tax and take-home/ }).getByRole("row", { name: /Take-home pay/ })).toContainText(
        money(r25.takeHomeMonthly),
      );

      // Back again: the first year's result, exactly.
      await yearSelect(page).selectOption("2026-27");
      expect(await headline(page)).toBe(sentence(r26, "2026/27"));
      await expect(page.getByTestId("year-notice")).toContainText("Tax year changed to 2026/27.");
    });
  }
});

test.describe("switching year in the wizard", () => {
  test("keeps what was typed, and the preview recalculates with no old-year figures", async ({ page }) => {
    const w = new Wizard(page);
    await w.start("gross");
    await w.amount("30000");
    await w.next();
    const p26 = calculate(Y26, inputsFor(MODES[0], "2026-27")).monthlyPaye;
    const p25 = calculate(Y25, inputsFor(MODES[0], "2025-26")).monthlyPaye;
    await expect.poll(() => previewText(page)).toContain(money(p26));

    await yearSelect(page).selectOption("2025-26");
    await expect.poll(() => previewText(page)).toContain(money(p25));
    expect(await previewText(page)).not.toContain(money(p26));
    // The age question names the chosen year's date.
    await expect(page.getByText("Your age group at 28 February 2026").first()).toBeAttached();

    // Back to the amount: still what was typed.
    await page.getByRole("button", { name: "Back" }).click();
    await expect(page.getByRole("textbox").first()).toHaveValue(/30\s?000/);
  });

  test("asks for the age group when it could be different, shows no numbers until then, and then shows them", async ({ page }) => {
    const w = new Wizard(page);
    await w.start("gross");
    await w.amount("30000");
    await w.next();
    await w.age("65 to 74");
    const p25 = calculate(Y25, { ...inputsFor(MODES[0], "2025-26"), ageBand: "AGE_65_74" }).monthlyPaye;

    await yearSelect(page).selectOption("2025-26");
    await expect(page.getByTestId("age-confirm").first()).toBeVisible();
    await expect(page.getByText("Check your age group for 2025/26").first()).toBeVisible();
    expect(await previewText(page)).not.toContain(money(p25));
    if ((page.viewportSize()?.width ?? 0) >= 1024) {
      await expect(page.getByTestId("preview-pending")).toBeVisible();
    } else {
      await expect(page.getByRole("button", { name: /Take-home/ })).not.toContainText("R ");
    }

    await page.locator("form").getByRole("button", { name: "Yes, this is right" }).click();
    await expect(page.getByTestId("age-confirm")).toHaveCount(0);
    await expect.poll(() => previewText(page)).toContain(money(p25));
  });

  test("an age group that cannot have changed is not asked about", async ({ page }) => {
    const w = new Wizard(page);
    await w.start("gross");
    await w.amount("30000");
    await w.next();
    await w.age("Younger than 65");
    await yearSelect(page).selectOption("2025-26");
    await expect(page.getByTestId("age-confirm")).toHaveCount(0);
  });

  test("the results page asks the same question instead of showing numbers, and the review screen shows the year", async ({ page }) => {
    const w = new Wizard(page);
    await w.run({ mode: "gross", amount: "30000", age: "75 or older" });
    await yearSelect(page).selectOption("2025-26");
    await expect(page.getByText("Check your age group for 2025/26")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(0);
    await page.getByRole("button", { name: "Yes, this is right" }).click();
    const r = calculate(Y25, { ...inputsFor(MODES[0], "2025-26"), ageBand: "AGE_75_PLUS" });
    expect(await headline(page)).toBe(sentence(r, "2025/26"));

    // Adjust my answers goes to the review screen, which shows the year the numbers are for.
    await page.getByRole("link", { name: "Adjust my answers" }).click();
    const row = page.locator("dl > div", { hasText: "Tax year" }).first();
    await expect(row).toContainText("2025/26 · 1 March 2025 – 28 February 2026");
    await row.getByRole("button", { name: /Change/ }).click();
    await expect(page.locator("#wizard-tax-year")).toBeFocused();
  });
});

test.describe("accessibility of every place the selector appears", () => {
  test("landing page", async ({ page }) => {
    await page.goto("/");
    await expect(yearSelect(page)).toBeVisible();
    await expectAccessible(page, "landing with the tax-year selector");
    // A choice made here is the one the wizard starts with.
    await yearSelect(page).selectOption("2025-26");
    await page.getByRole("link", { name: /Start with my bank deposit|Start/ }).first().click();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(yearSelect(page)).toHaveValue("2025-26");
  });

  test("wizard, preview and sheet, with the age question open", async ({ page }, info) => {
    const w = new Wizard(page);
    await w.start("gross");
    await w.amount("30000");
    await w.next();
    await w.age("65 to 74");
    await yearSelect(page).selectOption("2025-26");
    await page.waitForTimeout(250);
    await expectAccessible(page, "wizard with the age confirmation");
    await page.locator("form").getByRole("button", { name: "Yes, this is right" }).click();
    await page.waitForTimeout(250);
    await expectAccessible(page, "wizard on 2025/26");
    if (info.project.name === "mobile") {
      await page.getByRole("button", { name: /Take-home/ }).click();
      const sheet = page.getByRole("dialog");
      await expect(sheet.getByLabel("Tax year for this preview")).toBeVisible();
      await expectAccessible(page, "preview sheet with the selector");
      await sheet.getByLabel("Tax year for this preview").selectOption("2026-27");
      await expect(sheet.getByTestId("age-confirm")).toBeVisible();
      await expectAccessible(page, "preview sheet asking for the age group");
    } else {
      await expect(page.getByRole("complementary").getByLabel("Tax year for this preview")).toBeVisible();
    }
  });

  test("results page, with the year line, and the age question", async ({ page }) => {
    await new Wizard(page).run({ mode: "gross", amount: "30000", age: "65 to 74" });
    await yearSelect(page).selectOption("2025-26");
    await expectAccessible(page, "results asking for the age group");
    await page.getByRole("button", { name: "Yes, this is right" }).click();
    await expect(page.getByText("2025/26 tax year ·")).toBeVisible();
    await expectAccessible(page, "results for 2025/26");
  });
});

test("the keyboard alone can change the year", async ({ page }) => {
  await page.goto("/");
  await yearSelect(page).focus();
  await page.keyboard.press("ArrowUp"); // native select: move to the earlier option
  await expect(yearSelect(page)).toHaveValue("2025-26");
  await expect(page.getByTestId("year-notice")).toContainText("Tax year changed to 2025/26.");
  await expect(page.getByRole("button", { name: "Dismiss this message" })).toBeVisible();
});
