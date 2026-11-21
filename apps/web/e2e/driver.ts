import { expect, type Page } from "@playwright/test";
import { calculate, CurrentTaxRules as rules, type CalculationInputs } from "@taxclarity/tax-engine";

/** What a person types and taps, one question at a time. Reads like the screens do. */
export type Start = "take-home" | "gross" | "payslip";

export class Wizard {
  constructor(readonly page: Page) {}

  /** Taps a choice by its visible label (the real input is hidden), as a finger would. */
  async choose(role: "radio" | "checkbox", name: RegExp | string) {
    await this.page.locator("label", { has: this.page.getByRole(role, { name }) }).click();
  }

  async start(mode: Start) {
    await this.page.goto(`/wizard?start=${mode}`);
    await expect(this.page.getByRole("heading", { level: 1 })).toBeVisible();
  }

  /**
   * Starts the way a person with a chosen tax year does: on the landing page, picks the year, taps the start button,
   * picks how to begin, and continues. (Going straight to /wizard?start= would reload the page and forget the year.)
   */
  async startFromLanding(mode: Start, year: "2025-26" | "2026-27") {
    const card = { "take-home": /The money in my bank account/, gross: /My gross salary/, payslip: /My payslip/ }[mode];
    await this.page.goto("/");
    await this.page.getByLabel("Tax year", { exact: true }).selectOption(year);
    await this.page.getByRole("link", { name: "Check my salary" }).first().click();
    await expect(this.page.getByRole("heading", { level: 1 })).toBeVisible();
    await this.choose("radio", card);
    await this.next();
  }

  /** Taps the primary button and waits for the next question to be shown and focused. */
  async next(name: "Continue" | "Skip" | "Back to review" = "Continue") {
    const before = this.page.url();
    await this.page.getByRole("button", { name, exact: true }).click();
    await this.page.waitForFunction((u) => location.href !== u, before);
    await expect(this.page.getByRole("heading", { level: 1 })).toBeFocused();
  }

  async type(label: RegExp | string, value: string) {
    const field = this.page.getByLabel(label);
    await field.click();
    await field.pressSequentially(value);
  }

  async amount(value: string, frequency?: "Weekly" | "Every two weeks") {
    await this.page.getByRole("textbox").first().pressSequentially(value);
    if (frequency) await this.choose("radio", frequency);
  }

  async age(band: "Younger than 65" | "65 to 74" | "75 or older") {
    await this.choose("radio", band);
  }

  async retirement(
    opts: false | { payslip?: string; employer?: string; ra?: string } = false,
  ) {
    if (opts === false) {
      await this.choose("radio", /^No/);
      return;
    }
    await this.choose("radio", /^Yes/);
    if (opts.payslip) await this.type(/Taken off your payslip/, opts.payslip);
    if (opts.ra) await this.type(/Paid by you from your bank account/, opts.ra);
    if (opts.employer) {
      await this.choose("checkbox", /My employer also contributes/);
      await this.type(/Your employer pays in each month/, opts.employer);
    }
  }

  async medical(
    opts: false | { members?: number; total: string; paidBy?: "I pay it" | "My employer pays it all" | "We share it"; via?: "Off my payslip" | "By debit order"; employerShare?: string } = false,
  ) {
    if (opts === false) {
      await this.choose("radio", /^No/);
      return;
    }
    await this.choose("radio", /^Yes/);
    for (let i = 1; i < (opts.members ?? 1); i++) await this.page.getByRole("button", { name: "One more person" }).click();
    await this.type(/What do you pay per month in total/, opts.total);
    if (opts.paidBy) await this.choose("radio", opts.paidBy);
    if (opts.employerShare) await this.type(/How much of that does your employer pay each month/, opts.employerShare);
    if (opts.via) await this.choose("radio", opts.via);
  }

  async variable(opts: false | { bonus?: string; overtime?: string; commission?: string } = false) {
    if (opts === false) {
      await this.choose("checkbox", "None of these");
      return;
    }
    if (opts.bonus) {
      await this.choose("checkbox", /Bonus/);
      await this.type(/Bonus or 13th cheque, per year/, opts.bonus);
    }
    if (opts.overtime) {
      await this.choose("checkbox", "Overtime");
      await this.type(/Overtime, per year/, opts.overtime);
    }
    if (opts.commission) {
      await this.choose("checkbox", "Commission");
      await this.type(/Commission, per year/, opts.commission);
    }
  }

