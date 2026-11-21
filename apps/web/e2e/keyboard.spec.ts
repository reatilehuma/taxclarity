import { expect, test, type Page } from "@playwright/test";
import { flat } from "./driver";

/** The accessible name of whatever has focus: its aria-label, its label, or its text. */
const activeName = (page: Page) =>
  page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el) return "";
    const label = (el as HTMLInputElement).labels?.[0]?.innerText;
    return (el.getAttribute("aria-label") || label || el.innerText || el.getAttribute("value") || "").replace(/\s+/g, " ").trim();
  });

/**
 * Is there a visible sign of where focus is? Looks at the pixels around the focused control (or its
 * visible label, for hidden radio buttons and checkboxes) with and without focus, and checks they differ.
 */
async function focusIsVisible(page: Page): Promise<boolean> {
  // Let any transition finish first (the progress bar slides, the page scrolls) so the two pictures are comparable.
  await page.evaluate(() => Promise.all(document.getAnimations().filter((a) => a.effect?.getComputedTiming().iterations !== Infinity).map((a) => a.finished.catch(() => undefined))));
  const box = await page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body) return null;
    let target: HTMLElement = el;
    const r0 = el.getBoundingClientRect();
    if (r0.width < 12 || r0.height < 12) target = (el.closest("label") as HTMLElement | null) ?? (el.parentElement as HTMLElement);
    // Tall things (the page's main landmark, a whole dialog) show their ring around the edge: keep to what is on screen.
    const r = target.getBoundingClientRect();
    const x = Math.max(0, r.left - 6);
    const y = Math.max(0, r.top - 6);
    const w = Math.min(window.innerWidth - x, r.width + 12);
    const h = Math.min(window.innerHeight - y, r.height + 12);
    return w > 4 && h > 4 ? { x, y, width: w, height: h } : null;
  });
  if (!box) return true; // scrolled out of the picture or zero-sized: nothing to compare
  const focused = await page.screenshot({ clip: box });
  await page.evaluate(() => {
    const el = document.activeElement as HTMLElement;
    (window as unknown as { __focused: HTMLElement }).__focused = el;
    el.blur();
  });
  const blurred = await page.screenshot({ clip: box });
  // Put focus back exactly where it was, so the walkthrough carries on from the same place.
  await page.evaluate(() => (window as unknown as { __focused: HTMLElement }).__focused.focus());
  return !focused.equals(blurred);
}

/** Presses Tab until focus reaches something whose name matches; checks every stop on the way has a focus indicator. */
async function tabTo(page: Page, match: RegExp, { max = 80 }: { max?: number } = {}) {
  const stops: string[] = [];
  for (let i = 0; i < max; i++) {
    await page.keyboard.press("Tab");
    const name = await activeName(page);
    stops.push(name);
    // A busy machine can catch the page mid-scroll or mid-transition, which blurs the comparison: look again before concluding.
    let visible = await focusIsVisible(page);
    for (let again = 0; again < 6 && !visible; again++) {
      await page.waitForTimeout(250);
      visible = await focusIsVisible(page);
    }
    expect(visible, `no visible focus on "${name}" (after ${stops.join(" > ")})`).toBe(true);
    if (!visible) break;
    if (match.test(name)) return name;
  }
  throw new Error(`never reached ${match} by Tab; stops: ${stops.join(" > ")}`);
}

const progress = (page: Page) => page.locator("p[aria-live=polite]").first();

/** A new question is on screen and focus has moved to its heading (what a screen-reader user hears first). */
async function arrive(page: Page, step: number) {
  await expect(page).toHaveURL(new RegExp(`step=${step}`));
  // The heading element is reused from step to step, so wait for the new step to be drawn (the progress
  // label changes with it) and for the page to settle before asking where focus is.
  await expect(progress(page)).toHaveText(new RegExp(`Step ${step} of`));
  await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
  await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
}


