// The release gate (PRD §6.16, §10.5; execution plan Phase 23, D14).
// A production release must not ship one year and leave the other unsigned. This fails unless, for every tax year the
// engine knows: the rule set says "verified", it is in the signed-off list (not the drafts), and, where a sources file
// exists, its Sign-off table has at least one reviewer with a date. It never edits anything: only a person records a
// sign-off, by filling in the table in docs/rulesets/<year>-sources.md.
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/** Rows of the "## Sign-off" table that name a reviewer and a date. Empty template rows do not count. */
export function signedRows(markdown) {
  const at = markdown.search(/^##\s+Sign-off\s*$/m);
  if (at < 0) return [];
  const section = markdown.slice(at).split(/\n##\s/)[0].split("\n").slice(1);
  return section
    .filter((l) => l.trim().startsWith("|"))
    .map((l) => l.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim()))
    .filter((cells) => cells.length >= 2 && !cells.every((c) => /^:?-{3,}:?$/.test(c)))
    .filter((cells) => !/^reviewer$/i.test(cells[0]))
    .filter((cells) => cells[0] !== "" && cells[1] !== "");
}

/**
 * years: [{ year, status, inVerifiedList, sourcesFile: string | null }]. Returns a list of problems (empty = release allowed).
 */
export function releaseProblems(years) {
  const problems = [];
  for (const y of years) {
    const label = y.year.replace("-", "/");
    if (y.status !== "verified") problems.push(`${label}: the rule set is "${y.status}", not "verified".`);
    if (!y.inVerifiedList) problems.push(`${label}: it is not in the signed-off list in rulesets/registry.ts, so a production build cannot use it.`);
    if (y.sourcesFile !== null) {
      if (signedRows(y.sourcesFile).length === 0) problems.push(`${label}: the Sign-off table in docs/rulesets/${y.year}-sources.md has no reviewer and date.`);
      if (/\*\*Status:\s*DRAFT/i.test(y.sourcesFile)) problems.push(`${label}: docs/rulesets/${y.year}-sources.md still says "Status: DRAFT".`);
    }
  }
  return problems;
}

async function main() {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
  const engine = (f) => import(pathToFileURL(join(root, "packages/tax-engine/src/rulesets", f)).href);
  const { KNOWN_TAX_YEARS, VERIFIED_RULE_SETS } = await engine("registry.ts");
  const { RULE_SETS } = await engine("drafts.ts");
  const years = KNOWN_TAX_YEARS.map((year) => {
    const rules = RULE_SETS.find((r) => r.taxYear === year);
    const file = join(root, "docs/rulesets", `${year}-sources.md`);
    return {
      year,
      status: rules ? rules.status : "missing",
      inVerifiedList: VERIFIED_RULE_SETS.some((r) => r.taxYear === year),
      sourcesFile: existsSync(file) ? readFileSync(file, "utf8") : null,
    };
  });
  const problems = releaseProblems(years);
  for (const y of years) console.log(`  ${y.year}: ${y.status}${y.sourcesFile === null ? "" : `, ${signedRows(y.sourcesFile).length} sign-off row(s)`}`);
  if (problems.length > 0) {
    console.error("\nRelease blocked. Every tax year must be signed off before a release (PRD §6.16):");
    for (const p of problems) console.error(`  - ${p}`);
    console.error("\nSee docs/RUNBOOK-NEW-TAX-YEAR.md, \"Sign-off\".");
    process.exit(1);
  }
  console.log("Release gate: every tax year is verified and signed off.");
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) await main();
