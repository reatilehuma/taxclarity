export type * from "./types.ts";
export { TaxRules2025_26 } from "./rulesets/2025-26.ts";
export { TaxRules2026_27 } from "./rulesets/2026-27.ts";
export {
  DEFAULT_TAX_YEAR,
  getVerifiedRuleSet,
  KNOWN_TAX_YEARS,
  selectableRuleSets,
  VERIFIED_RULE_SETS,
} from "./rulesets/registry.ts";
// Drafts: for development tools and tests only. A production build that does not use these does not contain them.
export { DEV_YEAR_OPTIONS, DRAFT_RULE_SETS, getRuleSet, RULE_SETS } from "./rulesets/drafts.ts";
export type { YearOptions } from "./rulesets/registry.ts";
export { TaxYearError } from "./rulesets/errors.ts";
export type { TaxYearErrorCode } from "./rulesets/errors.ts";
import { DEFAULT_TAX_YEAR, getVerifiedRuleSet } from "./rulesets/registry.ts";
/**
 * The rule set for the DEFAULT year, found through the registry like any other. It is only what a screen uses
 * when the person has not chosen a year: calculations name their year (`CalculationInputs.taxYear`) and go
 * through `getVerifiedRuleSet` or `createYearCalculator`. It comes from the signed-off list, so it can never be a draft.
 */
export const CurrentTaxRules = getVerifiedRuleSet(DEFAULT_TAX_YEAR);
export { assertValidRuleSet } from "./validate.ts";
export { calculate } from "./calculate.ts";
export { calculateForYear, createCalculator, createYearCalculator } from "./memo.ts";
export { buildBreakdown } from "./breakdown.ts";
export type { Breakdown, BreakdownKind, BreakdownRow, BreakdownRowId } from "./breakdown.ts";
export { buildExplanations, buildRecommendations } from "./guidance.ts";
export type {
  Explanation,
  ExplanationId,
  Recommendation,
  RecommendationConfidence,
  RecommendationId,
} from "./guidance.ts";
