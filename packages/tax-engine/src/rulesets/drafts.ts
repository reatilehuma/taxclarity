import type { TaxRuleSet, TaxYear } from "../types.ts";
import { TaxRules2025_26 } from "./2025-26.ts";
import { TaxYearError } from "./errors.ts";
import { TaxRules2026_27 } from "./2026-27.ts";
import type { YearOptions } from "./registry.ts";

/**
 * Rule sets that exist but are not signed off. ONLY development tools and tests import this file. A production
 * build that never imports it has none of these figures in it (`npm run bundle:check` fails if one slips in).
 * When a year is signed off, its file moves from here to `VERIFIED_RULE_SETS` in `registry.ts`.
 */
export const DRAFT_RULE_SETS: readonly TaxRuleSet[] = /* @__PURE__ */ Object.freeze([TaxRules2025_26]);

/** Pass this where a development tool may use the drafts: `getVerifiedRuleSet(year, DEV_YEAR_OPTIONS)`. */
export const DEV_YEAR_OPTIONS: YearOptions = /* @__PURE__ */ Object.freeze({ drafts: DRAFT_RULE_SETS });

/**
 * Every rule set, signed off or not, oldest first. For tools and tests. A test checks it is exactly the signed-off
 * list plus the drafts. It is a plain list of references on purpose: a spread or a call in here would count as a
 * side effect and stop a production build from dropping this module, drafts and all.
 */
export const RULE_SETS: readonly TaxRuleSet[] = /* @__PURE__ */ Object.freeze([TaxRules2025_26, TaxRules2026_27]);

/** The rule set for a year whatever its status. For tools and tests. Throws for an unknown year. */
export function getRuleSet(year: string): TaxRuleSet {
  const found = RULE_SETS.find((r) => r.taxYear === year);
  if (!found) throw new TaxYearError("UNKNOWN_YEAR", String(year), `No rule set for tax year "${year}".`);
  return found;
}

export type { TaxYear };
