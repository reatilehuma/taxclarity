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

/**
 * The assistant as it runs when it talks to an AI service: the real page, the real proxy code, and a stand-in for
 * the model (no key, no network). This is a second build of the site, served on its own port (playwright.config.ts).
 */
test.use({ baseURL: "http://localhost:4174" });

const T1 = { mode: "gross", amount: "30000", retirement: { payslip: "3000" }, medical: { members: 2, total: "0" } } as const;
const toResults = (page: Page) => new Wizard(page).run({ ...T1 });
const ask = async (page: Page, question: string) => {
  const dialog = page.getByRole("dialog", { name: "Assistant" });
  await dialog.getByLabel("Your question").fill(question);
  await dialog.getByRole("button", { name: "Send" }).click();
  return dialog;
};
const posts = (seen: Request[]) => seen.filter((r) => r.method() === "POST");

test.describe("the assistant on an outside AI service", () => {
  test("asks first, shows exactly what would be sent, and sends nothing until you say yes", async ({ page, context }) => {
    const seen: Request[] = [];
    context.on("request", (r) => seen.push(r));
    await toResults(page);
    await page.getByRole("button", { name: "Ask the assistant" }).click();
    const consent = page.getByRole("dialog", { name: "Turn on the assistant?" });
    await expect(consent).toContainText("external AI service");
    await expect(consent).toContainText("never your name, ID or tax number");
    await expect(consent).toContainText("We store nothing");
    await consent.getByText("See exactly what would be sent", { exact: true }).click();
    const preview = flat(await consent.getByLabel("See exactly what would be sent").innerText());
    expect(preview).toContain('"monthlyPaye": 3149');
    expect(preview).toContain('"taxYear": "2026/27"');
    expect(preview).not.toMatch(/name|email|employer|bank|account/i);
    expect(posts(seen)).toHaveLength(0);
    expect(await page.evaluate(() => localStorage.length)).toBe(0);
    await expectAccessible(page, "outside-service consent with the preview open");
    await page.getByRole("button", { name: "No thanks" }).click();
    expect(posts(seen)).toHaveLength(0);
    await expect(page.getByText("Assistant unavailable. Your results are fully calculated")).toBeVisible();
  });

  test("after yes, a question goes to this site's own proxy only, as the allow-listed request, and is answered and checked", async ({ page, context }) => {
    const seen: Request[] = [];
    context.on("request", (r) => seen.push(r));
    await toResults(page);
    await page.getByRole("button", { name: "Ask the assistant" }).click();
    await page.getByRole("button", { name: "Enable assistant" }).click();
    await expect(page.getByText("AI explanations · calculations by the deterministic engine")).toBeVisible();
    const dialog = await ask(page, "Which tax bracket am I in?");
    await expect(dialog.getByRole("log")).toContainText("26%");
    await expect(dialog.getByText(/Checked: all \d+ figures match your results/)).toBeVisible();

    const sent = posts(seen);
    expect(sent).toHaveLength(1);
    const request = sent[0]!;
    expect(new URL(request.url()).pathname).toBe("/api/assistant");
    expect(new URL(request.url()).origin).toBe("http://localhost:4174");
    const body = JSON.parse(request.postData()!) as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(["history", "payload", "question"]);
    expect(body.question).toBe("Which tax bracket am I in?");
    expect(JSON.stringify(body)).not.toMatch(/employer|bank|idNumber|taxRef|email|surname/i);
    expect(request.headers()["cookie"] ?? "").toBe("");
    expect(request.headers()["referer"] ?? "").toBe("");
    // Nothing else left the page, and the only thing kept is the yes.
    for (const r of seen) expect(new URL(r.url()).origin).toBe("http://localhost:4174");
    expect(await page.evaluate(() => Object.fromEntries(Object.entries(localStorage)))).toEqual({ "cleartax.assistant": "claude-proxy" });
  });

  test("an answer with an invented figure is never shown, a refusal is an apology, and a failure says 'unavailable'", async ({ page }) => {
    await toResults(page);
    await page.getByRole("button", { name: "Ask the assistant" }).click();
    await page.getByRole("button", { name: "Enable assistant" }).click();
    const dialog = page.getByRole("dialog", { name: "Assistant" });
    const headline = flat(await page.getByRole("heading", { level: 1 }).innerText());

    await ask(page, "INVENT a number for me");
    await expect(dialog.getByRole("log")).toContainText("I can't give you a reliable answer");
    await expect(dialog.getByRole("log")).not.toContainText("10 000");
    await expect(dialog.getByRole("log")).not.toContainText("3 900");

    await ask(page, "REFUSE this");
    await expect(dialog.getByRole("log").getByText(/I can't give you a reliable answer/)).toHaveCount(2);

    await ask(page, "BREAK it");
    await expect(dialog.getByRole("log")).toContainText("Assistant unavailable. Your results are fully calculated");

    // The one that goes wrong once and is put right by the proxy's retry is simply answered.
    await ask(page, "RETRY: which bracket am I in?");
    await expect(dialog.getByRole("log")).toContainText("26%");

    await page.keyboard.press("Escape");
    expect(flat(await page.getByRole("heading", { level: 1 }).innerText())).toBe(headline);
  });

  test("offline, the assistant says it is unavailable and the calculator is untouched", async ({ page, context }) => {
    await page.goto("/");
    // The service worker fills its cache after the first load. On a busy machine that can take a while, so wait for it.
    await expect.poll(() => cachedFileCount(page), { timeout: 30_000 }).toBeGreaterThan(5);
    await page.reload();
    await toResults(page);
    await page.getByRole("button", { name: "Ask the assistant" }).click();
    await page.getByRole("button", { name: "Enable assistant" }).click();
    await context.setOffline(true);
    const dialog = await ask(page, "What is UIF?");
    await expect(dialog.getByRole("log")).toContainText("Assistant unavailable");
    await context.setOffline(false);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Your estimated monthly PAYE is");
  });

  test("the proxy turns away anything that is not the app's own request", async ({ request }) => {
    const url = "/api/assistant";
    expect((await request.get(url)).status()).toBe(405);
    const noOrigin = await request.post(url, { data: { question: "hi", history: [], payload: {} } });
    expect(noOrigin.status()).toBe(403); // a script with no Origin, not a browser page
    const origin = "http://localhost:4174";
    const bad = await request.post(url, { headers: { origin }, data: { question: "hi", history: [], payload: { name: "Thabo" } } });
    expect(bad.status()).toBe(400);
    expect(await bad.json()).toEqual({ error: "bad_request" });
    const foreign = await request.post(url, { headers: { origin: "https://evil.example" }, data: { question: "hi", history: [], payload: {} } });
    expect(foreign.status()).toBe(403);
    expect(bad.headers()["cache-control"]).toContain("no-store");
    expect(bad.headers()["content-security-policy"]).toContain("default-src 'self'");
  });

  test("chat is accessible and fits both screen sizes", async ({ page }) => {
    test.slow();
    await toResults(page);
    await page.getByRole("button", { name: "Ask the assistant" }).click();
    await page.getByRole("button", { name: "Enable assistant" }).click();
    await ask(page, "How much would an RA save me?");
    await expect(page.getByRole("log")).toContainText("not advice");
    await expectAccessible(page, "outside-service chat");
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  });
});
