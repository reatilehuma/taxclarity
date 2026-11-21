import { expect, test, type Page } from "@playwright/test";
import { expectResult, Wizard } from "./driver";

/** Waits until the service worker is in charge and the app's files are stored. */
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
        if (mine.length !== 1) return 0;
        return (await (await caches.open(mine[0]!)).keys()).length;
      }),
    )
    .toBeGreaterThan(5);
}

test.describe("works offline after the first visit", () => {
  test("a full calculation with the network switched off", async ({ page, context }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await waitForOfflineCopy(page);
    // The service worker is only in charge of pages opened after it took over, so reload once while online.
    await page.reload();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    await context.setOffline(true);
    await page.reload();
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Understand Your Salary");

    // Straight to the questions and on to the result, including the lazily loaded results page.
    const w = new Wizard(page);
    await w.run({ mode: "gross", amount: "30000", retirement: { payslip: "3000" }, medical: { members: 2, total: "0" } });
    await expectResult(page, {
      mode: "GROSS",
      amount: 30_000,
      ageBand: "UNDER_65",
      retirement: { ownMonthly: 3_000, employerMonthly: 0 },
      medical: { member: true, members: 2, monthlyContribution: 0, paidBy: "SELF" },
    });
    await context.setOffline(false);
  });

  test("any address opens the app offline, and an unknown one gets the friendly page", async ({ page, context }) => {
    await page.goto("/");
    await waitForOfflineCopy(page);
    await page.reload();
    await context.setOffline(true);
    await page.goto("/wizard?step=4");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.goto("/no-such-page");
    await expect(page.getByRole("heading", { level: 1, name: "We couldn't find that page" })).toBeVisible();
    await context.setOffline(false);
  });

  test("only same-site files are stored: no financial answers, nothing from other websites", async ({ page }) => {
    await page.goto("/");
    await waitForOfflineCopy(page);
    await page.reload();
    await new Wizard(page).run({ mode: "gross", amount: "31337" });
    const stored = await page.evaluate(async () => {
      const out: string[] = [];
      for (const name of await caches.keys()) for (const r of await (await caches.open(name)).keys()) out.push(r.url);
      return out;
    });
    const origin = new URL(page.url()).origin;
    expect(stored.length).toBeGreaterThan(5);
    for (const url of stored) {
      expect(url.startsWith(origin + "/"), url).toBe(true);
      expect(url).not.toContain("31337");
      expect(new URL(url).search).toBe("");
    }
  });

  test("the service worker file is served so it is always re-checked", async ({ page }) => {
    const res = await page.request.get("/sw.js");
    expect(res.status()).toBe(200);
    expect(res.headers()["cache-control"]).toBe("no-cache");
    expect(await res.text()).toContain("cleartax-");
  });
});
