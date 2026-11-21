import {
  DEFAULT_TAX_YEAR,
  DEV_YEAR_OPTIONS,
  getVerifiedRuleSet,
  selectableRuleSets,
  type TaxRuleSet,
  type TaxYear,
  type YearOptions,
} from "@taxclarity/tax-engine";

/**
 * Which tax years the app may use (PRD §6.16, §8).
 *
 * A production build offers only years that have been signed off. Draft years are allowed in development and in a
 * test build that says so with `VITE_ENABLE_DRAFT_YEARS=1` (used by the browser tests; never set it on a real
 * deploy, see docs/DEPLOY.md). When neither applies the draft rule sets are not imported by anything, so they are
 * not in the bundle at all; `npm run bundle:check` fails if one is.
 *
 * The year is always the person's explicit choice. The date on their device is never used to pick it.
 */
const ALLOW_DRAFTS = import.meta.env.DEV || import.meta.env.VITE_ENABLE_DRAFT_YEARS === "1";

export const YEAR_OPTIONS: YearOptions = ALLOW_DRAFTS ? DEV_YEAR_OPTIONS : {};

/** The years that can be chosen, oldest first. */
export const SELECTABLE_YEARS: readonly TaxRuleSet[] = selectableRuleSets(YEAR_OPTIONS);

export const isSelectableYear = (year: string): year is TaxYear => SELECTABLE_YEARS.some((r) => r.taxYear === year);

/** The rule set for a year that may be used. Throws a `TaxYearError` otherwise; never returns another year. */
export const rulesFor = (year: string): TaxRuleSet => getVerifiedRuleSet(year, YEAR_OPTIONS);

export { DEFAULT_TAX_YEAR };
