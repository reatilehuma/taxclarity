import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const axeSource = readFileSync(createRequire(import.meta.url).resolve("axe-core/axe.min.js"), "utf8");

interface Violation {
  id: string;
  impact?: string | null;
  help: string;
  nodes: { target: unknown[]; html: string; failureSummary?: string }[];
}

/** Runs axe-core (WCAG 2.0/2.1 A and AA, plus best practice) in the real browser, so colour contrast is measured too. */
export async function axeViolations(page: Page): Promise<Violation[]> {
  // A page that is still fading in measures as low contrast. Let finite animations finish, as a person's eyes would.
  await page.evaluate(() =>
    Promise.all(document.getAnimations().filter((a) => a.effect?.getComputedTiming().iterations !== Infinity).map((a) => a.finished.catch(() => undefined))),
  );
  // Run axe's source straight in the page (not as a script tag), so the site's strict content policy stays on.
  await page.evaluate(axeSource);
  const result = await page.evaluate(async () => {
    // axe is injected as a global.
    const axe = (window as unknown as { axe: { run: (c: Document, o: object) => Promise<{ violations: unknown[] }> } }).axe;
    return axe.run(document, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"] },
      resultTypes: ["violations"],
    });
  });
  return result.violations as Violation[];
}

/** Fails on any critical or serious problem. Lesser ones are attached to the test report so they stay visible. */
export async function expectAccessible(page: Page, where: string) {
  const found = await axeViolations(page);
  const describe = (v: Violation) =>
    `[${v.impact}] ${v.id}: ${v.help}\n` + v.nodes.slice(0, 3).map((n) => `    ${String(n.target)}\n      ${n.html.slice(0, 140)}`).join("\n");
  const lesser = found.filter((v) => v.impact !== "critical" && v.impact !== "serious");
  if (lesser.length && process.env.AXE_VERBOSE) console.log(`axe (${where}): ` + lesser.map(describe).join("\n"));
  if (lesser.length) test.info().annotations.push({ type: `axe (${where})`, description: lesser.map(describe).join("\n") });
  const bad = found.filter((v) => v.impact === "critical" || v.impact === "serious");
  expect(bad.map(describe), `axe: ${where}`).toEqual([]);
  return lesser;
}
