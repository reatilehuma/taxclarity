// Checks that every outside link in the app still opens (PRD launch checklist: "SARS links work").
// Needs the internet, so it is run by hand before a release, not in CI. Some official sites turn away
// scripts: a 403 or 429 here is reported as "blocked", not "broken", and should be opened in a browser.
//
//   npm run links:check
const SOURCES = (await import("node:fs")).readFileSync(new URL("../src/lib/sources.ts", import.meta.url), "utf8");
const urls = [...new Set([...SOURCES.matchAll(/url:\s*\n?\s*"(https:[^"]+)"/g)].map((m) => m[1]))];

let broken = 0;
for (const url of urls) {
  try {
    const res = await fetch(url, { method: "GET", redirect: "follow", headers: { "user-agent": "Mozilla/5.0 (link check)" }, signal: AbortSignal.timeout(20_000) });
    const verdict = res.ok ? "ok" : [403, 429, 503].includes(res.status) ? "blocked (check in a browser)" : "BROKEN";
    if (verdict === "BROKEN") broken++;
    console.log(`${String(res.status).padEnd(4)} ${verdict.padEnd(30)} ${url}${res.url !== url ? `  ->  ${res.url}` : ""}`);
  } catch (error) {
    broken++;
    console.log(`ERR  ${"BROKEN".padEnd(30)} ${url}  (${error instanceof Error ? error.message : error})`);
  }
}
console.log(`\n${urls.length} links checked, ${broken} broken.`);
process.exit(broken ? 1 : 0);
