// Runs Lighthouse (mobile settings: a mid-range phone on slow 4G) against the production build,
// served exactly as a real host would (scripts/serve.mjs: compression, caching and security headers).
// Targets from the PRD §17.2: Performance >= 90, Accessibility >= 95, Best Practices >= 95, SEO >= 90.
//
//   npm run lighthouse                 builds nothing: run `npm run build` first
//   npm run lighthouse -- https://example.co.za     test a live address instead
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";
import { launch } from "chrome-launcher";
import lighthouse from "lighthouse";

const TARGETS = { performance: 90, accessibility: 95, "best-practices": 95, seo: 90 };
const live = process.argv[2];
const port = 4181;
const base = live ? live.replace(/\/$/, "") : `http://localhost:${port}`;
const pages = [
  ["landing", "/"],
  ["first question", "/wizard?start=gross"],
  ["start screen", "/wizard"],
];

let server;
if (!live) {
  server = spawn(process.execPath, ["scripts/serve.mjs", "--port", String(port)], { stdio: "ignore" });
  await new Promise((r) => setTimeout(r, 800));
}

const chrome = await launch({
  chromePath: chromium.executablePath(),
  chromeFlags: ["--headless=new", "--no-sandbox", "--disable-gpu"],
});

mkdirSync("lighthouse-report", { recursive: true });
const failures = [];
const rows = [];
try {
  for (const [name, path] of pages) {
    // The very first load on a cold machine sometimes yields no paint at all. That is the tool failing, not the page, so try again.
    let lhr;
    for (let attempt = 1; attempt <= 3; attempt++) {
      const run = await lighthouse(
        base + path,
        { port: chrome.port, output: "json", logLevel: "error" },
        { extends: "lighthouse:default", settings: { formFactor: "mobile", onlyCategories: Object.keys(TARGETS) } },
      );
      lhr = run.lhr;
      if (!lhr.runtimeError && lhr.categories.performance.score) break;
    }
    const scores = Object.fromEntries(Object.entries(lhr.categories).map(([k, v]) => [k, Math.round((v.score ?? 0) * 100)]));
    const audit = (id) => lhr.audits[id]?.displayValue ?? "";
    rows.push({
      page: name,
      ...scores,
      FCP: audit("first-contentful-paint"),
      LCP: audit("largest-contentful-paint"),
      TBT: audit("total-blocking-time"),
      CLS: audit("cumulative-layout-shift"),
      transferred: audit("total-byte-weight"),
    });
    writeFileSync(`lighthouse-report/${name.replace(/\W+/g, "-")}.json`, JSON.stringify(lhr, null, 2));
    for (const [category, target] of Object.entries(TARGETS)) {
      if (scores[category] < target) {
        const bad = lhr.categories[category].auditRefs
          .map((ref) => lhr.audits[ref.id])
          .filter((a) => a.score !== null && a.score < 0.9 && a.scoreDisplayMode !== "informative" && a.scoreDisplayMode !== "notApplicable")
          .map((a) => `${a.id} (${a.score})`);
        failures.push(`${name}: ${category} ${scores[category]} < ${target}. Weak audits: ${bad.join(", ")}`);
      }
    }
  }
} finally {
  await chrome.kill();
  server?.kill();
}

console.table(rows);
if (failures.length) {
  console.error("\nBelow target:\n" + failures.join("\n"));
  process.exit(1);
}
console.log("\nAll Lighthouse targets met.");
