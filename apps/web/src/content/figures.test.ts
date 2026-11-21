import { RULE_SETS, type TaxRuleSet } from "@taxclarity/tax-engine";
import { describe, expect, it } from "vitest";
import { formatPercent, formatRand } from "../lib/format.ts";
import { EXAMPLE_INPUTS } from "./example.ts";
import { copy, ruleCopy } from "./strings.ts";

/**
 * Figures written into the copy must belong to the tax year the copy is about (PRD §6.16).
 *
 * Two guards, for rand figures and for percentages:
 *  1. The fixed copy (`copy`) quotes NO tax-rule figure. Anything that does is written as a template in `ruleCopy` and
 *     filled from the selected year's rule set, so no sentence can be left quoting another year's number.
 *  2. For EACH year, every figure in that year's rendered sentences (`ruleCopy(rules)`) is that year's own.
 *
 * When a new tax year changes a figure, guard 1 still holds; guard 2 fails only if a template was written wrongly; and a
 * fixed sentence that mentions a rate that is no longer the same in every year fails guard 1 (docs/RUNBOOK-NEW-TAX-YEAR.md).
 */

function strings(value: unknown, path: string, out: [string, string][] = []): [string, string][] {
  if (typeof value === "string") out.push([path, value]);
  else if (Array.isArray(value)) value.forEach((v, i) => strings(v, `${path}[${i}]`, out));
  else if (value && typeof value === "object") for (const [k, v] of Object.entries(value)) strings(v, `${path}.${k}`, out);
  return out;
}

function numbers(value: unknown, out: number[] = []): number[] {
  if (typeof value === "number") out.push(value);
  else if (Array.isArray(value)) value.forEach((v) => numbers(v, out));
  else if (value && typeof value === "object") Object.values(value).forEach((v) => numbers(v, out));
  return out;
}

const compact = (s: string) => s.replace(/[\s ]/g, "");
/** Every rand figure in a piece of text, however it is spaced: "R430 000", "R 430 000", "R177,12". */
const randFiguresIn = (text: string) => [...text.matchAll(/R[\s ]?\d[\d\s ]*(?:,\d{2})?/g)].map((m) => compact(m[0]));
const percentsIn = (text: string) => [...text.matchAll(/\d+(?:,\d+)?%/g)].map((m) => m[0]);
/** The number the way the copy writes it. */
const written = (n: number) => compact(formatRand(n, { decimals: Number.isInteger(n) ? 0 : 2 }));

/** Round-number examples that are not tax parameters (what a donation or a contribution "could" be, say). */
const EXAMPLES = new Set(["R0", "R1", "R2", "R3", "R4", "R5", "R6", "R7", "R8", "R9", "R100", "R1000", "R2000"]);
/** Percentages that are not tax rates. */
const NOT_RATES = new Set(["100%"]);

/** Every rate in a rule set, as written: "27,5%". */
function ratesOf(r: TaxRuleSet): Set<string> {
  const rates = [
    ...r.brackets.map((b) => b.rate),
    r.uif.employeeRate,
    r.retirement11F.rate,
    r.donations18A.limitRate,
    r.tfsa.excessPenaltyRate,
    r.travel.taxableDefaultRate,
    r.travel.taxableBusinessRate,
    r.travel.businessUseThreshold,
    r.medical6B.under65.multiplier,
    r.medical6B.under65.incomeThresholdRate,
    r.medical6B.olderOrDisabled.multiplier,
    r.guidance.topBracketRate,
  ];
  return new Set(rates.map((x) => formatPercent(x)));
}

describe("the fixed copy quotes no tax-rule figure", () => {
  const all = strings(copy, "copy");
  const rand = all.flatMap(([path, text]) => randFiguresIn(text).map((f) => [path, f] as const));
  // The landing example (R32 000 a month) is an input, not a rule.
  const allowed = new Set([...EXAMPLES, written(EXAMPLE_INPUTS.amount)]);

  it.each(rand)("%s: %s is an example, not a rule figure", (path, figure) => {
    expect(allowed.has(figure), `${figure} (in ${path}) looks like a tax figure: write it as a template in ruleCopy`).toBe(true);
  });

  // A fixed sentence may mention a rate only if every year has it. Then it cannot go stale in one year.
  const everyYear = RULE_SETS.map(ratesOf).reduce((a, b) => new Set([...a].filter((x) => b.has(x))));
  const percents = all.flatMap(([path, text]) => percentsIn(text).map((f) => [path, f] as const));
  it.each(percents)("%s: %s is not a rate that differs between years", (path, figure) => {
    expect(NOT_RATES.has(figure) || everyYear.has(figure), `${figure} (in ${path}) is not a rate shared by every year`).toBe(true);
  });
});

describe.each(RULE_SETS.map((r) => [r.label, r] as const))("the sentences for %s quote that year's figures", (_label, rules) => {
  const rendered = strings(ruleCopy(rules), "ruleCopy");
  const known = new Set(numbers(rules).map(written));
  const rates = ratesOf(rules);

  it("contains the figures it is meant to guard, in this year's value", () => {
    const text = rendered.map(([, t]) => t).join(" ");
    const figures = randFiguresIn(text);
    for (const n of [rules.retirement11F.annualCap, rules.uif.maxMonthlyEmployee, rules.medical6A.monthlyMain, rules.medical6A.monthlyAdditionalDep]) {
      expect(figures, `${written(n)} should appear`).toContain(written(n));
    }
  });

  it.each(rendered.flatMap(([path, text]) => randFiguresIn(text).map((f) => [path, f] as const)))("%s: rand figure %s", (path, figure) => {
    expect(known.has(figure) || EXAMPLES.has(figure), `${figure} (in ${path}) is not in the ${rules.label} rule set`).toBe(true);
  });

  it.each(rendered.flatMap(([path, text]) => percentsIn(text).map((f) => [path, f] as const)))("%s: percentage %s", (path, figure) => {
    expect(rates.has(figure) || NOT_RATES.has(figure), `${figure} (in ${path}) is not a ${rules.label} rate`).toBe(true);
  });

  it("names its own year and no other", () => {
    const text = rendered.map(([, t]) => t).join(" ");
    expect(text).toContain(rules.label);
    for (const other of RULE_SETS.filter((r) => r !== rules)) expect(text, `mentions ${other.label}`).not.toContain(other.label);
  });
});

describe("the two years really do differ where the figures differ", () => {
  it("their rendered limits are not the same text", () => {
    const [a, b] = RULE_SETS.map((r) => ruleCopy(r));
    expect(a!.retirementLimitFaq).not.toBe(b!.retirementLimitFaq);
    expect(a!.uifHint).toBe(b!.uifHint); // the UIF maximum is the same in these two years
    expect(a!.capability.heart).not.toBe(b!.capability.heart);
  });
});
