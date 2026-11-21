// The landing page's JavaScript must stay at or under 150 KB compressed (PRD §17.2).
// Counts what the browser downloads to show the landing page: the script and any module-preload files that
// index.html names. Pages loaded later (the results page) are separate and not part of this budget.
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { gzipSync, brotliCompressSync } from "node:zlib";

const BUDGET_BYTES = 150_000;
const dist = resolve(process.argv[2] ?? "dist");
const html = readFileSync(join(dist, "index.html"), "utf8");

const refs = [
  ...html.matchAll(/<script[^>]+type="module"[^>]+src="([^"]+)"/g),
  ...html.matchAll(/<link[^>]+rel="modulepreload"[^>]+href="([^"]+)"/g),
].map((m) => m[1]);

if (refs.length === 0) {
  console.error("No scripts found in dist/index.html. Did the build run?");
  process.exit(2);
}

// The PDF library is loaded only when someone presses "Download PDF summary", never with the landing page. The library
// writes the "%PDF-" file header from its own code, so finding that text in a landing script means it was pulled in.
const pdfInLanding = [];

let gzipTotal = 0;
let brotliTotal = 0;
for (const ref of [...new Set(refs)]) {
  const file = join(dist, ref.replace(/^\//, ""));
  if (!existsSync(file)) {
    console.error(`index.html names ${ref} but it is not in dist.`);
    process.exit(2);
  }
  const raw = readFileSync(file);
  if (raw.includes("%PDF-")) pdfInLanding.push(ref);
  const gz = gzipSync(raw, { level: 9 }).length;
  gzipTotal += gz;
  brotliTotal += brotliCompressSync(raw).length;
  console.log(`  ${ref}: ${(raw.length / 1000).toFixed(1)} KB raw, ${(gz / 1000).toFixed(1)} KB gzip`);
}
const kb = (n) => (n / 1000).toFixed(1);
console.log(`Landing JavaScript: ${kb(gzipTotal)} KB gzip (${kb(brotliTotal)} KB brotli). Budget ${kb(BUDGET_BYTES)} KB.`);
if (pdfInLanding.length > 0) {
  console.error(`The PDF library is in the landing page's scripts (${pdfInLanding.join(", ")}). It must load only on demand.`);
  process.exit(1);
}
console.log("No PDF library in the landing page's scripts.");
if (gzipTotal > BUDGET_BYTES) {
  console.error(`Over budget by ${kb(gzipTotal - BUDGET_BYTES)} KB.`);
  process.exit(1);
}
console.log(`OK, ${kb(BUDGET_BYTES - gzipTotal)} KB to spare.`);

// A draft tax year (one nobody has signed off) must never reach a production build (PRD §6.16, §10.5).
// Every rule set carries `status: "draft"` or `"verified"`; the minifier keeps that key, so a draft one is findable.
const assets = join(dist, "assets");
const leaked = existsSync(assets)
  ? readdirSync(assets).filter((f) => f.endsWith(".js") && /status:\s*["'`]draft["'`]/.test(readFileSync(join(assets, f), "utf8")))
  : [];
if (leaked.length > 0) {
  console.error(`A draft tax year is in the production build: ${leaked.join(", ")}.`);
  process.exit(1);
}
console.log("No draft tax year in the production build.");
