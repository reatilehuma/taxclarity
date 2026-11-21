import { KNOWN_TAX_YEARS } from "@taxclarity/tax-engine";
import type { AssistantPayload } from "./types.ts";

/**
 * The gate every outgoing payload passes (PRD §15.2.3). It is a list of what IS allowed, not of what is
 * forbidden: a key or a piece of text that is not on the list stops the send. The named "never" list below
 * exists only to give a clearer message when someone tries to add one of those things.
 */

export class PayloadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PayloadError";
  }
}

/** Things that must never be sent, whatever they are called. */
const NEVER = /name|surname|email|e-?mail|phone|cell|mobile|address|employer|company|\bid\b|id_?number|passport|tax_?(ref|number|no)|sars_?ref|bank|account|branch|iban|card|password|token|secret|key/i;

/** Every field name in the payload, including those of the calculator's explanations and recommendations. */
const KEYS = new Set([
  // top level
  "taxYear", "mode", "confidence", "ageBand", "payFrequency", "figures", "bracketWalk", "comparison", "explanations", "recommendations", "rules",
  // figures
  "grossMonthly", "grossAnnual", "takeHomeMonthly", "takeHomeAnnual", "monthlyPaye", "annualPaye", "annualLiability", "taxableIncome",
  "annualTaxBeforeRebates", "rebatesTotal", "taxAfterRebates", "medicalCreditMonthly", "medicalCreditApplied", "uifMonthly", "uifAnnual",
  "ownRetirementMonthly", "privateRaMonthly", "ownMedicalMonthly", "variablePayAnnual", "variablePayTaxAnnual", "effectiveRate",
  "marginalRate", "taxThreshold", "refundAnnual", "owedAnnual",
  // bracket walk and comparison
  "from", "to", "rate", "amountInBracket", "taxInBracket", "runningTotal", "isTopBracket", "payslipPaye", "calcPaye", "diff", "closeMatch",
  // rules summary
  "uifMaxMonthly", "retirementRate", "retirementAnnualCap", "medicalMain", "medicalFirstDependant", "medicalAdditional", "rebatePrimary",
  "rebateSecondary", "rebateTertiary", "interestExemptionUnder65", "interestExemption65Plus", "tfsaAnnual", "tfsaLifetime", "donationsLimitRate",
  // explanations
  "id", "contributedMonthly", "deductionAnnual", "savingMonthly", "savingAnnual", "carryForwardAnnual", "annualCap", "members", "monthlyCredit",
  "mainMonthly", "firstDependantMonthly", "additionalMonthly", "annualCredit", "appliedAnnual", "unusedAnnual", "claimedOnFiling", "secondary",
  "tertiary", "givenAnnual", "hasReceipt", "totalAnnual", "taxAnnual", "monthly", "annual", "maxMonthly", "allowanceAnnual", "taxableRate",
  "taxableAnnual", "possibleDeductionAnnual", "interestAnnual", "exemptionAnnual", "outOfPocketAnnual",
  // recommendations
  "confidence", "roomAnnual", "extraMonthly", "monthlySaving", "annualSaving", "usableMonthly", "exampleAnnual", "limitRate", "exemptionAge65",
  "tfsaAnnual", "tfsaLifetime", "centsPerRand",
]);

/** The only pieces of text allowed as values: fixed labels the calculator itself produces. */
const TEXT = new Set([
  "GROSS", "TAKE_HOME", "PAYSLIP", "ESTIMATE", "PAYSLIP_ACCURATE", "UNDER_65", "AGE_65_74", "AGE_75_PLUS", "MONTHLY", "WEEKLY", "FORTNIGHTLY",
  "RETIREMENT", "MEDICAL_CREDIT", "AGE_REBATE", "DONATIONS", "VARIABLE_PAY", "UIF", "TRAVEL", "INTEREST", "MEDICAL_6B",
  "R1", "R2", "R3", "R4", "R5", "R6", "R7", "R8", "R9", "CALCULATED", "ESTIMATED", "INFORMATIONAL",
]);
/**
 * The tax years the calculator knows, as written in the payload ("2025/26"). The year is the one free-looking value
 * allowed in a payload, so it is checked against this list, not against a pattern: a year nobody defined is refused
 * (PRD §10.5). Whether a year is signed off is the calculator's business; the assistant only needs to know it exists.
 */
const KNOWN_YEAR_LABELS: ReadonlySet<string> = new Set(KNOWN_TAX_YEARS.map((y) => y.replace("-", "/")));

/** Throws a PayloadError naming the first thing that is not allowed. Otherwise returns the payload unchanged. */
export function assertAllowedPayload(value: unknown): AssistantPayload {
  // The list checks what is present. The year is also required: a payload that does not say which year it is for is refused.
  if (value && typeof value === "object" && !Array.isArray(value) && !Object.hasOwn(value, "taxYear")) {
    throw new PayloadError("payload.taxYear: missing (which tax year is this for?)");
  }
  walk(value, "payload", 0);
  return value as AssistantPayload;
}

function walk(value: unknown, path: string, depth: number): void {
  if (depth > 6) throw new PayloadError(`${path}: nested too deeply`);
  // The year must be one of the calculator's year labels, whatever the value's type: a number or a flag is not a year.
  if (path === "payload.taxYear" && typeof value !== "string") throw new PayloadError(`${path}: must be a tax year label`);
  if (value === null || typeof value === "boolean") return;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new PayloadError(`${path}: not a finite number`);
    return;
  }
  if (typeof value === "string") {
    if (path === "payload.taxYear") {
      if (!KNOWN_YEAR_LABELS.has(value)) throw new PayloadError(`${path}: not a tax year the calculator knows ("${value.slice(0, 20)}")`);
      return;
    }
    if (!TEXT.has(value)) throw new PayloadError(`${path}: free text is not allowed ("${value.slice(0, 20)}")`);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((v, i) => walk(v, `${path}[${i}]`, depth + 1));
    return;
  }
  if (typeof value === "object") {
    for (const [key, v] of Object.entries(value)) {
      if (NEVER.test(key) && !KEYS.has(key)) throw new PayloadError(`${path}.${key}: this kind of information is never sent`);
      if (!KEYS.has(key)) throw new PayloadError(`${path}.${key}: not on the allowed list`);
      walk(v, `${path}.${key}`, depth + 1);
    }
    return;
  }
  throw new PayloadError(`${path}: ${typeof value} is not allowed`);
}

/** The only way to turn a payload into text to send: it is checked first. */
export function serialisePayload(payload: AssistantPayload): string {
  return JSON.stringify(assertAllowedPayload(payload));
}

/** Every number in the payload: the complete list of figures a reply may quote. */
export function figuresIn(payload: AssistantPayload): number[] {
  const out: number[] = [];
  const visit = (v: unknown) => {
    if (typeof v === "number") out.push(v);
    else if (Array.isArray(v)) v.forEach(visit);
    else if (v && typeof v === "object") Object.values(v).forEach(visit);
  };
  visit(payload);
  return out;
}
