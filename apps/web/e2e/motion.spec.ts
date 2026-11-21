import { expect, test } from "@playwright/test";
import { Wizard } from "./driver";

test.describe("motion", () => {
  test("with no preference, the landing page animates in (so the next test means something)", async ({ page }) => {
    await page.goto("/");
    const animating = await page.evaluate(() => document.getAnimations().length);
    expect(animating).toBeGreaterThan(0);
  });

  test("reduced motion: nothing animates or transitions", async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: "reduce", viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.waitForTimeout(100);
    // Nothing is still running after a moment: every animation is over (0.01 ms) or never started.
    expect(await page.evaluate(() => document.getAnimations().filter((a) => a.playState === "running").length)).toBe(0);

    // Transitions are effectively instant everywhere in the wizard too.
    const w = new Wizard(page);
    await w.start("gross");
    await w.amount("30000");
    await w.next();
    const slow = await page.evaluate(() =>
      [...document.querySelectorAll("*")]
        .filter((el) => getComputedStyle(el).transitionDuration.split(",").some((d) => parseFloat(d) * (d.includes("ms") ? 1 : 1000) > 1))
        .slice(0, 5)
        .map((el) => el.tagName + "." + (el.getAttribute("class") ?? "").slice(0, 60)),
    );
    expect(slow, "elements with a visible transition").toEqual([]);
    await context.close();
  });

  test("reduced motion: the placeholder preview does not pulse, and smooth scrolling is off", async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: "reduce", viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await new Wizard(page).start("gross");
    await page.waitForTimeout(100);
    expect(await page.evaluate(() => document.getAnimations().filter((a) => a.playState === "running").length)).toBe(0);
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior)).toBe("auto");
    await context.close();
  });
});
