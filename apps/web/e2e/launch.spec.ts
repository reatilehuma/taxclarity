import { expect, test } from "@playwright/test";
import { CurrentTaxRules as rules } from "@taxclarity/tax-engine";
import { Wizard } from "./driver";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const longDate = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[m! - 1]} ${y}`;
};

test.describe("launch checklist: what is automated", () => {
  test("security headers are on the page, and files are cached the right way", async ({ page }) => {
    const res = await page.goto("/");
    const h = res!.headers();
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["referrer-policy"]).toBe("no-referrer");
    expect(h["x-frame-options"]).toBe("DENY");
    expect(h["permissions-policy"]).toContain("camera=()");
    expect(h["strict-transport-security"]).toContain("max-age=");
    expect(h["cross-origin-opener-policy"]).toBe("same-origin");
    expect(h["cache-control"]).toBe("no-cache");
    const asset = await page.request.get((await page.locator("script[type=module]").getAttribute("src"))!);
    expect(asset.headers()["cache-control"]).toContain("immutable");
    expect(asset.headers()["content-encoding"]).toBe("gzip");
  });

  test("the page tells search engines and phones what it is", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("lang", "en-ZA");
    expect(await page.locator("meta[name=description]").getAttribute("content")).toMatch(/PAYE/);
    expect(await page.locator("meta[name=viewport]").getAttribute("content")).toContain("width=device-width");
    expect(await page.locator("meta[name=theme-color]").getAttribute("content")).toBeTruthy();
    expect(await page.locator("link[rel=manifest]").getAttribute("href")).toBe("/manifest.webmanifest");
    for (const path of ["/favicon.svg", "/manifest.webmanifest", "/robots.txt"]) {
      expect((await page.request.get(path)).status(), path).toBe(200);
    }
    const manifest = await (await page.request.get("/manifest.webmanifest")).json();
    expect(manifest.start_url).toBe("/");
    expect(manifest.display).toBe("standalone");
  });

  test("the disclaimer and the 'last checked' date are visible on every kind of page", async ({ page }) => {
    const checked = new RegExp(longDate(rules.lastVerified));
    await page.goto("/");
    await expect(page.getByRole("contentinfo")).toContainText("Educational estimates only. Not tax advice");
    await expect(page.getByRole("contentinfo")).toContainText(checked);
    await expect(page.getByRole("contentinfo")).toContainText("2026/27");

    const w = new Wizard(page);
    await w.start("gross");
    await expect(page.getByRole("contentinfo")).toContainText("Not tax advice");

    await w.amount("30000");
    await w.run({ mode: "gross", amount: "30000" });
    await expect(page.getByText("Estimates only. Not tax advice, not a SARS assessment.")).toBeVisible();
    await expect(page.getByRole("contentinfo")).toContainText(checked);
    await expect(page.getByText(/Educational suggestions|general education suggestions/i).first()).toBeVisible();
  });

  test("every outside link is a sensible official source that opens safely", async ({ page }) => {
    const allowed = /^https:\/\/(www\.)?(sars\.gov\.za|treasury\.gov\.za|assets\.kpmg\.com|taxsummaries\.pwc\.com)(\/|$)/;
    const check = async () => {
      for (const link of await page.locator("a[href^=http]").all()) {
        const href = (await link.getAttribute("href"))!;
        expect(href, "link target").toMatch(allowed);
        expect(await link.getAttribute("target"), href).toBe("_blank");
        expect(await link.getAttribute("rel"), href).toContain("noreferrer");
      }
    };
    await page.goto("/");
    await check();
    expect(await page.locator("a[href^=http]").count()).toBeGreaterThan(3);
    await new Wizard(page).run({ mode: "gross", amount: "30000" });
    await check();
    expect(await page.locator("a[href^=http]").count()).toBeGreaterThan(8);
  });

  test("no errors or warnings in the browser across a whole visit", async ({ page }) => {
    const problems: string[] = [];
    page.on("console", (m) => {
      if (["error", "warning"].includes(m.type())) problems.push(`${m.type()}: ${m.text()}`);
    });
    page.on("pageerror", (e) => problems.push(e.message));
    // A download cut short because the visitor moved to another page is normal; anything else failing is not.
    page.on("requestfailed", (r) => {
      if (r.failure()?.errorText !== "net::ERR_ABORTED") problems.push(`failed: ${r.url()} (${r.failure()?.errorText})`);
    });
    page.on("response", (r) => {
      if (r.status() >= 400) problems.push(`${r.status()}: ${r.url()}`);
    });
    await page.goto("/");
    await page.goto("/nope");
    await new Wizard(page).run({ mode: "take-home", amount: "20000" });
    expect(problems).toEqual([]);
  });
});
