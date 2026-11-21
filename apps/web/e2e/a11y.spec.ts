import { expect, test } from "@playwright/test";
import { expectAccessible } from "./axe";
import { Wizard } from "./driver";

test.describe("axe: no critical or serious accessibility problems", () => {
  test("landing page", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    // The hero's payslip turns into the dashboard after about a second and a half; measure it once it has.
    await page.waitForTimeout(2800);
    await expectAccessible(page, "landing");
  });

  test("not-found page", async ({ page }) => {
    await page.goto("/nope");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expectAccessible(page, "404");
  });

  test("every wizard step, empty and answered, with its optional parts open", async ({ page }) => {
    test.slow(); // a dozen axe scans in one run
    const w = new Wizard(page);
    await page.goto("/wizard");
    await expectAccessible(page, "step 0 start");
    await w.start("gross");
    await expectAccessible(page, "step 1 amount, empty");
    await w.amount("30000");
    await expectAccessible(page, "step 1 amount, typed");
    await w.next();
    await expectAccessible(page, "step 2 age");
    await w.age("65 to 74");
    await w.next();
    await expectAccessible(page, "step 3 retirement, nothing chosen");
    await w.retirement({ payslip: "3000", employer: "1000" });
    await expectAccessible(page, "step 3 retirement, yes");
    await w.next();
    await expectAccessible(page, "step 4 medical, nothing chosen");
    await w.medical({ members: 3, total: "5000", paidBy: "We share it", employerShare: "2000", via: "By debit order" });
    await expectAccessible(page, "step 4 medical, shared and debit order");
    await w.next();
    await expectAccessible(page, "step 5 variable pay");
    await w.variable({ bonus: "40000", overtime: "10000" });
    await expectAccessible(page, "step 5 variable pay, amounts");
    await w.next();
    await expectAccessible(page, "step 6 extras, closed");
    await w.openExtras();
    await w.type(/Donations to registered charities/, "2000");
    await w.type(/Interest from South African bank/, "30000");
    await w.type(/Travel allowance paid with your salary/, "5000");
    await w.type(/Business kilometres/, "12500");
    await page.getByLabel("I had more than one employer this tax year").check();
    await expectAccessible(page, "step 6 extras, open and filled");
    await w.next();
    await expectAccessible(page, "step 7 payslip, empty");
    await w.payslip({ paye: "99999", uif: "300" });
    await expectAccessible(page, "step 7 payslip, with warnings");
    await w.next();
    await expectAccessible(page, "step 8 review");
  });

  test("amount errors are announced and accessible", async ({ page }) => {
    const w = new Wizard(page);
    await w.start("take-home");
    const field = page.getByRole("textbox").first();
    await field.pressSequentially("5");
    await field.press("Backspace");
    await field.blur();
    await expect(field).toHaveAttribute("aria-invalid", "true");
    await expectAccessible(page, "amount error");
  });

  test("results: payslip comparison, extras and guidance", async ({ page }) => {
    const w = new Wizard(page);
    await w.run({
      mode: "payslip",
      amount: "45000",
      age: "65 to 74",
      retirement: { payslip: "2000", ra: "1500" },
      medical: { members: 2, total: "4000", via: "By debit order" },
      variable: { bonus: "40000" },
      extras: async () => {
        await w.type(/Donations to registered charities/, "3000");
        await w.type(/Travel allowance paid with your salary/, "4000");
        await w.type(/Business kilometres/, "8000");
        await w.type(/Interest from South African bank/, "40000");
      },
      payslip: { paye: "9000" },
    });
    await expectAccessible(page, "results, busy");
  });

  test("results: a plain salary and a bank amount", async ({ page }) => {
    const w = new Wizard(page);
    await w.run({ mode: "take-home", amount: "20000" });
    await expectAccessible(page, "results, bank amount");
  });
});

test.describe("axe: the live preview", () => {
  test("the side panel (wide) or the bar and sheet (phone)", async ({ page }, info) => {
    const w = new Wizard(page);
    await w.start("gross");
    await w.amount("30000");
    await page.waitForTimeout(250);
    await expectAccessible(page, "preview panel or bar");
    if (info.project.name === "mobile") {
      await page.getByRole("button", { name: /Take-home/ }).click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await expectAccessible(page, "preview sheet open");
      await page.getByRole("dialog").getByText("Full SARS bracket table").click();
      await expectAccessible(page, "preview sheet with the SARS table open");
    } else {
      await page.getByRole("complementary").getByText("Full SARS bracket table").click();
      await expectAccessible(page, "preview panel with the SARS table open");
    }
  });
});