  async openExtras() {
    const toggle = this.page.getByRole("button", { name: /Optional extras/ });
    if ((await toggle.getAttribute("aria-expanded")) !== "true") await toggle.click();
  }

  async payslip(opts: { paye?: string; uif?: string } = {}) {
    if (opts.paye) await this.type(/PAYE \(income tax\) deducted/, opts.paye);
    if (opts.uif) await this.type(/UIF deducted/, opts.uif);
  }

  /** From the review screen to the results, waiting for the lazily loaded page. */
  async finish() {
    await this.page.getByRole("button", { name: "See my tax result" }).click();
    await this.page.waitForURL("**/results");
    await expect(this.page.locator("#pay-heading")).toBeVisible();
  }

  /** Answers the pages in the usual order with the same few answers, so tests only say what's different. */
  async run(opts: {
    mode: Start;
    /** Start from the landing page with this tax year chosen, instead of going straight to the wizard. */
    year?: "2025-26" | "2026-27";
    amount: string;
    frequency?: "Weekly" | "Every two weeks";
    age?: "Younger than 65" | "65 to 74" | "75 or older";
    retirement?: Parameters<Wizard["retirement"]>[0];
    medical?: Parameters<Wizard["medical"]>[0];
    variable?: Parameters<Wizard["variable"]>[0];
    extras?: () => Promise<void>;
    payslip?: { paye?: string; uif?: string };
  }) {
    if (opts.year) await this.startFromLanding(opts.mode, opts.year);
    else await this.start(opts.mode);
    await this.amount(opts.amount, opts.frequency);
    await this.next();
    await this.age(opts.age ?? "Younger than 65");
    await this.next();
    await this.retirement(opts.retirement ?? false);
    await this.next();
    await this.medical(opts.medical ?? false);
    await this.next();
    await this.variable(opts.variable ?? false);
    await this.next();
    if (opts.extras) {
      await this.openExtras();
      await opts.extras();
      await this.next();
    } else {
      await this.next("Skip");
    }
    if (opts.mode !== "take-home") {
      if (opts.payslip) {
        await this.payslip(opts.payslip);
        await this.next();
      } else if (opts.mode === "payslip") {
        await this.payslip({ paye: "0" });
        await this.next();
      } else {
        await this.next(); // nothing to check: the payslip is optional here
      }
    }
    await this.finish();
  }
}

/** Text with non-breaking spaces turned into ordinary ones, for matching "R 3 149,00". */
export const flat = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim();

export interface ExtrasOptions {
  donations?: string;
  interest?: string;
  travel?: string;
  km?: string;
  secondJob?: string;
}

/** Fills the optional extras that were asked for. */
export async function fillExtras(w: Wizard, o: ExtrasOptions) {
  if (o.donations) await w.type(/Donations to registered charities/, o.donations);
  if (o.interest) await w.type(/Interest from South African bank/, o.interest);
  if (o.travel) await w.type(/Travel allowance paid with your salary/, o.travel);
  if (o.km) await w.type(/Business kilometres/, o.km);
  if (o.secondJob) {
    await w.page.getByLabel("I had more than one employer this tax year").check();
    await w.type(/Gross pay from the other job this year/, o.secondJob);
  }
}

const money = (n: number) => {
  const [whole = "0", cents = "00"] = Math.abs(n).toFixed(2).split(".");
  return `${n < 0 ? "−" : ""}R ${whole.replace(/\B(?=(\d{3})+(?!\d))/g, " ")},${cents}`;
};

/** The page must show the engine's own figures for these inputs: the sentence, the take-home row and the year's tax. */
export async function expectResult(page: Page, inputs: CalculationInputs) {
  const r = calculate(rules, inputs);
  const sentence = r.comparison
    ? `Your employer deducted ${money(r.comparison.payslipPaye)}; based on the SARS 2026/27 rules, our calculation gives ${money(r.comparison.calcPaye)}.`
    : `Your estimated monthly PAYE is ${money(r.monthlyPaye)}, and your take-home salary is ${money(r.takeHomeMonthly)}.`;
  expect(flat(await page.getByRole("heading", { level: 1 }).innerText())).toBe(sentence);
  expect(flat(await page.locator("main").innerText())).toContain(money(r.annualLiability));
  const takeHome = page.getByRole("table", { name: /Pay, deductions, tax and take-home/ }).getByRole("row", { name: /Take-home pay/ });
  await expect(takeHome).toContainText(money(r.takeHomeMonthly));
  return r;
}