test.describe("keyboard only", () => {
  test("landmarks and the skip link", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Tab");
    expect(await activeName(page)).toBe("Skip to content");
    expect(await focusIsVisible(page)).toBe(true);
    await page.keyboard.press("Enter");
    await expect.poll(() => page.evaluate(() => document.activeElement?.id)).toBe("main");
    await expect(page.getByRole("banner")).toHaveCount(1);
    await expect(page.getByRole("main")).toHaveCount(1);
    await expect(page.getByRole("contentinfo")).toHaveCount(1);
    await expect(page.getByRole("navigation", { name: "Main" })).toHaveCount(1);
  });

  test("the whole flow, from the landing page to the result and back to the review", async ({ page }, info) => {
    test.slow(); // dozens of Tab stops, each checked with two screenshots
    await page.goto("/");
    await page.keyboard.press("Tab"); // skip link
    await tabTo(page, /Start with my salary/);
    await page.keyboard.press("Enter");
    await arrive(page, 1);

    // Step 1: the amount.
    await tabTo(page, /Gross pay/);
    await page.keyboard.type("30000");
    await page.keyboard.press("Enter"); // Enter in a field moves on
    await arrive(page, 2);
    await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
    await expect(progress(page)).toHaveText(/Step 2 of 8: Your age/);

    // Step 2: age is already "Younger than 65".
    await tabTo(page, /^Continue$/);
    await page.keyboard.press("Enter");
    await arrive(page, 3);

    // Step 3: retirement. Yes, R3 000 off the payslip.
    await tabTo(page, /^Yes/);
    await page.keyboard.press("Space");
    await tabTo(page, /Taken off your payslip/);
    await page.keyboard.type("3000");
    await tabTo(page, /^Continue$/);
    await page.keyboard.press("Enter");
    await arrive(page, 4);
    await expect(progress(page)).toHaveText(/Step 4 of 8: Medical aid/);

    // Step 4: medical aid. Yes, two people, nothing to pay.
    await tabTo(page, /^Yes/);
    await page.keyboard.press("Space");
    await tabTo(page, /One more person/);
    await page.keyboard.press("Enter");
    await tabTo(page, /What do you pay per month in total/);
    await page.keyboard.type("0");
    await tabTo(page, /^Continue$/);
    await page.keyboard.press("Enter");
    await arrive(page, 5);

    // Step 5: no extras. Then the optional extras: skip.
    await tabTo(page, /None of these/);
    await page.keyboard.press("Space");
    await tabTo(page, /^Continue$/);
    await page.keyboard.press("Enter");
    await arrive(page, 6);
    await tabTo(page, /Optional extras/);
    await page.keyboard.press("Enter"); // open it with the keyboard
    await expect(page.getByRole("button", { name: /Optional extras/ })).toHaveAttribute("aria-expanded", "true");
    await tabTo(page, /Donations to registered charities/);
    await page.keyboard.type("1000");
    await tabTo(page, /^Continue$/);
    await page.keyboard.press("Enter");
    await arrive(page, 7);

    // Step 7: payslip PAYE.
    await tabTo(page, /PAYE \(income tax\) deducted/);
    await page.keyboard.type("3149");
    await page.keyboard.press("Enter");
    await arrive(page, 8);
    await expect(progress(page)).toHaveText(/Step 8 of 8: Review/);

    // Review, then the result.
    await tabTo(page, /See my tax result/);
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/results/);
    await expect(page.locator("#pay-heading")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Your employer deducted R 3 149,00");

    // On the result page: copy the summary, then adjust.
    await tabTo(page, /Copy summary/);
    await tabTo(page, /Download PDF summary/); // reachable, with a visible focus ring like every other stop
    await tabTo(page, /Start over/);
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Shift+Tab"); // Adjust, Copy summary, Download PDF summary, Ask the assistant, Start over
    await expect(page.getByRole("link", { name: "Adjust my answers" })).toBeFocused();
    await page.keyboard.press("Enter");
    await arrive(page, 8);

    // Edit a group from the review by keyboard and come back to it.
    await tabTo(page, /Edit Your retirement savings/);
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/step=3&from=review/);
    await tabTo(page, /Back to review/);
    await page.keyboard.press("Enter");
    await arrive(page, 8);
    info.annotations.push({ type: "note", description: "keyboard-only run complete" });
  });

  test("every tooltip opens by keyboard focus and closes again", async ({ page }) => {
    await page.goto("/wizard?start=gross");
    await page.getByRole("textbox").first().pressSequentially("30000");
    await page.waitForTimeout(250);
    const isDesktop = (page.viewportSize()?.width ?? 0) >= 1024;
    test.skip(!isDesktop, "the summary panel with tooltips is the desktop layout; the sheet has the same rows");
    // Only the tooltip of the focused "i" is shown (hidden ones are not in the accessibility tree).
    const tooltip = page.getByRole("complementary").getByRole("tooltip");
    await page.getByRole("complementary").locator("[tabindex='0']").first().focus();
    await expect(tooltip).toHaveCount(1);
    const first = await tooltip.innerText();
    expect(first.length).toBeGreaterThan(10);
    await page.keyboard.press("Tab");
    await expect(tooltip).toHaveCount(1);
    expect(await tooltip.innerText()).not.toBe(first);
    await page.getByRole("textbox").first().focus();
    await expect(tooltip).toHaveCount(0);
  });

  test("phone: the preview bar opens a sheet that keeps Tab inside, and Escape returns focus", async ({ page }) => {
    test.skip((page.viewportSize()?.width ?? 0) >= 1024, "phone layout only");
    await page.goto("/wizard?start=gross");
    await page.getByRole("textbox").first().pressSequentially("30000");
    await page.waitForTimeout(250);
    await page.getByRole("button", { name: /Take-home/ }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByRole("button", { name: /Close preview/ })).toBeFocused();
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press("Tab");
      expect(await page.evaluate(() => !!document.activeElement?.closest("[role=dialog]"))).toBe(true);
    }
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(flat(await activeName(page))).toContain("Take-home");
  });
});
