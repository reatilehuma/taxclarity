import { expect, test } from "@playwright/test";
import { Wizard } from "./driver";

/**
 * Phase 18: what the real production build offers. Only signed-off years can be chosen, so with 2025/26 still a draft
 * the selector shows 2026/27 as plain text, nothing in the page mentions a draft year, and the draft's figures are not
 * downloaded at all. (This runs against the normal build on port 4173.)
 */
test("offers only the signed-off year, as text, wherever the selector appears", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("tax-year-fixed")).toHaveText("2026/27 · 1 March 2026 – 28 February 2027");
  await expect(page.getByRole("combobox")).toHaveCount(0);
  await expect(page.getByText("Draft")).toHaveCount(0);

  const w = new Wizard(page);
  await w.run({ mode: "gross", amount: "30000" });
  await expect(page.getByTestId("tax-year-fixed")).toHaveText("2026/27 · 1 March 2026 – 28 February 2027");
  await expect(page.getByRole("combobox")).toHaveCount(0);
});

test("the draft year's figures are never downloaded", async ({ page }) => {
  const scripts: string[] = [];
  page.on("response", async (r) => {
    if (r.url().endsWith(".js")) scripts.push(await r.text());
  });
  await page.goto("/");
  await new Wizard(page).run({ mode: "gross", amount: "30000" });
  expect(scripts.length).toBeGreaterThan(0);
  for (const s of scripts) {
    expect(s).not.toContain("2025-26-draft");
    expect(s).not.toContain("237100"); // a 2025/26 bracket edge
  }
});
