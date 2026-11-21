# Runbook: adding a tax year (or a mid-year change)

The app holds **several tax years at once** (2025/26 and 2026/27 today). A new year is added to the registry next to
the others; nothing is switched over and no old year is removed. SARS publishes new parameters every February (the
Budget) and occasionally changes one mid-year (the UIF ceiling is set by ministerial notice; PRD Q3). The engine is
built so that a new year is **a new rule set, not new logic**. `packages/tax-engine/src/__tests__/newyear.test.ts` proves this with a made-up 2027/28 set
and fails if anyone writes a year or a SARS figure into the engine's code.

Allow about half a day, most of it checking figures against SARS.

## 1. Gather the figures

Use the SARS pages in `apps/web/src/lib/sources.ts` and the Budget Review. Every value below lives in the rule
set; nothing else needs a number.

| Rule set field | Where it comes from |
|---|---|
| `brackets` (7 rows: from, to, base, rate) | SARS "Rates of tax for individuals" |
| `rebates` (primary, 65+, 75+) | same page |
| `thresholds` | Not typed freely: the validator requires rebate ÷ 18% (it will tell you if you get it wrong) |
| `uif.monthlyCeiling`, `maxMonthlyEmployee` | SARS UIF page; ministerial notice |
| `retirement11F` (27.5%, annual cap) | SARS "Tax and retirement" |
| `medical6A` (main, first dependant, extra) | SARS "Medical tax credit rates" |
| `medical6B` | SARS "Medical credits" |
| `donations18A.limitRate` (10%) | SARS donations pages |
| `interestExemption` (under 65, 65+) | Budget Review |
| `tfsa` (annual, lifetime, penalty) | SARS "Tax-free investments" |
| `travel` (rate per km, taxable shares, threshold) | SARS "Rates per kilometre" |
| `reference.donationsTaxAnnualExemption` | SARS donations tax |
| `startDate`, `endDate`, `label`, `lastVerified` | 1 March to the last day of February; today's date for `lastVerified` |

For a **mid-year change** (say the UIF ceiling), edit the one value and `lastVerified` in the current file and
skip to step 4.

## 2. Add the rule set to the registry

A new year starts as a **draft**: it can be chosen in the development Workbench and in the test build, and a production
build cannot even contain it, until someone has signed it off.

1. Copy the newest file in `packages/tax-engine/src/rulesets/` (for example `2026-27.ts`) to `2027-28.ts`. Rename the
   export (`TaxRules2027_28`), update every number and the source IDs, and fill in `taxYear: "2027-28"`, `label`, dates
   and `lastVerified`. Set `status: "draft"` and a new `rulesVersion` (change it whenever any value changes).
2. In `packages/tax-engine/src/types.ts` widen the type: `export type TaxYear = "2025-26" | "2026-27" | "2027-28";`
   and add the year to `KNOWN_TAX_YEARS` in `rulesets/registry.ts`.
3. Add it to `DRAFT_RULE_SETS` and `RULE_SETS` in `rulesets/drafts.ts`. Keep both lists plain references, no spreads or
   calls (`multiyear.test.ts` and `npm run bundle:check` explain why).
4. Write `docs/rulesets/2027-28-sources.md` (one row per value, source, date, and an empty **Sign-off** table) and
   reference vectors worked out **independently of the engine**, as `docs/rulesets/2025-26-vectors.md` does.
5. **Old years stay.** Never delete or edit an old year's file to make a new year work. Their tests import them directly
   and keep proving each year still calculates. Fixing a wrong figure in an old year is a normal change: edit the value,
   bump `rulesVersion` and `lastVerified`, and update that year's vectors.

## The sign-off gate (D14)

A year is **released only when a person has signed it off**. The order matters:

1. A reviewer (ideally an accountant or a second person, not the author) checks every row of
   `docs/rulesets/<year>-sources.md` against its source and works through its "Open items for the reviewer".
2. Fixes that come out of the review go into the rule set (new `rulesVersion`), and the year's vectors are re-run
   (`npm test -w packages/tax-engine`) and corrected where a figure was wrong. Do not change a vector to match the
   engine; work it out again by hand.
3. The reviewer fills in the **Sign-off** table at the bottom of the sources file: name, date, rows checked, open items
   resolved. Change the file's first line from "Status: DRAFT" to "Status: signed off" (with the date).
4. Only then change `status` to `"verified"` in the rule-set file and move the rule set from `DRAFT_RULE_SETS` to
   `VERIFIED_RULE_SETS` in `registry.ts` (it stays in `RULE_SETS`). Update the tests that assert which years are drafts
   (`years-production.spec.ts` and the draft-build tests tell you which).
5. Run `npm run release:check`. It fails, and the CI job "release-gate" fails with it, unless **every** known year is
   `verified`, is in the signed-off list, and (where a sources file exists) has a filled-in Sign-off row and no
   "Status: DRAFT". It never edits anything. This is deliberate (PRD §6.16): the release is blocked, not shipped with
   one year.

