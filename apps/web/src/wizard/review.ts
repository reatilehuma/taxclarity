import type { CalculationResult, PayFrequency } from "@taxclarity/tax-engine";
import { copy, yearCopy } from "../content/strings.ts";
import { formatFinal } from "../lib/currency.ts";
import { formatPercent, formatRand } from "../lib/format.ts";
import { rulesFor } from "../lib/years.ts";
import { payslipApplies, variableField, type VariableType, type WizardAnswers } from "./answers.ts";
import type { StepId } from "./flow.ts";

/**
 * The review screen's content (PRD §8 Step 8): every answer, grouped by topic, each group
 * pointing at the step that changes it. Built from the answers and the engine result only.
 */
export interface ReviewRow {
  label: string;
  value: string;
  /** A row can have its own link when it is changed somewhere other than its group's step. */
  editStep?: StepId;
  /** The tax year is not a step: its "Change" link moves focus to the selector at the top of the wizard. */
  focusYearSelect?: boolean;
}

export interface ReviewGroup {
  id: "income" | "retirement" | "medical" | "variable" | "extras" | "payslip";
  title: string;
  editStep: StepId;
  rows: ReviewRow[];
}

const t = copy.wizard.review;
const rand = (n: number) => formatRand(n);
const FREQUENCY_LABEL = Object.fromEntries(copy.wizard.amount.frequencyOptions.map((o) => [o.value, o.label])) as Record<PayFrequency, string>;
const AGE_LABEL = Object.fromEntries(copy.wizard.age.options.map((o) => [o.value, o.label]));
const VARIABLE_ORDER: VariableType[] = ["BONUS", "OVERTIME", "COMMISSION"];
const positive = (v: number | null): v is number => v !== null && v > 0;

