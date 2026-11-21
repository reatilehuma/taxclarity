import {
  createYearCalculator,
  DEFAULT_TAX_YEAR,
  DEV_YEAR_OPTIONS,
  getVerifiedRuleSet,
  RULE_SETS,
  type TaxRuleSet,
  type TaxYear,
} from "@taxclarity/tax-engine";
import { useId, useMemo, useState } from "react";
import { EMPTY, ENGINE_ONLY_VECTORS, type FormState, SCENARIOS, type Scenario, TEST_VECTORS, toInputs, Y_VECTORS } from "./form.ts";
import { formatDate } from "../lib/format.ts";
import { Card, Checkbox, MoneyField, NumberField, Segmented, Stepper, SubHeading, Toggle } from "./inputs.tsx";
import {
  BracketTable,
  CashFlow,
  ComparisonCard,
  ExtrasCard,
  FilingCard,
  Flags,
  Headline,
  MedicalCard,
  PERIOD_NOUN,
  Provenance,
  RetirementCard,
  TaxWorking,
} from "./results.tsx";
import { RulesContext } from "./rulesContext.ts";
import { CompareYears, DraftBanner, ParametersView } from "./years.tsx";

/**
 * Development-only page that shows raw engine output for any input.
 * It grows with each engine phase and stays as a QA tool for the whole project.
 */

/**
 * The Workbench is a development tool, so it is the one place that imports the draft years and passes them in.
 * The calculator picks the rules from each input's `taxYear` and keeps one cache for every year, keyed on year
 * and rules version.
 */
const DEV_OPTIONS = DEV_YEAR_OPTIONS;
const calculate = createYearCalculator(DEV_OPTIONS);

type View = "results" | "compare" | "parameters";
const VIEWS: { id: View; label: string }[] = [
  { id: "results", label: "Results" },
  { id: "compare", label: "Compare years" },
  { id: "parameters", label: "Parameters" },
];