Do not set `status: "verified"` without step 3; the gate checks that the two agree.

## Choosing the default year

The default (what people get without choosing) is one line: `DEFAULT_TAX_YEAR` in `rulesets/registry.ts`, and
`CurrentTaxRules` follows it. The year selector lets everyone pick another year.

- Change it **only to a signed-off year**, and not before that year starts: the default moves from 2026/27 to
  2027/28 on **1 March 2027**, not when 2027/28 is signed off. Between the Budget (February) and 1 March, the new
  year is selectable but not the default.
- The landing page's example dashboard and sample payslip stay on the default year; change them in the same
  release (see section 4), and expect the tests that assert default-year figures to change (section 3).
- Nobody is ever sent to a different year than the one they chose; changing the default affects only new visits.

## 3. Let the tests tell you what is left

Run `npm test`. Expect failures in this order, and fix each:

1. **`assertValidRuleSet` (engine).** Typos in the brackets (a base that doesn't add up), thresholds that don't
   match rebates, rates that don't rise. The message names the field.
2. **`apps/web/src/content/figures.test.ts`.** Since Phase 19 no sentence quotes a tax figure by hand. Anything that
   names a limit, a credit or a rate is a template in `ruleCopy()` (`apps/web/src/content/strings.ts`) filled from the
   rule set, so a new year needs **no copy edits** for those. The test runs for every year and checks three things:
   the fixed copy (`copy`) contains no rule figure (a stale "R430 000" typed into a sentence fails here); each year's
   rendered sentences contain only that year's figures and rates and name only that year; and a fixed sentence may
   mention a rate only if every year has it. If it fails on a fixed sentence, turn that sentence into a template.
   If you add a new kind of figure to the copy, add its template to `ruleCopy()`, never to `copy`.
3. **Web and engine tests with hard-coded expected numbers.** The PRD vectors (T1 gives PAYE R3 149,00 and
   take-home R23 673,88) are 2026/27 results. They change only when the *default* year changes; a new non-default
   year gets its own vectors and leaves them alone. Recalculate each by hand or from the SARS
   calculator, then update the expected values. Do not "fix" a test by copying whatever the app now prints.
   Search for `3 149` to find them: `apps/web/e2e/golden.spec.ts`, `apps/web/src/pages/Results.test.tsx`,
   `apps/web/src/wizard/WizardFlow.test.tsx`, `apps/web/src/wizard/wizard.test.ts`.
4. **`newyear.test.ts` itself** should not need changes.

## 4. Things no test can find

Review by eye:

- `apps/web/index.html` (title, description, social tags) and `apps/web/public/manifest.webmanifest`
  (description) mention 2026/27.
- `apps/web/src/lib/sources.ts`: source titles that name a year ("National Treasury: 2026 Budget", "KPMG: SA Budget
  Guide 2026/27") and the KPMG PDF address. A link whose name or address is specific to one year goes in
  `YEAR_SOURCES` for that year, and `sourceFor(id, taxYear)` picks it, so each result links its own year's page. Then
  `npm run links:check`, which reads every address in that file, both years included.
- `ruleCopy()` also holds the landing page's trust line and capability figures. The landing page's **example** and
  sample payslip stay on the default year and say so when another year is chosen; change the example's year only
  when you change the default year.
- The assistant: a new year is a new label the allow-list accepts (it reads `KNOWN_TAX_YEARS`). Add a recorded-reply
  profile for it in `packages/assistant-proxy/recorded/replies.json` (`npm run smoke -w packages/assistant-proxy --
  --year=2027-28 --record` with a key), and give it a case that quotes the *other* year's figure, which must be replaced.
- `rulesets/*.ts` `guidance.topBracketRate` (the "top bracket" tip threshold) is the rate of one of the year's
  brackets; set it deliberately for the new year (the validator checks it exists).
- The sample payslip on the landing page says "Payslip · March 2026" (`strings.ts`, `hero.payslipTitle`).
- Questions that say "28 February" or "tax year end" follow the rule set; read the age question once anyway.
- `execution-plan.md` and the PRD are history; leave them.

## 5. Check, then release

1. `npm run ci` (lint, types, all tests, bundle size, browser tests, and the release gate). It cannot pass while any
   year is unsigned.
2. `npm run lighthouse` (targets: Performance 90+, others 95+).
3. Skim the results page for a profile you can verify by hand, against the SARS tax tables, **in each year**, and
   download the PDF for each.
4. Deploy (docs/DEPLOY.md). People with the app open or installed get the new version the next time they
   close every tab and reopen it, because the service worker waits for old tabs to close. No one sees a mix.
5. Open the live site on a phone, go offline, calculate again.

## Notes

- **Several years at once.** The year selector passes the chosen rule set into the same calculator. Both the results
  page and the PDF summary read the selected year, so a new year needs no new screens.
- **Do not edit the engine's logic for a new year.** If SARS changes the *shape* of a rule (a new bracket type,
  a new credit), that is a normal feature: write tests first, as in Phases 1 to 4.
