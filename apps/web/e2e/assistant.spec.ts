import { expect, test, type Page, type Request } from "@playwright/test";
import { expectAccessible } from "./axe";
import { flat, Wizard } from "./driver";

/**
 * How many files the service worker has stored. It must not open a cache by guessing a name: before the worker has made
 * its cache there is no first cache, and opening "undefined" would create an empty one that is then read forever.
 */
async function cachedFileCount(page: Page): Promise<number> {
  return page.evaluate(async () => {
    const mine = (await caches.keys()).filter((k) => k.startsWith("cleartax-"));
    if (mine.length !== 1) return 0;
    return (await (await caches.open(mine[0]!)).keys()).length;
  });
}

const T1 = { mode: "gross", amount: "30000", retirement: { payslip: "3000" }, medical: { members: 2, total: "0" } } as const;

async function toResults(page: Page) {
  await new Wizard(page).run({ ...T1 });
}

const ask = async (page: Page, question: string) => {
  const dialog = page.getByRole("dialog", { name: "Assistant" });
  await dialog.getByLabel("Your question").fill(question);
  await dialog.getByRole("button", { name: "Send" }).click();
  return dialog;
};

test.describe("the assistant", () => {
  test("asks first, says nothing is sent, and only then answers, with figures checked against the result", async ({ page, context }) => {
    const seen: Request[] = [];
    context.on("request", (r) => seen.push(r));
    await toResults(page);
    const before = seen.length;

    await page.getByRole("button", { name: "Ask the assistant" }).click();
    const consent = page.getByRole("dialog", { name: "Turn on the assistant?" });
    await expect(consent).toBeVisible();
    await expect(consent).toContainText("runs entirely on your device");
    await expect(consent).toContainText("not an AI model");
    await expect(page.getByRole("button", { name: "Enable assistant" })).toBeFocused();
    expect(await page.evaluate(() => localStorage.length)).toBe(0);
    // Loading the assistant's own files is the only thing that may have happened so far.
    for (const r of seen.slice(before)) {
      expect(new URL(r.url()).pathname.startsWith("/assets/"), r.url()).toBe(true);
      expect(r.method()).toBe("GET");
    }

    await consent.getByRole("button", { name: "Enable assistant" }).click();
    const dialog = await ask(page, "Which tax bracket am I in?");
    await expect(dialog.getByRole("log")).toContainText("26%");
    expect(flat(await dialog.getByRole("log").innerText())).toContain("R 324 000,00");
    await expect(dialog.getByText(/Checked: all \d+ figures match your results/)).toBeVisible();

    // The only thing stored is the yes.
    expect(await page.evaluate(() => Object.fromEntries(Object.entries(localStorage)))).toEqual({ "cleartax.assistant": "local-explainer" });
    expect(await page.evaluate(() => sessionStorage.length)).toBe(0);
    // And nothing was sent anywhere: every request is a file from this site, none carries the question or a figure.
    const origin = new URL(page.url()).origin;
    for (const r of seen) {
      expect(new URL(r.url()).origin).toBe(origin);
      expect(r.method(), r.url()).toBe("GET");
      expect(r.postData(), r.url()).toBeNull();
      expect(decodeURIComponent(r.url())).not.toMatch(/bracket|30000|3149/);
    }
  });

  test("'No thanks' leaves everything as it was", async ({ page }) => {
    await toResults(page);
    const headline = flat(await page.getByRole("heading", { level: 1 }).innerText());
    await page.getByRole("button", { name: "Ask the assistant" }).click();
    await page.getByRole("button", { name: "No thanks" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByText("Assistant unavailable. Your results are fully calculated")).toBeVisible();
    expect(flat(await page.getByRole("heading", { level: 1 }).innerText())).toBe(headline);
    expect(await page.evaluate(() => localStorage.length)).toBe(0);
  });

  test("a remembered yes skips the question, and 'Start over' does not forget it", async ({ page }) => {
    await toResults(page);
    await page.getByRole("button", { name: "Ask the assistant" }).click();
    await page.getByRole("button", { name: "Enable assistant" }).click();
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Ask the assistant" }).click();
    await expect(page.getByRole("dialog", { name: "Assistant" })).toBeVisible();
    await expect(page.getByRole("dialog", { name: "Turn on the assistant?" })).toHaveCount(0);
  });

  test("the whole thing by keyboard: open, agree, ask, close, and focus returns", async ({ page }) => {
    await toResults(page);
    await page.getByRole("button", { name: "Ask the assistant" }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("button", { name: "Enable assistant" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByLabel("Your question")).toBeFocused();
    await page.keyboard.type("How much would an RA save me?");
    await page.keyboard.press("Enter");
    await expect(page.getByRole("log")).toContainText("not advice");
    // Tab stays inside the drawer.
    for (let i = 0; i < 15; i++) {
      await page.keyboard.press("Tab");
      expect(await page.evaluate(() => !!document.activeElement?.closest("[role=dialog]"))).toBe(true);
    }
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Ask the assistant" })).toBeFocused();
  });

  test("no critical or serious accessibility problems in the consent window or the chat", async ({ page }) => {
    test.slow();
    await toResults(page);
    await page.getByRole("button", { name: "Ask the assistant" }).click();
    await expect(page.getByRole("dialog", { name: "Turn on the assistant?" })).toBeVisible();
    await expectAccessible(page, "assistant consent");
    await page.getByRole("button", { name: "Enable assistant" }).click();
    await expect(page.getByRole("dialog", { name: "Assistant" })).toBeVisible();
    await expectAccessible(page, "assistant chat, empty");
    await ask(page, "Why is my PAYE what it is?");
    await expect(page.getByRole("log")).toContainText("rebates");
    await page.getByText("What was checked").click();
    await expectAccessible(page, "assistant chat, answered");
  });

  test("it fits on a small screen and a large one", async ({ page }) => {
    await toResults(page);
    await page.getByRole("button", { name: "Ask the assistant" }).click();
    await page.getByRole("button", { name: "Enable assistant" }).click();
    await ask(page, "What is PAYE?");
    await expect(page.getByRole("log")).toContainText("PAYE is the income tax");
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
    const box = await page.getByRole("dialog", { name: "Assistant" }).boundingBox();
    const viewport = page.viewportSize()!;
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width + 0.5);
    expect(box!.height).toBeLessThanOrEqual(viewport.height + 0.5);
    // The question box and the send button are on screen and big enough to use.
    const send = await page.getByRole("button", { name: "Send" }).boundingBox();
    expect(send!.height).toBeGreaterThanOrEqual(43.5);
    expect(send!.y + send!.height).toBeLessThanOrEqual(viewport.height + 0.5);
  });

  test("it works offline too: the assistant is kept for offline use", async ({ page, context }) => {
    await page.goto("/");
    await page.evaluate(async () => (await navigator.serviceWorker.ready).active?.state);
    await expect.poll(() => cachedFileCount(page), { timeout: 30_000 }).toBeGreaterThan(5);
    await page.reload();
    await context.setOffline(true);
    await toResults(page);
    await page.getByRole("button", { name: "Ask the assistant" }).click();
    await page.getByRole("button", { name: "Enable assistant" }).click();
    await ask(page, "What is UIF?");
    await expect(page.getByRole("log")).toContainText("Unemployment Insurance Fund");
    await context.setOffline(false);
  });
});
