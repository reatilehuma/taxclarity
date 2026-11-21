import type { Explanation, Recommendation } from "@taxclarity/tax-engine";

/**
 * What the assistant is allowed to know (PRD §15.2). Only numbers, yes/no flags and a few fixed labels,
 * all of them already worked out by the calculator. There is nowhere to put a name, an ID number, a tax
 * reference, an employer or a bank detail, and `assertAllowedPayload` refuses anything that is not listed.
 */
export interface AssistantPayload {
  taxYear: string;
  mode: "GROSS" | "TAKE_HOME" | "PAYSLIP";
  confidence: "ESTIMATE" | "PAYSLIP_ACCURATE";
  ageBand: "UNDER_65" | "AGE_65_74" | "AGE_75_PLUS";
  payFrequency: "MONTHLY" | "WEEKLY" | "FORTNIGHTLY";
  figures: PayloadFigures;
  bracketWalk: PayloadBracket[];
  comparison: PayloadComparison | null;
  explanations: Explanation[];
  recommendations: Recommendation[];
  rules: PayloadRules;
}

export interface PayloadFigures {
  grossMonthly: number;
  grossAnnual: number;
  takeHomeMonthly: number;
  takeHomeAnnual: number;
  monthlyPaye: number;
  annualPaye: number;
  annualLiability: number;
  taxableIncome: number;
  annualTaxBeforeRebates: number;
  rebatesTotal: number;
  taxAfterRebates: number;
  medicalCreditMonthly: number;
  medicalCreditApplied: number;
  uifMonthly: number;
  uifAnnual: number;
  ownRetirementMonthly: number;
  privateRaMonthly: number;
  ownMedicalMonthly: number;
  variablePayAnnual: number;
  variablePayTaxAnnual: number;
  effectiveRate: number;
  marginalRate: number;
  taxThreshold: number;
  refundAnnual: number;
  owedAnnual: number;
}

export interface PayloadBracket {
  from: number;
  to: number | null;
  rate: number;
  amountInBracket: number;
  taxInBracket: number;
  runningTotal: number;
  isTopBracket: boolean;
}

export interface PayloadComparison {
  payslipPaye: number;
  calcPaye: number;
  diff: number;
  closeMatch: boolean;
}

/** The rule-set summary: published SARS figures for the year, not anything about the person. */
export interface PayloadRules {
  uifMaxMonthly: number;
  retirementRate: number;
  retirementAnnualCap: number;
  medicalMain: number;
  medicalFirstDependant: number;
  medicalAdditional: number;
  rebatePrimary: number;
  rebateSecondary: number;
  rebateTertiary: number;
  interestExemptionUnder65: number;
  interestExemption65Plus: number;
  tfsaAnnual: number;
  tfsaLifetime: number;
  donationsLimitRate: number;
}

export interface ChatTurn {
  role: "user" | "assistant";
  text: string;
}

export interface AssistantRequest {
  question: string;
  payload: AssistantPayload;
  history: ChatTurn[];
}

export interface AssistantReply {
  text: string;
}

/**
 * Anything that can answer a question about a result. The local explainer and (in Phase 15) a real model
 * both sit behind this, so the rest of the app does not care which one is in use.
 */
export interface TaxAssistantProvider {
  /** Stable id. Consent is remembered per provider, so a different provider asks again. */
  readonly id: string;
  /** A short name for the consent screen. */
  readonly label: string;
  /** True when answers are made on this device and nothing is sent anywhere. */
  readonly runsOnDevice: boolean;
  ask(request: AssistantRequest): Promise<AssistantReply>;
}
