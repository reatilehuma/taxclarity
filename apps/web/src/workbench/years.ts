import type { CalculationResult, SourceId, TaxRuleSet } from "@taxclarity/tax-engine";
import { formatDate, formatPercent, formatRand } from "../lib/format.ts";

/**
 * Data for the Workbench's year views: the Parameters list and the Compare-years table.
 * Both only read rule-set values and engine results and format them. No tax arithmetic.
 */

export interface ParameterRow {
  group: string;
  label: string;
  value: string;
  /** Source IDs for this group, from the rule set (apps/web/src/lib/sources.ts has their links). */
  sources: readonly SourceId[];
}

const rand = (n: number) => formatRand(n, { decimals: Number.isInteger(n) ? 0 : 2 });
const perMonth = (n: number) => `${rand(n)} a month`;

export function parameterRows(rules: TaxRuleSet): ParameterRow[] {
  const src = (key: string): readonly SourceId[] => rules.sources[key] ?? [];
  const row = (key: string, group: string, label: string, value: string): ParameterRow => ({
    group,
    label,
    value,
    sources: src(key),
  });

  const rows: ParameterRow[] = [];
  rules.brackets.forEach((b, i) => {
    const range = b.to === null ? `above ${rand(b.from)}` : `${rand(b.from)} to ${rand(b.to)}`;
    rows.push(row("brackets", "Tax brackets", `Bracket ${i + 1}`, `${formatPercent(b.rate)} · ${range} · base ${rand(b.base)}`));
  });

  const { rebates, thresholds, uif, retirement11F: ret, medical6A: m6a, medical6B: m6b, tfsa, travel } = rules;
  rows.push(
    row("rebates", "Rebates", "Primary", rand(rebates.primary)),
    row("rebates", "Rebates", "Secondary (65 and older)", rand(rebates.secondary65)),
    row("rebates", "Rebates", "Tertiary (75 and older)", rand(rebates.tertiary75)),
    row("thresholds", "Tax thresholds", "Under 65", rand(thresholds.under65)),
    row("thresholds", "Tax thresholds", "65 to 74", rand(thresholds.age65to74)),
    row("thresholds", "Tax thresholds", "75 and older", rand(thresholds.age75plus)),
    row("uif", "UIF", "Employee rate", formatPercent(uif.employeeRate)),
    row("uif", "UIF", "Monthly earnings ceiling", rand(uif.monthlyCeiling)),
    row("uif", "UIF", "Most an employee pays", perMonth(uif.maxMonthlyEmployee)),
    row("retirement11F", "Retirement (Section 11F)", "Share of income", formatPercent(ret.rate)),
    row("retirement11F", "Retirement (Section 11F)", "Yearly cap", rand(ret.annualCap)),
    row("medical6A", "Medical credit (Section 6A)", "Main member", perMonth(m6a.monthlyMain)),
    row("medical6A", "Medical credit (Section 6A)", "First dependant", perMonth(m6a.monthlyFirstDep)),
    row("medical6A", "Medical credit (Section 6A)", "Each extra dependant", perMonth(m6a.monthlyAdditionalDep)),
    row(
      "medical6B",
      "Extra medical credit (Section 6B)",
      "Under 65",
      `${formatPercent(m6b.under65.multiplier)} · contributions above ${m6b.under65.contributionMultiple} × credits · above ${formatPercent(m6b.under65.incomeThresholdRate)} of taxable income`,
    ),
    row(
      "medical6B",
      "Extra medical credit (Section 6B)",
      "65 and older, or disability",
      `${formatPercent(m6b.olderOrDisabled.multiplier)} · contributions above ${m6b.olderOrDisabled.contributionMultiple} × credits`,
    ),
    row("donations18A", "Donations (Section 18A)", "Limit", `${formatPercent(rules.donations18A.limitRate)} of taxable income`),
    row("interestExemption", "Interest exemption", "Under 65", rand(rules.interestExemption.under65)),
    row("interestExemption", "Interest exemption", "65 and older", rand(rules.interestExemption.age65plus)),
    row("tfsa", "Tax-free investments", "Yearly limit", rand(tfsa.annualLimit)),
    row("tfsa", "Tax-free investments", "Lifetime limit", rand(tfsa.lifetimeLimit)),
    row("tfsa", "Tax-free investments", "Penalty on excess", formatPercent(tfsa.excessPenaltyRate)),
    row("travel", "Travel allowance", "Simplified rate per km", `R${String(travel.prescribedRatePerKm).replace(".", ",")}`),
    row("travel", "Travel allowance", "Taxable share (default)", formatPercent(travel.taxableDefaultRate)),
    row("travel", "Travel allowance", "Taxable share (mostly business)", formatPercent(travel.taxableBusinessRate)),
    row("travel", "Travel allowance", "Business use for the lower share", `${formatPercent(travel.businessUseThreshold)} or more`),
    row("reference", "Reference only", "Donations tax yearly exemption", rand(rules.reference.donationsTaxAnnualExemption)),
  );
  return rows;
}

/** The facts about the rule set itself, shown above the parameters. */
export function ruleSetFacts(rules: TaxRuleSet): { label: string; value: string }[] {
  return [
    { label: "Year", value: rules.label },
    { label: "Period", value: `${formatDate(rules.startDate)} to ${formatDate(rules.endDate)}` },
    { label: "Status", value: rules.status === "verified" ? "Verified" : "Draft: not signed off" },
    { label: "Rules version", value: rules.rulesVersion },
    { label: "Last checked", value: formatDate(rules.lastVerified) },
  ];
}

// ---------------------------------------------------------------------------

export interface CompareRow {
  label: string;
  a: number;
  b: number;
  kind: "money" | "percent";
}

type Pick = readonly [label: string, get: (r: CalculationResult) => number, kind?: "percent"];

const COMPARED: readonly Pick[] = [
  ["Income before deductions", (r) => r.incomeBeforeDeductions],
  ["Taxable income", (r) => r.taxableIncome],
  ["Tax before rebates", (r) => r.annualTaxBeforeRebates],
  ["Rebates", (r) => r.rebates.total],
  ["Medical credits (6A)", (r) => r.medical6A.appliedAnnual],
  ["Extra medical credit (6B)", (r) => r.medical6B.appliedAnnual],
  ["Final tax for the year", (r) => r.annualLiability],
  ["PAYE in a normal month", (r) => r.monthlyPaye],
  ["UIF in a normal month", (r) => r.uifMonthly],
  ["Take-home in a normal month", (r) => r.takeHomeMonthly],
  ["Tax-free threshold", (r) => r.taxThreshold],
  ["Marginal rate", (r) => r.marginalRate, "percent"],
  ["Effective rate", (r) => r.effectiveRate, "percent"],
];

/** Lines the Compare view shows for one set of inputs run through two years (a = first year, b = second). */
export function compareRows(a: CalculationResult, b: CalculationResult): CompareRow[] {
  return COMPARED.map(([label, get, kind]) => ({ label, a: get(a), b: get(b), kind: kind ?? "money" }));
}
