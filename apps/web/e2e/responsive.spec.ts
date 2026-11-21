import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { fillExtras, Wizard } from "./driver";

/** The four widths from the PRD (§17.4). */
const WIDTHS = [360, 768, 1024, 1440] as const;

/**
 * Anything that sticks out past the right edge of the screen, other than inside a box that scrolls on its own.
 * (A table that scrolls sideways inside its own box is fine; the page scrolling sideways is not.)
 */
const poking = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll("body *")]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0 || r.right <= window.innerWidth + 0.5) return false;
        const style = getComputedStyle(el);
        if (style.position === "fixed" || style.visibility === "hidden") return false;
        for (let p = el.parentElement; p; p = p.parentElement) {
          const o = getComputedStyle(p).overflowX;
          if (o === "auto" || o === "scroll" || o === "hidden") return false;
        }
        return true;
      })
      .map((el) => `${el.tagName.toLowerCase()}: ${(el.textContent ?? "").trim().slice(0, 30)}`)
      .slice(0, 5),
  );

async function expectFits(page: Page, where: string) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, `${where}: page scrolls sideways by ${overflow}px`).toBeLessThanOrEqual(0);
  expect(await poking(page), `${where}: elements past the right edge`).toEqual([]);
}

/** Buttons, fields and choices people tap should be at least 44px tall (PRD §13.2). */
async function smallTargets(page: Page) {
  return page.evaluate(() => {
    const selector = "button, a[href], input:not([type=radio]):not([type=checkbox]), label:has(input[type=radio]), label:has(input[type=checkbox]), summary";
    return [...document.querySelectorAll<HTMLElement>(selector)]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return false;
        // Links inside a sentence, and the skip link, are exempt.
        if (el.tagName === "A" && (el.closest("p, li, footer") || el.classList.contains("sr-only"))) return false;
        return r.height < 44 - 0.5;
      })
      .map((el) => `${el.tagName.toLowerCase()} "${(el.innerText || el.getAttribute("aria-label") || "").trim().slice(0, 30)}" ${Math.round(el.getBoundingClientRect().height)}px`);
  });
}

/** These tests set their own sizes, so they run once (in the desktop project) instead of twice. */
const runOnce = (info: TestInfo) => test.skip(info.project.name !== "desktop", "sizes are set inside the test");

test.describe("layout at 360, 768, 1024 and 1440", () => {

  for (const width of WIDTHS) {
    test(`${width}px: nothing sticks out and the right preview appears`, async ({ page }, info) => {
      runOnce(info);
      await page.setViewportSize({ width, height: 800 });
      const w = new Wizard(page);

      await page.goto("/");
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expectFits(page, "landing");

      await w.start("gross");
      await w.amount("30000");
      await page.waitForTimeout(250);
      await expectFits(page, "step 1");
      // Wide: a side panel. Narrow: a bar. Never both.
      const wide = width >= 1024;
      await expect(page.getByRole("complementary")).toHaveCount(wide ? 1 : 0);
      await expect(page.getByRole("button", { name: /Take-home/ })).toHaveCount(wide ? 0 : 1);

      await w.next();
      await w.age("65 to 74");
      await w.next();
      await w.retirement({ payslip: "3000", employer: "1000", ra: "1000" });
      await expectFits(page, "step 3 open");
      await w.next();
      await w.medical({ members: 3, total: "6000", paidBy: "We share it", employerShare: "2000", via: "By debit order" });
      await expectFits(page, "step 4 open");
      await w.next();
      await w.variable({ bonus: "40000", overtime: "10000", commission: "20000" });
      await expectFits(page, "step 5");
      await w.next();
      await w.openExtras();
      await fillExtras(w, { donations: "2000", interest: "30000", travel: "5000", km: "12500", secondJob: "100000" });
      await expectFits(page, "step 6 extras");
      await w.next();
      await w.payslip({ paye: "99999", uif: "300" });
      await expectFits(page, "step 7 with warnings");
      await w.next();
      await expectFits(page, "review");
      await w.finish();
      await expectFits(page, "results");
      // Every table is complete on screen or scrolls inside its own box.
      for (const table of await page.getByRole("table").all()) await expect(table).toBeVisible();
    });

    test(`${width}px: tap targets are big enough and the bar never covers a button`, async ({ page }, info) => {
      runOnce(info);
      await page.setViewportSize({ width, height: 800 });
      const w = new Wizard(page);
      await w.start("gross");
      await w.amount("30000");
      await w.next();
      await page.waitForTimeout(150);
      if (width <= 768) {
        const small = await smallTargets(page);
        expect(small, "controls shorter than 44px").toEqual([]);
      }
      // Scroll to the bottom of the question: the Continue button must be reachable, not under the preview bar.
      await page.evaluate(() => window.scrollTo(0, 0));
      const cont = page.getByRole("button", { name: "Continue", exact: true });
      await cont.scrollIntoViewIfNeeded();
      const box = await cont.boundingBox();
      const hit = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest("button")?.textContent ?? "", {
        x: box!.x + box!.width / 2,
        y: box!.y + box!.height / 2,
      });
      expect(hit).toContain("Continue");
    });
  }
});