export function Workbench() {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [active, setActive] = useState<Scenario | null>(null);
  const [year, setYear] = useState<TaxYear>(DEFAULT_TAX_YEAR);
  const [view, setView] = useState<View>("results");
  const rules: TaxRuleSet = getVerifiedRuleSet(year, DEV_OPTIONS);
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));
  const load = (s: Scenario) => {
    setForm({ ...EMPTY, ...s.form });
    setActive(s);
    setYear(s.year ?? DEFAULT_TAX_YEAR); // a preset's expected figures are for its own year
  };

  // The same inputs through every year's rule set: the chosen year drives the page, all of them feed Compare.
  const byYear = useMemo(() => {
    const inputs = toInputs(form);
    return RULE_SETS.map((r) => calculate({ ...inputs, taxYear: r.taxYear }));
  }, [form]);
  const result = byYear[RULE_SETS.findIndex((r) => r.taxYear === year)]!;
  const yearSelectId = useId();
  const period = PERIOD_NOUN[form.payFrequency];
  const vectorSelectId = useId();

  return (
    <RulesContext.Provider value={rules}>
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">Development only</p>
            <h1 className="text-xl font-semibold text-brand-900">Engine Workbench</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <label htmlFor={yearSelectId} className="font-semibold text-slate-700">
              Tax year
            </label>
            <select
              id={yearSelectId}
              value={year}
              onChange={(e) => setYear(e.target.value as TaxYear)}
              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm font-medium focus:border-brand-600 focus:ring-2 focus:ring-brand-100 focus:outline-none"
            >
              {RULE_SETS.map((r) => (
                <option key={r.taxYear} value={r.taxYear}>
                  {r.label} ({formatDate(r.startDate)} to {formatDate(r.endDate)}){r.status === "draft" ? " · Draft" : ""}
                </option>
              ))}
            </select>
            <span className="rounded-full bg-brand-50 px-3 py-1 font-medium text-brand-700">
              Rule set {rules.label} · {rules.rulesVersion}
            </span>
            <span className="rounded-full bg-emerald-50 px-3 py-1 font-medium text-emerald-800">
              Phase 17: year-aware engine
            </span>
          </div>
        </div>
      </header>
      <DraftBanner rules={rules} />

      <main className="mx-auto grid max-w-6xl gap-6 px-4 py-6 lg:grid-cols-[380px_1fr]">
        <section aria-labelledby="inputs-heading" className="flex flex-col gap-5">
          <h2 id="inputs-heading" className="sr-only">
            Inputs
          </h2>

          <Card>
            <label htmlFor={vectorSelectId} className="mb-1.5 block text-base font-semibold text-slate-900">
              Load a PRD test vector
            </label>
            <select
              id={vectorSelectId}
              value={active && [...TEST_VECTORS, ...Y_VECTORS].includes(active) ? active.id : ""}
              onChange={(e) => {
                const v = [...TEST_VECTORS, ...Y_VECTORS].find((t) => t.id === e.target.value);
                if (v) load(v);
              }}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-600 focus:ring-2 focus:ring-brand-100 focus:outline-none"
            >
              <option value="" disabled>
                Choose a vector…
              </option>
              <optgroup label="2026/27 · PRD vectors T1–T20">
                {TEST_VECTORS.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </optgroup>
              <optgroup label="2025/26 · reference vectors Y1–Y19 (draft)">
                {Y_VECTORS.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </optgroup>
            </select>
            <p className="mt-1.5 text-xs text-slate-500">{ENGINE_ONLY_VECTORS}</p>

            <h3 className="mt-4 mb-2 text-sm font-semibold text-slate-900">Other scenarios</h3>
            <div className="flex flex-wrap gap-1.5">
              {SCENARIOS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => load(s)}
                  aria-pressed={active?.id === s.id}
                  className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-brand-600 hover:bg-brand-50 focus-visible:outline-2 focus-visible:outline-brand-600 aria-pressed:border-brand-600 aria-pressed:bg-brand-50"
                >
                  {s.label}
                </button>
              ))}
            </div>

            {active && (active.year ?? DEFAULT_TAX_YEAR) === year && (
              <div className="mt-4 rounded-lg bg-slate-900 px-3 py-2.5 text-xs text-slate-100">
                <p className="font-semibold text-white">Expect ({active.id})</p>
                <p className="money mt-0.5">{active.expect}</p>
              </div>
            )}
            {active && (active.year ?? DEFAULT_TAX_YEAR) !== year && (
              <p className="mt-4 rounded-lg bg-slate-100 px-3 py-2.5 text-xs text-slate-700">
                {active.id}'s expected figures are for {getVerifiedRuleSet(active.year ?? DEFAULT_TAX_YEAR, DEV_OPTIONS).label}, so
                none are shown for {rules.label}. Switch back to compare, or open Compare years.
              </p>
            )}
          </Card>

          <Card>
            <h3 className="mb-4 text-base font-semibold text-slate-900">Salary</h3>
            <Segmented
              legend="I'm starting from…"
              name="mode"
              value={form.mode}
              onChange={(v) => set("mode", v)}
              options={[
                { value: "GROSS", label: "Gross salary" },
                { value: "TAKE_HOME", label: "Bank deposit" },
                { value: "PAYSLIP", label: "Payslip" },
              ]}
            />
            <MoneyField
              label={form.mode === "TAKE_HOME" ? `Money in your bank account per ${period}` : `Gross salary per ${period}`}
              hint={
                form.mode === "TAKE_HOME"
                  ? "A normal deposit, without bonuses. We'll estimate your gross."
                  : "Before tax, UIF or any other deduction."
              }
              value={form.amount}
              onChange={(v) => set("amount", v)}
            />
            <Segmented
              legend="How often are you paid?"
              name="frequency"
              value={form.payFrequency}
              onChange={(v) => set("payFrequency", v)}
              options={[
                { value: "MONTHLY", label: "Monthly" },
                { value: "FORTNIGHTLY", label: "Fortnightly" },
                { value: "WEEKLY", label: "Weekly" },
              ]}
            />
            <Segmented
              legend={`Age on ${formatDate(rules.endDate)}`}
              name="age-band"
              value={form.ageBand}
              onChange={(v) => set("ageBand", v)}
              options={[
                { value: "UNDER_65", label: "Younger than 65" },
                { value: "AGE_65_74", label: "65 to 74" },
                { value: "AGE_75_PLUS", label: "75 or older" },
              ]}
            />
            {form.mode !== "TAKE_HOME" && (
              <>
                <SubHeading>From your payslip {form.mode === "GROSS" && "(optional)"}</SubHeading>
                <MoneyField
                  label="PAYE deducted this month"
                  hint={form.mode === "PAYSLIP" ? "Needed to compare with our calculation." : "Fill in to compare."}
                  value={form.payslipPaye}
                  onChange={(v) => set("payslipPaye", v)}
                  optional
                />
                <MoneyField
                  label="UIF deducted this month"
                  hint="Leave blank and we'll assume the calculated amount."
                  value={form.payslipUif}
                  onChange={(v) => set("payslipUif", v)}
                  optional
                />
              </>
            )}
          </Card>

          <Card>
            <Toggle
              label="Pension, provident fund or retirement annuity"
              checked={form.hasRetirement}
              onChange={(v) => set("hasRetirement", v)}
            />
            {form.hasRetirement && (
              <div className="mt-4">
                <MoneyField
                  label="Your contribution off your payslip, per month"
                  value={form.retirementOwn}
                  onChange={(v) => set("retirementOwn", v)}
                />
                <MoneyField
                  label="Retirement annuity by debit order, per month"
                  hint="Paid from your bank account, not your payslip. The tax saving comes back when you file."
                  value={form.privateRa}
                  onChange={(v) => set("privateRa", v)}
                />
                <MoneyField
                  label="Employer contribution per month"
                  hint="Taxable benefit, but also deductible."
                  value={form.retirementEmployer}
                  onChange={(v) => set("retirementEmployer", v)}
                />
                <fieldset>
                  <legend className="mb-1.5 text-sm font-medium text-slate-700">Fund type (information only)</legend>
                  <div className="flex flex-wrap gap-3 text-sm">
                    {(
                      [
                        ["PENSION", "Pension"],
                        ["PROVIDENT", "Provident"],
                        ["RA", "Retirement annuity"],
                      ] as const
                    ).map(([value, label]) => (
                      <label key={value} className="flex items-center gap-1.5">
                        <input
                          type="checkbox"
                          className="accent-brand-600"
                          checked={form.fundTypes.includes(value)}
                          onChange={(e) =>
                            set(
                              "fundTypes",
                              e.target.checked ? [...form.fundTypes, value] : form.fundTypes.filter((t) => t !== value),
                            )
                          }
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                </fieldset>
              </div>
            )}
          </Card>

          <Card>
            <Toggle label="Medical aid" checked={form.hasMedical} onChange={(v) => set("hasMedical", v)} />
            {form.hasMedical && (
              <div className="mt-4">
                <Stepper
                  label="People on the plan, including you"
                  value={form.members}
                  min={1}
                  max={15}
                  onChange={(v) => set("members", v)}
                />
                <MoneyField
                  label="Total contribution per month"
                  hint="Everything paid to the scheme, by you and your employer."
                  value={form.medicalTotal}
                  onChange={(v) => set("medicalTotal", v)}
                />
                <Segmented
                  legend="Who pays it?"
                  name="paid-by"
                  value={form.medicalPaidBy}
                  onChange={(v) => set("medicalPaidBy", v)}
                  options={[
                    { value: "SELF", label: "I pay it" },
                    { value: "EMPLOYER", label: "Employer pays" },
                    { value: "SHARED", label: "We share" },
                  ]}
                />
                {form.medicalPaidBy === "SHARED" && (
                  <MoneyField
                    label="Employer's share per month"
                    value={form.medicalEmployer}
                    onChange={(v) => set("medicalEmployer", v)}
                  />
                )}
                {form.medicalPaidBy !== "EMPLOYER" && (
                  <Segmented
                    legend="How is your share paid?"
                    name="paid-via"
                    value={form.medicalPaidVia}
                    onChange={(v) => set("medicalPaidVia", v)}
                    options={[
                      { value: "PAYROLL", label: "Off my payslip" },
                      { value: "DEBIT_ORDER", label: "Debit order" },
                    ]}
                  />
                )}
                <Stepper
                  label="Months on medical aid this tax year"
                  value={form.monthsCovered}
                  min={0}
                  max={12}
                  onChange={(v) => set("monthsCovered", v)}
                />
              </div>
            )}
            <SubHeading>Medical costs not covered (Section 6B)</SubHeading>
            <MoneyField
              label="Out-of-pocket medical costs this year"
              hint="Leave blank if you don't know. Works without a medical aid too."
              value={form.outOfPocket}
              onChange={(v) => set("outOfPocket", v)}
              optional
            />
            <Checkbox
              label="You, your spouse or a child has a disability"
              checked={form.disability}
              onChange={(v) => set("disability", v)}
            />
          </Card>

          <Card>
            <Toggle
              label="Bonus, overtime or commission"
              checked={form.hasVariable}
              onChange={(v) => set("hasVariable", v)}
            />
            {form.hasVariable && (
              <div className="mt-4">
                <p className="mb-3 text-xs text-slate-500">Rough totals you expect for the whole tax year.</p>
                <MoneyField label="Bonus or 13th cheque per year" value={form.bonus} onChange={(v) => set("bonus", v)} />
                <MoneyField label="Overtime per year" value={form.overtime} onChange={(v) => set("overtime", v)} />
                <MoneyField label="Commission per year" value={form.commission} onChange={(v) => set("commission", v)} />
              </div>
            )}
          </Card>

          <Card>
            <Toggle label="Optional extras" checked={form.hasExtras} onChange={(v) => set("hasExtras", v)} />
            {form.hasExtras && (
              <div className="mt-4">
                <MoneyField
                  label="Donations to registered charities (Section 18A) this year"
                  value={form.donations}
                  onChange={(v) => set("donations", v)}
                />
                <Checkbox label="I have a valid 18A receipt" checked={form.hasReceipt} onChange={(v) => set("hasReceipt", v)} />
                <MoneyField
                  label="Interest from SA bank accounts this year"
                  value={form.interest}
                  onChange={(v) => set("interest", v)}
                />
                <SubHeading>Travel allowance</SubHeading>
                <MoneyField
                  label="Travel allowance per month"
                  value={form.travelAllowance}
                  onChange={(v) => set("travelAllowance", v)}
                />
                <Segmented
                  legend="How much of your driving is for work?"
                  name="travel-business"
                  value={form.travelBusiness80 ? "HIGH" : "LOW"}
                  onChange={(v) => set("travelBusiness80", v === "HIGH")}
                  options={[
                    { value: "LOW", label: "Less than 80%" },
                    { value: "HIGH", label: "80% or more" },
                  ]}
                />
                <NumberField
                  label="Business kilometres this year"
                  hint="For a rough logbook deduction estimate."
                  value={form.travelKm}
                  onChange={(v) => set("travelKm", v)}
                />
                <SubHeading>Other jobs</SubHeading>
                <Checkbox
                  label="I had more than one employer this tax year"
                  checked={form.hasSecondEmployer}
                  onChange={(v) => set("hasSecondEmployer", v)}
                />
                {form.hasSecondEmployer && (
                  <MoneyField
                    label="Gross pay from the other job this year"
                    value={form.secondEmployer}
                    onChange={(v) => set("secondEmployer", v)}
                    optional
                  />
                )}
              </div>
            )}
          </Card>
        </section>

        <section aria-label="Results" className="flex min-w-0 flex-col gap-6">
          <div role="tablist" aria-label="Workbench view" className="flex gap-1.5">
            {VIEWS.map((v) => (
              <button
                key={v.id}
                type="button"
                role="tab"
                id={`view-${v.id}`}
                aria-selected={view === v.id}
                aria-controls="view-panel"
                onClick={() => setView(v.id)}
                className="rounded-full border border-slate-200 bg-white px-4 py-1.5 text-sm font-medium text-slate-700 hover:border-brand-600 focus-visible:outline-2 focus-visible:outline-brand-600 aria-selected:border-brand-600 aria-selected:bg-brand-50 aria-selected:text-brand-900"
              >
                {v.label}
              </button>
            ))}
          </div>
          <div id="view-panel" role="tabpanel" aria-labelledby={`view-${view}`} className="flex min-w-0 flex-col gap-6">
            {view === "compare" && (
              <CompareYears
                first={RULE_SETS[0]!}
                second={RULE_SETS[RULE_SETS.length - 1]!}
                firstResult={byYear[0]!}
                secondResult={byYear[byYear.length - 1]!}
              />
            )}
            {view === "parameters" && <ParametersView rules={rules} />}
            {view === "results" && (
              <>
              <Headline result={result} />
              <ComparisonCard result={result} />
              <CashFlow result={result} />
              <TaxWorking result={result} />
              <FilingCard result={result} />
              <div className="grid gap-6 xl:grid-cols-2">
                <RetirementCard result={result} />
                <MedicalCard result={result} />
                <ExtrasCard result={result} />
              </div>
              <BracketTable result={result} />
              <Flags result={result} />
              <Provenance result={result} />
              </>
            )}
          </div>
        </section>
      </main>
    </div>
    </RulesContext.Provider>
  );
}