export function buildReview(a: WizardAnswers, result: CalculationResult | null): ReviewGroup[] {
  const groups: ReviewGroup[] = [];
  const mode = a.mode ?? "GROSS";
  const period = copy.wizard.amount.periodWord[a.payFrequency];

  // --- Your income
  const income: ReviewRow[] = [
    { label: t.rows.taxYear, value: yearCopy(rulesFor(a.taxYear)).labelWithDates, focusYearSelect: true },
    { label: t.rows.startedFrom, value: copy.wizard.start.options[mode].title, editStep: "start" },
    { label: t.rows.amount[mode](period), value: rand(a.amount ?? 0) },
  ];
  if (a.payFrequency !== "MONTHLY" && result) {
    const monthly = mode === "TAKE_HOME" ? result.estimate?.targetMonthly : result.grossMonthly;
    if (monthly !== undefined) income.push({ label: t.rows.monthlyEquivalent, value: rand(monthly) });
  }
  income.push({ label: t.rows.paid, value: FREQUENCY_LABEL[a.payFrequency] });
  income.push({ label: t.rows.age, value: AGE_LABEL[a.ageBand] ?? "", editStep: "age" });
  groups.push({ id: "income", title: t.groups.income, editStep: "amount", rows: income });

  // --- Retirement
  const r = a.retirement;
  const retirement: ReviewRow[] = [];
  if (!r.has) {
    retirement.push({ label: t.rows.contributions, value: t.rows.none });
  } else {
    if (positive(r.payslipMonthly)) retirement.push({ label: t.rows.payslipRetirement, value: rand(r.payslipMonthly) });
    if (positive(r.raMonthly)) retirement.push({ label: t.rows.raRetirement, value: rand(r.raMonthly) });
    if (r.employerContributes && positive(r.employerMonthly)) {
      retirement.push({ label: t.rows.employerRetirement, value: rand(r.employerMonthly) });
    }
    if (result && result.retirement.ownPercentOfGross > 0) {
      retirement.push({ label: t.rows.percentOfSalary, value: formatPercent(result.retirement.ownPercentOfGross / 100) });
    }
  }
  groups.push({ id: "retirement", title: t.groups.retirement, editStep: "retirement", rows: retirement });

  // --- Medical aid
  const m = a.medical;
  const medical: ReviewRow[] = [];
  if (!m.member) {
    medical.push({ label: t.rows.medicalAid, value: t.rows.no });
  } else {
    medical.push({ label: t.rows.members, value: String(m.members) });
    medical.push({ label: t.rows.medicalTotal, value: rand(m.monthlyTotal ?? 0) });
    medical.push({ label: copy.wizard.medical.paidByLegend, value: t.rows.medicalPaidBy[m.paidBy] });
    if (m.paidBy === "SHARED") medical.push({ label: t.rows.employerShare, value: rand(m.employerShare ?? 0) });
    if (m.paidBy !== "EMPLOYER") medical.push({ label: copy.wizard.medical.viaLegend, value: t.rows.ownSharePaid[m.ownSharePaidVia] });
    if (m.outOfPocketAnnual !== null) medical.push({ label: t.rows.outOfPocket, value: rand(m.outOfPocketAnnual) });
    if (a.extras.medicalMonths !== 12) {
      medical.push({ label: t.rows.months, value: String(a.extras.medicalMonths), editStep: "extras" });
    }
    if (a.extras.disability) medical.push({ label: t.rows.disability, value: t.rows.yes, editStep: "extras" });
  }
  groups.push({ id: "medical", title: t.groups.medical, editStep: "medical", rows: medical });

  // --- Bonus, overtime, commission
  const picked = VARIABLE_ORDER.filter((type) => a.variable.types?.includes(type));
  const variable: ReviewRow[] = picked.length
    ? picked.map((type) => ({ label: t.rows.types[type], value: rand(a.variable[variableField(type)] ?? 0) }))
    : [{ label: t.rows.otherPay, value: t.rows.none }];
  groups.push({ id: "variable", title: t.groups.variable, editStep: "variable", rows: variable });

  // --- Optional extras: only what was filled in
  const e = a.extras;
  const extras: ReviewRow[] = [];
  if (positive(e.donationsAnnual)) {
    extras.push({ label: t.rows.donations, value: rand(e.donationsAnnual) });
    extras.push({ label: t.rows.receipt, value: e.has18AReceipt ? t.rows.haveReceipt : t.rows.noReceipt });
  }
  if (positive(e.interestAnnual)) extras.push({ label: t.rows.interest, value: rand(e.interestAnnual) });
  if (positive(e.travelAllowanceMonthly)) {
    extras.push({ label: t.rows.travel, value: rand(e.travelAllowanceMonthly) });
    extras.push({ label: t.rows.businessUse, value: t.rows.businessUseValues[e.travelBusinessHigh ? "HIGH" : "LOW"] });
    if (positive(e.travelKmAnnual)) extras.push({ label: t.rows.km, value: `${formatFinal(e.travelKmAnnual, 0)} km` });
  }
  if (e.hasSecondEmployer) {
    extras.push({ label: t.rows.second, value: positive(e.secondEmployerAnnual) ? rand(e.secondEmployerAnnual) : t.rows.secondUnknown });
  }
  if (extras.length > 0) groups.push({ id: "extras", title: t.groups.extras, editStep: "extras", rows: extras });

  // --- Payslip (gross and payslip modes)
  if (payslipApplies(a) && (mode === "PAYSLIP" || a.payslip.paye !== null || a.payslip.uif !== null)) {
    const p = a.payslip;
    const uifValue =
      p.uif !== null ? rand(p.uif) : result ? t.rows.uifAssumed(rand(result.uifPerPeriod)) : t.rows.notEntered;
    groups.push({
      id: "payslip",
      title: t.groups.payslip,
      editStep: "payslip",
      rows: [
        { label: t.rows.payslipPaye, value: p.paye !== null ? rand(p.paye) : t.rows.notEntered },
        { label: t.rows.payslipUif, value: uifValue },
      ],
    });
  }

  return groups;
}
