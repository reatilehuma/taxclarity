import type { NormalisedInputs } from "./normalise.ts";
import type { Flag, FlagCode, SourceId, TaxRuleSet } from "./types.ts";

/** Facts from the finished calculation that decide which flags apply. */
export interface FlagFacts {
  retirementPoolAnnual: number;
  remunerationAnnual: number;
  belowThreshold: boolean;
  incomeAnnual: number;
  medical6BNotProvided: boolean;
}

const SOURCE: Record<FlagCode, SourceId> = {
  OTHER_INCOME_NOT_INCLUDED: "S14",
  CAPITAL_GAINS_NOT_INCLUDED: "S11",
  FOREIGN_INCOME_OR_RESIDENCY: "S14",
  FRINGE_BENEFITS_NOT_MODELLED: "S8",
  HOME_OFFICE_NOT_MODELLED: "S15",
  SDL_COIDA_EMPLOYER_ONLY: "S14",
  RETIREMENT_LUMP_SUMS_NOT_CALCULATED: "S9",
  COMMISSION_EARNER_DEDUCTIONS: "S7",
  DONATIONS_TAX_LARGE_GIFTS: "S10",
  DONATION_RECEIPT_NEEDED: "S10",
  MULTIPLE_EMPLOYERS: "S7",
  BELOW_THRESHOLD_MAY_NOT_NEED_TO_FILE: "S1",
  TRAVEL_LOGBOOK_REQUIRED: "S6",
  DIVIDENDS_NOT_INCLUDED: "S11",
  MEDICAL_6B_POSSIBLE: "S3",
};

/** Flags shown to everyone: things this calculator never includes (PRD §5.2, §14.7). */
const ALWAYS: FlagCode[] = [
  "OTHER_INCOME_NOT_INCLUDED",
  "CAPITAL_GAINS_NOT_INCLUDED",
  "FOREIGN_INCOME_OR_RESIDENCY",
  "FRINGE_BENEFITS_NOT_MODELLED",
  "HOME_OFFICE_NOT_MODELLED",
  "SDL_COIDA_EMPLOYER_ONLY",
];

/**
 * Exclusion and "good to know" flags (PRD §14.7). Situation-specific flags come
 * first, then the general ones. Each links to an Appendix A source.
 */
export function buildFlags(rules: TaxRuleSet, n: NormalisedInputs, facts: FlagFacts): Flag[] {
  const codes: FlagCode[] = [];
  const a = n.advanced;

  if (facts.belowThreshold && facts.incomeAnnual > 0) codes.push("BELOW_THRESHOLD_MAY_NOT_NEED_TO_FILE");
  if (a.hasSecondEmployer) codes.push("MULTIPLE_EMPLOYERS");
  if (n.variable.commissionAnnual.greaterThan(0) && facts.remunerationAnnual > 0) {
    // Commission earners: more than half of remuneration from commission (PRD §6.4.2).
    if (n.variable.commissionAnnual.toNumber() > facts.remunerationAnnual / 2) codes.push("COMMISSION_EARNER_DEDUCTIONS");
  }
  if (a.donationsAnnual.greaterThan(0) && !a.has18AReceipt) codes.push("DONATION_RECEIPT_NEEDED");
  if (a.donationsAnnual.greaterThan(rules.reference.donationsTaxAnnualExemption)) codes.push("DONATIONS_TAX_LARGE_GIFTS");
  if (a.travelAllowanceMonthly.greaterThan(0)) codes.push("TRAVEL_LOGBOOK_REQUIRED");
  if (a.localInterestAnnual.greaterThan(0)) codes.push("DIVIDENDS_NOT_INCLUDED");
  if (facts.medical6BNotProvided && (n.medical.member || n.medical.disabilityInFamily)) codes.push("MEDICAL_6B_POSSIBLE");
  if (facts.retirementPoolAnnual > 0) codes.push("RETIREMENT_LUMP_SUMS_NOT_CALCULATED");

  return [...codes, ...ALWAYS].map((code) => ({ code, source: SOURCE[code] }));
}
