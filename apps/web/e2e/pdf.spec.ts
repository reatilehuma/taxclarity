import { expect, test, type Page, type Request } from "@playwright/test";
import { readPdf } from "@taxclarity/pdf-export/testing";
import { calculate, getRuleSet, type TaxYear } from "@taxclarity/tax-engine";
import { readFileSync } from "node:fs";
import { expectAccessible } from "./axe";
import { flat, Wizard } from "./driver";

/**
 * Phase 20: "Download PDF summary" in the real browser. The year-by-year tests run against the test build that also offers
 * the draft year (port 4175); the last test runs against the production build (port 4173).
 */
const money = (n: number) => {
  const [whole = "0", cents = "00"] = Math.abs(n).toFixed(2).split(".");
  return `R ${whole.replace(/\B(?=(\d{3})+(?!\d))/g, " ")},${cents}`;
};
const localToday = () => {
  const d = new Date();
  const two = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`;
};

const BUTTON = "Download PDF summary";

/** A person who has a bonus, an employer contribution and interest above the tax-free amount: five rows in Table 1. */
async function toResults(page: Page, year?: TaxYear) {
  await new Wizard(page).run({
    ...(year ? { year } : {}),
    mode: "gross",
    amount: "30000",
    retirement: { payslip: "3000", employer: "1000" },
    medical: { members: 2, total: "0" },
    variable: { bonus: "30000" },
    extras: async () => {
      await page.getByLabel(/Interest from South African bank/).fill("30000");
    },
  });
}

async function downloadPdf(page: Page) {
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: BUTTON }).click()]);
  const path = await download.path();
  return { name: download.suggestedFilename(), bytes: new Uint8Array(readFileSync(path)) };
}

test.describe("the PDF summary, in both tax years", () => {
  test.use({ baseURL: "http://localhost:4175" });

  for (const year of ["2025-26", "2026-27"] as TaxYear[]) {
    const rules = getRuleSet(year);
    test(`${rules.label}: a real PDF, named for the year, with the figures the page shows`, async ({ page }) => {
      await toResults(page, year);
      const r = calculate(rules, {
        taxYear: year,
        mode: "GROSS",
        amount: 30_000,
        ageBand: "UNDER_65",
        retirement: { ownMonthly: 3_000, employerMonthly: 1_000 },
        medical: { member: true, members: 2, monthlyContribution: 0, paidBy: "SELF" },
        variablePay: { bonusAnnual: 30_000 },
        advanced: { localInterestAnnual: 30_000 },
      });

      const seen: Request[] = [];
      page.on("request", (q) => seen.push(q));
      const { name, bytes } = await downloadPdf(page);
      expect(name).toBe(`cleartax-sa-summary-${year}-${localToday()}.pdf`);
      expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");

      const pdf = await readPdf(bytes);
      for (const p of pdf.pages) expect([Math.round(p.width), Math.round(p.height)]).toEqual([595, 842]); // A4 portrait
      const text = flat(pdf.pages.map((p) => p.text).join(" "));
      for (const piece of [
        "South African Income Tax — Calculation Summary",
        "Independent estimate — not a SARS assessment",
        "Income and taxable amounts",
        "Disclaimer",
        `Page 1 of ${pdf.pages.length}`,
        "Deductions",
        "Tax calculation",
        "Calculated annual income-tax liability",
        "From salary to bank account",
        "What this does not include",
        rules.label,
        `1 March ${rules.startDate.slice(0, 4)} – 28 February ${rules.endDate.slice(0, 4)}`,
        "This independent calculator provides an estimate",
        `Rules ${rules.rulesVersion}`,
      ]) {
        expect(text, piece).toContain(piece);
      }
      // Table 1: every row and the total, with the engine's amounts.
      for (const n of [r.grossAnnual, r.variablePay.totalAnnual, r.interest.taxableAnnual, r.incomeBeforeDeductions]) expect(text, money(n)).toContain(money(n));
      expect(text).toContain("Total income");
      // And nothing identifying: no reference number, no personal details asked for or shown.
      expect(text.toLowerCase()).not.toContain("reference number");

      // Making it used only this site: the lazy chunk and the two font files, read with GET.
      for (const q of seen) {
        expect(new URL(q.url()).origin, q.url()).toBe("http://localhost:4175");
        expect(q.method(), q.url()).toBe("GET");
      }
      expect(seen.filter((q) => /InterTabular-(400|700)/.test(q.url()))).toHaveLength(2);
      await expect(page.getByText("Your PDF summary has been saved to your downloads.")).toBeVisible();
    });
  }

  test("the button sits beside Copy summary and the page is still accessible with it", async ({ page }) => {
    await toResults(page);
    const row = page.getByRole("button", { name: "Copy summary" }).locator("..");
    await expect(row.getByRole("button", { name: BUTTON })).toBeVisible();
    await expectAccessible(page, "results with the PDF button");
  });
});

test.describe("the production build", () => {
  test("downloads the PDF, and the PDF code is not fetched until the button is pressed", async ({ page }) => {
    const seen: string[] = [];
    page.on("request", (q) => seen.push(q.url()));
    await toResults(page);
    expect(seen.filter((u) => /createSummaryPdf|InterTabular/.test(u)), "loaded before it was asked for").toEqual([]);
    const { name, bytes } = await downloadPdf(page);
    expect(name).toBe(`cleartax-sa-summary-2026-27-${localToday()}.pdf`);
    expect(flat((await readPdf(bytes)).pages.map((p) => p.text).join(" "))).toContain("Calculation Summary");
    expect(seen.some((u) => /createSummaryPdf/.test(u))).toBe(true);
  });
});

/**
 * Phase 22: the export is as trustworthy as the rest of the app. Every mode in both years, on desktop and on a phone
 * (the two projects), the privacy of making it, offline use, and what happens when making it fails.
 */
const MODES = {
  gross: { label: "gross salary", run: { mode: "gross" as const, amount: "30000" }, shows: ["Gross remuneration"], not: ["Payslip comparison"] },
  "take-home": { label: "bank amount", run: { mode: "take-home" as const, amount: "25000" }, shows: ["Gross remuneration", "How we got these numbers"], not: ["Payslip comparison"] },
  payslip: { label: "payslip", run: { mode: "payslip" as const, amount: "30000", payslip: { paye: "3000", uif: "177" } }, shows: ["Payslip comparison", "PAYE on your payslip"], not: [] },
};

async function requestsDuring<T>(page: Page, action: () => Promise<T>) {
  const seen: Request[] = [];
  const failed: string[] = [];
  const onRequest = (q: Request) => seen.push(q);
  const onFailed = (q: Request) => failed.push(q.url());
  page.on("request", onRequest);
  page.on("requestfailed", onFailed);
  const value = await action();
  page.off("request", onRequest);
  page.off("requestfailed", onFailed);
  return { seen, failed, value };
}

test.describe("every mode, both years: a PDF that matches the page and sends nothing", () => {
  test.use({ baseURL: "http://localhost:4175" });
  for (const year of ["2025-26", "2026-27"] as TaxYear[]) {
    for (const [key, mode] of Object.entries(MODES)) {
      test(`${getRuleSet(year).label}, ${mode.label}`, async ({ page }) => {
        const problems: string[] = [];
        page.on("pageerror", (e) => problems.push(e.message));
        await new Wizard(page).run({ ...mode.run, year });
        await expect(page.getByRole("button", { name: BUTTON })).toBeEnabled();

        const { seen, failed, value } = await requestsDuring(page, () => downloadPdf(page));
        const { name, bytes } = value;
        expect(name).toBe(`cleartax-sa-summary-${year}-${localToday()}.pdf`);
        const pdf = await readPdf(bytes);
        const text = flat(pdf.pages.map((p) => p.text).join(" "));

        // The right year and no other, and each part the mode should have.
        expect(text).toContain(year.replace("-", "/"));
        expect(text).not.toContain(year === "2026-27" ? "2025/26" : "2026/27");
        for (const piece of ["Income and taxable amounts", "Deductions", "Tax calculation", "From salary to bank account", "What this does not include", "Disclaimer", ...mode.shows]) expect(text, piece).toContain(piece);
        for (const piece of mode.not) expect(text, piece).not.toContain(piece);
        pdf.pages.forEach((p, i) => expect(flat(p.text), `page ${i + 1}`).toContain(`Page ${i + 1} of ${pdf.pages.length}`));
        // The file knows only the app and the title; the creation date is the one date in it.
        expect(Object.keys(pdf.info).filter((k) => ["Author", "Subject", "Keywords"].includes(k) && pdf.info[k])).toEqual([]);

        // Making it used this site only, asked only for files, sent no data, and nothing failed.
        expect(failed).toEqual([]);
        for (const q of seen) {
          expect(new URL(q.url()).origin, q.url()).toBe("http://localhost:4175");
          expect(q.method(), q.url()).toBe("GET");
          expect(q.postData(), q.url()).toBeNull();
        }
        expect(problems).toEqual([]);
        await expect(page.getByText("Your PDF summary has been saved to your downloads.")).toBeVisible();
        await expectAccessible(page, `results after the PDF, ${key}`);
      });
    }
  }
});

test.describe("when making the PDF fails", () => {
  test.use({ baseURL: "http://localhost:4175", serviceWorkers: "block" });

  test("says so plainly, keeps the results, and a second try works", async ({ page }) => {
    await toResults(page);
    const heading = await page.getByRole("heading", { level: 1 }).textContent();
    // The font cannot be loaded, so the PDF cannot be made.
    await page.route(/InterTabular/, (route) => route.abort());
    await page.getByRole("button", { name: BUTTON }).click();
    await expect(page.getByText("We couldn't create the PDF. Please try again.")).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: "We couldn't create the PDF" })).toBeVisible();
    // The results are untouched and the other buttons still work.
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(heading ?? "");
    await expect(page.getByRole("button", { name: "Copy summary" })).toBeEnabled();
    await expectAccessible(page, "results after a failed PDF");

    await page.unroute(/InterTabular/);
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Try again" }).click()]);
    expect(download.suggestedFilename()).toMatch(/^cleartax-sa-summary-2026-27-/);
    await expect(page.getByText("We couldn't create the PDF")).toHaveCount(0);
    await expect(page.getByText("Your PDF summary has been saved to your downloads.")).toBeVisible();
  });

  test("shows 'Creating PDF…' while it works and cannot be pressed twice", async ({ page }) => {
    await toResults(page);
    // Hold the font back for a moment so the working state can be seen.
    await page.route(/InterTabular-400/, async (route) => {
      await new Promise((r) => setTimeout(r, 800));
      await route.continue();
    });
    await page.getByRole("button", { name: BUTTON }).click();
    const busy = page.getByRole("button", { name: "Creating PDF…" });
    await expect(busy).toBeDisabled();
    await expect(page.getByText("Your PDF summary has been saved to your downloads.")).toBeVisible();
    await expect(page.getByRole("button", { name: BUTTON })).toBeEnabled();
  });
});

/** Waits until the service worker is in charge and the app's files, the PDF code and the fonts are stored. */
async function waitForOfflineCopy(page: Page) {
  await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    if (!reg.active) throw new Error("no active service worker");
  });
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const keys = await caches.keys();
        const mine = keys.filter((k) => k.startsWith("cleartax-"));
        if (mine.length !== 1) return "";
        const urls = (await (await caches.open(mine[0]!)).keys()).map((r) => new URL(r.url).pathname);
        const has = (re: RegExp) => urls.some((u) => re.test(u));
        return has(/createSummaryPdf/) && has(/InterTabular-400/) && has(/InterTabular-700/) ? "ready" : "";
      }),
    )
    .toBe("ready");
}

test.describe("offline", () => {
  test("after the first visit the PDF is made with the network off, and nothing is requested from anywhere else", async ({ page, context }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    // The PDF code and fonts are kept for offline use by the service worker, though the landing page never loads them.
    await waitForOfflineCopy(page);
    await page.reload();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    await context.setOffline(true);
    await page.reload();
    await new Wizard(page).run({ mode: "gross", amount: "30000", retirement: { payslip: "3000" }, medical: { members: 2, total: "0" } });
    const { seen, failed, value } = await requestsDuring(page, () => downloadPdf(page));
    await context.setOffline(false);

    expect(failed, "a request that needed the network").toEqual([]);
    for (const q of seen) expect(new URL(q.url()).origin, q.url()).toBe("http://localhost:4173");
    expect(value.name).toBe(`cleartax-sa-summary-2026-27-${localToday()}.pdf`);
    const text = flat((await readPdf(value.bytes)).pages.map((p) => p.text).join(" "));
    for (const piece of ["Calculation Summary", "Tax calculation", "Calculated annual income-tax liability", "Disclaimer"]) expect(text, piece).toContain(piece);
    await expect(page.getByText("Your PDF summary has been saved to your downloads.")).toBeVisible();
  });
});
