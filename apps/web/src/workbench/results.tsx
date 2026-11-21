import {
  type CalculationResult,
  type FlagCode,
  type NoteCode,
  type PayFrequency,
  type TaxRuleSet,
  type WarningCode,
} from "@taxclarity/tax-engine";
import { formatDate, formatPercent, formatRand } from "../lib/format.ts";
import { SOURCES } from "../lib/sources.ts";
import { Card } from "./inputs.tsx";
import { useRules } from "./rulesContext.ts";

/**
 * Workbench result views. Every number shown comes straight from the engine result;
 * these components only choose what to show and format it.
 */

export const PERIOD_NOUN: Record<PayFrequency, string> = { MONTHLY: "month", FORTNIGHTLY: "fortnight", WEEKLY: "week" };

const NOTE_TEXT: Record<NoteCode, string> = {
  ESTIMATED_FROM_TAKE_HOME: "Gross salary is estimated from your bank deposit. Your payslip will show the exact figure.",
  VARIABLE_PAY_BALANCE_METHOD:
    "Tax on extras uses SARS's balance-of-remuneration method. Your payroll may use another allowed method, so single months can differ; it evens out when you file.",
  UIF_ON_AVERAGED_VARIABLE_PAY: "UIF on extras is averaged over the year rather than worked out in the month they're paid.",
  MEDICAL_CREDIT_CLAIMED_ON_FILING:
    "Your medical aid is paid by debit order, so payroll usually doesn't apply the medical credit. You get it back when you file.",
  PRIVATE_RA_CLAIMED_ON_FILING:
    "Your retirement annuity is paid by debit order, so payroll doesn't deduct it. The tax saving comes back when you file.",
  MEDICAL_6B_INCLUDES_EMPLOYER_CONTRIBUTIONS:
    "The extra medical credit counts your employer's share of the medical aid as paid by you, as SARS does. This is a simplification.",
  SECOND_EMPLOYER_PAYE_ESTIMATED:
    "Tax from your other job is estimated as if it were your only income. Check that payslip for the real figure.",
  PAYSLIP_UIF_ASSUMED: "You didn't enter UIF from your payslip, so we've assumed the calculated amount. Check your payslip.",
};

function warningText(code: WarningCode, rules: TaxRuleSet): string {
  switch (code) {
    case "DEDUCTIONS_EXCEED_GROSS":
      return "Your deductions are more than your salary, so take-home comes out negative. Check the contribution amounts.";
    case "VARIABLE_PAY_HIGH":
      return "That's a lot of your income from extras, so this estimate will be rougher.";
    case "PAYSLIP_UIF_ABOVE_MAX":
      return `UIF above ${formatRand(rules.uif.maxMonthlyEmployee)} a month isn't possible under ${rules.label} rules. Check the figure on your payslip.`;
    case "PAYSLIP_PAYE_ABOVE_GROSS":
      return "The PAYE you entered is more than your gross salary. Check the figure on your payslip.";
  }
}

export const FLAG_TEXT: Record<FlagCode, string> = {
  OTHER_INCOME_NOT_INCLUDED:
    "Extra income not on a payslip (freelance, rentals, crypto) is taxed too and can change your result.",
  CAPITAL_GAINS_NOT_INCLUDED: "Investments sold at a profit may add capital gains tax to your final tax.",
  FOREIGN_INCOME_OR_RESIDENCY: "If you worked abroad or are a non-resident, different rules may apply.",
  FRINGE_BENEFITS_NOT_MODELLED: "Some benefits (like a company car) are taxable and aren't included here.",
  HOME_OFFICE_NOT_MODELLED: "Home office expenses can sometimes be claimed, but aren't included here.",
  SDL_COIDA_EMPLOYER_ONLY: "SDL and COIDA are employer costs. They must never be deducted from your pay.",
  RETIREMENT_LUMP_SUMS_NOT_CALCULATED:
    "Retirement lump sums, two-pot withdrawals and severance pay are taxed separately and aren't calculated here.",
  COMMISSION_EARNER_DEDUCTIONS:
    "More than half your pay is commission, so you may be able to claim work expenses when you file. They aren't included here.",
  DONATIONS_TAX_LARGE_GIFTS:
    "Gifts above R150 000 a year to people or organisations that aren't exempt can attract donations tax.",
  DONATION_RECEIPT_NEEDED:
    "SARS only allows the donation deduction with a valid Section 18A receipt. This result assumes you'll get one.",
  MULTIPLE_EMPLOYERS:
    "Each employer taxes you separately. Together you can land in a higher bracket and owe SARS when you file. A tax directive (IRP3(q)) can fix the monthly deduction.",
  BELOW_THRESHOLD_MAY_NOT_NEED_TO_FILE:
    "Your income is below the SARS tax-free threshold. You may not need to file a return unless SARS asks, or you're owed a refund.",
  TRAVEL_LOGBOOK_REQUIRED: "To claim business travel against your allowance, you need a logbook.",
  DIVIDENDS_NOT_INCLUDED: "Dividends are taxed at 20% before you receive them, and aren't included here.",
  MEDICAL_6B_POSSIBLE:
    "You may get an extra medical credit for costs your medical aid didn't cover. Add your out-of-pocket costs to see.",
};

// ---------------------------------------------------------------------------
// Shared bits
// ---------------------------------------------------------------------------

function Note({ tone, children }: { tone: "info" | "warn"; children: React.ReactNode }) {
  const cls = tone === "info" ? "bg-brand-50 text-brand-900" : "bg-amber-50 text-amber-900";
  return <p className={`mt-4 rounded-lg px-4 py-3 text-sm ${cls}`}>{children}</p>;
}

function Stat({ label, value, emphasis }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className={`money mt-1 font-semibold ${emphasis ? "text-xl text-brand-700" : "text-lg text-slate-900"}`}>
        {value}
      </dd>
    </div>
  );
}

function DetailList({ items }: { items: (readonly [string, string] | false)[] }) {
  return (
    <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 text-sm">
      {items
        .filter((i): i is readonly [string, string] => i !== false)
        .map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-slate-600">{k}</dt>
            <dd className="money text-right font-medium text-slate-900">{v}</dd>
          </div>
        ))}
    </dl>
  );
}

interface Row {
  label: string;
  values: (number | null)[];
  sign?: "+" | "−" | "=";
  hidden?: boolean;
}

function MoneyTable({ title, note, columns, rows }: { title: string; note?: string; columns: string[]; rows: Row[] }) {
  return (
    <Card>
      <h2 className="mb-3 text-base font-semibold text-slate-900">{title}</h2>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
              <th scope="col" className="py-2 font-medium">
                Line
              </th>
              {columns.map((c) => (
                <th key={c} scope="col" className="py-2 pl-3 text-right font-medium">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows
              .filter((r) => !r.hidden)
              .map((row) => {
                const total = row.sign === "=";
                const sign = row.sign && row.sign !== "=" ? `${row.sign} ` : "";
                return (
                  <tr
                    key={row.label}
                    className={total ? "border-t-2 border-slate-300 font-semibold text-slate-900" : "border-b border-slate-100"}
                  >
                    <th scope="row" className="py-2 text-left font-normal">
                      {total ? <strong>{row.label}</strong> : row.label}
                    </th>
                    {row.values.map((v, i) => (
                      <td key={columns[i]} className="money py-2 pl-3 text-right">
                        {v === null ? <span className="text-slate-300">—</span> : `${sign}${formatRand(v)}`}
                      </td>
                    ))}
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
      {note && <p className="mt-3 text-xs text-slate-500">{note}</p>}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

export function Headline({ result: r }: { result: CalculationResult }) {
  const rules = useRules();
  const notMonthly = r.payFrequency !== "MONTHLY";
  const hasExtras = r.variablePay.totalAnnual > 0;
  const estimate = r.confidence === "ESTIMATE";
  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${estimate ? "bg-amber-100 text-amber-900" : "bg-emerald-100 text-emerald-900"}`}
        >
          <span aria-hidden="true">{estimate ? "≈" : "✓"}</span>
          {estimate ? "Estimate" : "Payslip-accurate"}
        </span>
        {r.estimate && r.estimate.method !== "NONE" && (
          <span className="text-xs text-slate-500">
            Solved in {r.estimate.iterations} steps ({r.estimate.method === "FIXED_POINT" ? "fixed point" : "bisection"}),
            off by <span className="money">{formatRand(Math.abs(r.estimate.residual))}</span>
          </span>
        )}
      </div>

      {r.comparison ? (
        <p className="text-slate-700">
          Your employer deducted <strong className="money text-slate-900">{formatRand(r.comparison.payslipPaye)}</strong>;
          based on the SARS {rules.label} rules, our calculation gives{" "}
          <strong className="money text-slate-900">{formatRand(r.comparison.calcPaye)}</strong>.
        </p>
      ) : (
        <p className="text-slate-700">
          Your estimated monthly PAYE is <strong className="money text-slate-900">{formatRand(r.monthlyPaye)}</strong>,
          and your take-home salary is <strong className="money text-slate-900">{formatRand(r.takeHomeMonthly)}</strong>.
        </p>
      )}
      {estimate && (
        <p className="mt-2 text-sm text-slate-600">
          Estimated gross salary: <strong className="money text-slate-900">{formatRand(r.grossPerPeriod)}</strong> per{" "}
          {PERIOD_NOUN[r.payFrequency]}.
        </p>
      )}
      {notMonthly && (
        <p className="mt-2 text-sm text-slate-600">
          You're paid {r.payFrequency === "WEEKLY" ? "weekly" : "every two weeks"}: that's{" "}
          <span className="money font-medium">{formatRand(r.takeHomePerPeriod)}</span> take-home per{" "}
          {PERIOD_NOUN[r.payFrequency]}, from <span className="money">{formatRand(r.grossPerPeriod)}</span> gross. Monthly
          figures are the equivalent (× {r.periodsPerYear} ÷ 12).
        </p>
      )}

      <dl className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="A normal month" value={formatRand(r.takeHomeMonthly)} emphasis />
        {hasExtras ? (
          <Stat label="Averaged over the year (incl. extras)" value={formatRand(r.takeHomeMonthlyAverage)} />
        ) : (
          <Stat label="PAYE / month" value={formatRand(r.monthlyPaye)} />
        )}
        <Stat label="Marginal rate" value={formatPercent(r.marginalRate)} />
        <Stat label="Effective rate" value={formatPercent(r.effectiveRate)} />
      </dl>

      {r.belowThreshold && (
        <Note tone="info">
          Taxable income is at or below the SARS tax-free threshold for this age group (
          <span className="money">{formatRand(r.taxThreshold, { decimals: 0 })}</span> a year), so no income tax is due.
          UIF still applies.
        </Note>
      )}
      {!r.belowThreshold && r.annualLiability === 0 && r.medical6A.unusedAnnual > 0 && (
        <Note tone="info">
          Medical credits have brought tax to R0. Credits can't create a refund by themselves, so{" "}
          <span className="money">{formatRand(r.medical6A.unusedAnnual)}</span> goes unused.
        </Note>
      )}
      {r.warnings.map((w) => (
        <Note key={w} tone="warn">
          {warningText(w, rules)}
        </Note>
      ))}
      {r.notes.length > 0 && (
        <ul className="mt-4 space-y-1.5 text-xs text-slate-500">
          {r.notes.map((n) => (
            <li key={n} className="flex gap-2">
              <span aria-hidden="true">ⓘ</span>
              {NOTE_TEXT[n]}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function ComparisonCard({ result: r }: { result: CalculationResult }) {
  const c = r.comparison;
  if (!c) return null;
  return (
    <Card>
      <h2 className="mb-3 text-base font-semibold text-slate-900">Your payslip vs our calculation</h2>
      <DetailList
        items={[
          ["PAYE on your payslip", formatRand(c.payslipPaye)],
          ["PAYE we calculate for a normal month", formatRand(c.calcPaye)],
          [
            "Difference",
            `${c.diff > 0 ? "+" : ""}${formatRand(c.diff)}${c.diffPct === null ? "" : ` (${c.diffPct > 0 ? "+" : ""}${formatPercent(c.diffPct / 100)})`}`,
          ],
          ["UIF on your payslip", `${formatRand(c.payslipUif)}${c.uifAssumed ? " (assumed)" : ""}`],
          ["UIF we calculate", formatRand(c.calcUif)],
        ]}
      />
      {c.closeMatch ? (
        <Note tone="info">These match to within R1. Your payroll is applying the same rules.</Note>
      ) : (
        <p className="mt-4 rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-700">
          A difference doesn't automatically mean your employer made a mistake, and it doesn't guarantee a SARS refund.
          Common reasons: your employer uses a different SARS-allowed payroll method, the month you checked included a
          bonus or back-pay, you have other income, or your payroll applied credits differently. If you're unsure, compare
          a February payslip (no bonus) or ask your payroll team.
        </p>
      )}
    </Card>
  );
}

export function CashFlow({ result: r }: { result: CalculationResult }) {
  const hasExtras = r.variablePay.totalAnnual > 0;
  const payroll = r.ownMedicalPaidVia === "PAYROLL";
  const columns = hasExtras ? ["Normal month", "Average month", "Year"] : ["Monthly", "Annual"];
  const v = (normal: number | null, average: number | null, year: number | null) =>
    hasExtras ? [normal, average, year] : [normal, year];
  const separately = [
    !payroll && r.ownMedicalAnnual > 0 ? `medical aid (${formatRand(r.ownMedicalMonthly)} a month)` : "",
    r.privateRaAnnual > 0 ? `retirement annuity (${formatRand(r.privateRaMonthly)} a month)` : "",
  ].filter(Boolean);

  return (
    <MoneyTable
      title="From salary to bank account"
      columns={columns}
      note={[
        "Employer contributions aren't paid to you in cash, so they don't appear here.",
        separately.length ? `Paid separately by debit order: ${separately.join(" and ")}.` : "",
      ]
        .filter(Boolean)
        .join(" ")}
      rows={[
        { label: "Gross salary", values: v(r.grossMonthly, r.grossMonthly, r.grossAnnual) },
        {
          label: "Travel allowance",
          values: v(r.travel.allowanceMonthly, r.travel.allowanceMonthly, r.travel.allowanceAnnual),
          sign: "+",
          hidden: r.travel.allowanceAnnual === 0,
        },
        {
          label: "Bonus, overtime, commission",
          values: v(null, r.variablePay.monthlyAverage, r.variablePay.totalAnnual),
          sign: "+",
          hidden: !hasExtras,
        },
        {
          label: "Your retirement contribution",
          values: v(r.ownRetirementMonthly, r.ownRetirementMonthly, r.ownRetirementAnnual),
          sign: "−",
          hidden: r.ownRetirementAnnual === 0,
        },
        {
          label: "Your medical aid share",
          values: v(r.ownMedicalMonthly, r.ownMedicalMonthly, r.ownMedicalAnnual),
          sign: "−",
          hidden: r.ownMedicalAnnual === 0 || !payroll,
        },
        { label: "PAYE (income tax)", values: v(r.monthlyPaye, r.monthlyPayeAverage, r.annualPaye), sign: "−" },
        { label: "UIF (employee 1%)", values: v(r.uifMonthly, r.uifMonthlyAverage, r.uifAnnual), sign: "−" },
        { label: "Take-home pay", values: v(r.takeHomeMonthly, r.takeHomeMonthlyAverage, r.takeHomeAnnual), sign: "=" },
      ]}
    />
  );
}

export function TaxWorking({ result: r }: { result: CalculationResult }) {
  const vp = r.variablePay;
  return (
    <MoneyTable
      title="How your tax for the year is worked out"
      columns={["Annual"]}
      note="Tax after rebates and credits can't go below R0."
      rows={[
        { label: "Gross salary", values: [r.grossAnnual] },
        { label: "Bonus", values: [vp.bonusAnnual], sign: "+", hidden: !vp.bonusAnnual },
        { label: "Overtime", values: [vp.overtimeAnnual], sign: "+", hidden: !vp.overtimeAnnual },
        { label: "Commission", values: [vp.commissionAnnual], sign: "+", hidden: !vp.commissionAnnual },
        {
          label: "Employer retirement contribution (taxable benefit)",
          values: [r.employerRetirementAnnual],
          sign: "+",
          hidden: r.employerRetirementAnnual === 0,
        },
        {
          label: "Employer medical contribution (taxable benefit)",
          values: [r.employerMedicalAnnual],
          sign: "+",
          hidden: r.employerMedicalAnnual === 0,
        },
        {
          label: `Travel allowance (taxable ${formatPercent(r.travel.taxableRate)})`,
          values: [r.travel.taxableAnnual],
          sign: "+",
          hidden: r.travel.taxableAnnual === 0,
        },
        { label: "Interest above the exemption", values: [r.interest.taxableAnnual], sign: "+", hidden: !r.interest.taxableAnnual },
        { label: "Income from your other job", values: [r.secondEmployer.grossAnnual], sign: "+", hidden: !r.secondEmployer.grossAnnual },
        {
          label: "Retirement deduction (Section 11F)",
          values: [r.retirement.deductionAnnual],
          sign: "−",
          hidden: r.retirement.deductionAnnual === 0,
        },
        {
          label: "Donations (Section 18A)",
          values: [r.donations.deductionAnnual],
          sign: "−",
          hidden: r.donations.deductionAnnual === 0,
        },
        { label: "Taxable income", values: [r.taxableIncome], sign: "=" },
        { label: "Tax before rebates", values: [r.annualTaxBeforeRebates] },
        { label: "Primary rebate", values: [r.rebates.primary], sign: "−" },
        { label: "Secondary rebate (65+)", values: [r.rebates.secondary], sign: "−", hidden: !r.rebates.secondary },
        { label: "Tertiary rebate (75+)", values: [r.rebates.tertiary], sign: "−", hidden: !r.rebates.tertiary },
        {
          label: "Medical scheme credit (Section 6A)",
          values: [r.medical6A.appliedAnnual],
          sign: "−",
          hidden: r.medical6A.annualCredit === 0,
        },
        {
          label: "Additional medical credit (Section 6B)",
          values: [r.medical6B.appliedAnnual],
          sign: "−",
          hidden: r.medical6B.appliedAnnual === 0,
        },
        { label: "Tax for the year", values: [r.annualLiability], sign: "=" },
      ]}
    />
  );
}

export function FilingCard({ result: r }: { result: CalculationResult }) {
  const f = r.filing;
  const vp = r.variablePay;
  return (
    <Card>
      <h2 className="mb-3 text-base font-semibold text-slate-900">How the year's tax gets paid</h2>
      <DetailList
        items={[
          ["Tax for the year", formatRand(r.annualLiability)],
          ["PAYE on your regular pay", formatRand(r.annualPayeRegular)],
          vp.totalAnnual > 0 && ["PAYE on your extras", formatRand(vp.taxAnnual)],
          r.secondEmployer.grossAnnual > 0 && ["PAYE from your other job (estimate)", formatRand(r.secondEmployer.estimatedPayeAnnual)],
        ]}
      />
      {f.refundAnnual > 0 && (
        <Note tone="info">
          About <strong className="money">{formatRand(f.refundAnnual)}</strong> should come back to you when you file, because
          payroll didn't know about everything that lowers your tax.
        </Note>
      )}
      {f.owedAnnual > 0 && (
        <Note tone="warn">
          You could owe SARS about <strong className="money">{formatRand(f.owedAnnual)}</strong> when you file, because
          payroll didn't know about all your income.
        </Note>
      )}
      {f.balanceAnnual === 0 && <p className="mt-3 text-xs text-slate-500">Payroll covers the year's tax exactly.</p>}
    </Card>
  );
}

export function RetirementCard({ result: r }: { result: CalculationResult }) {
  const rules = useRules();
  const ret = r.retirement;
  if (ret.poolAnnual === 0) return null;
  return (
    <Card>
      <h2 className="mb-3 text-base font-semibold text-slate-900">Retirement deduction (Section 11F)</h2>
      <DetailList
        items={[
          r.ownRetirementAnnual > 0 && ["Your contributions via payroll", formatRand(r.ownRetirementAnnual)],
          r.privateRaAnnual > 0 && ["Your RA by debit order", formatRand(r.privateRaAnnual)],
          r.employerRetirementAnnual > 0 && ["Employer contributions", formatRand(r.employerRetirementAnnual)],
          ["Total this year", formatRand(ret.poolAnnual)],
          ["27,5% of your income", formatRand(ret.percentageLimitAnnual)],
          ["Annual cap", formatRand(rules.retirement11F.annualCap)],
          ["Limit applied", `${formatRand(ret.limitAnnual)}${ret.capApplied ? " (cap)" : ""}`],
          ["Deducted this year", formatRand(ret.deductionAnnual)],
        ]}
      />
      {ret.carryForwardAnnual > 0 && (
        <Note tone="info">
          <span className="money">{formatRand(ret.carryForwardAnnual)}</span> is above the limit. It isn't lost: SARS
          carries it forward to next year, and any amount still unused at retirement reduces tax on your payout.
        </Note>
      )}
    </Card>
  );
}

export function MedicalCard({ result: r }: { result: CalculationResult }) {
  const rules = useRules();
  const m = r.medical6A;
  const b = r.medical6B;
  if (m.annualCredit === 0 && b.status === "NOT_PROVIDED") return null;
  const { monthlyMain, monthlyFirstDep, monthlyAdditionalDep } = rules.medical6A;
  return (
    <Card>
      <h2 className="mb-3 text-base font-semibold text-slate-900">Medical credits</h2>
      {m.annualCredit > 0 && (
        <>
          <h3 className="mb-2 text-sm font-medium text-slate-700">Medical scheme credit (Section 6A)</h3>
          <DetailList
            items={[
              ["You (main member)", formatRand(monthlyMain)],
              m.members >= 2 && ["First dependant", formatRand(monthlyFirstDep)],
              m.members >= 3 && [
                `${m.members - 2} more × ${formatRand(monthlyAdditionalDep)}`,
                formatRand(m.additionalDependantsMonthly),
              ],
              ["Credit per month", formatRand(m.monthlyCredit)],
              [`× ${m.monthsCovered} month${m.monthsCovered === 1 ? "" : "s"}`, formatRand(m.annualCredit)],
              ["Used against your tax", formatRand(m.appliedAnnual)],
            ]}
          />
        </>
      )}
      {b.status === "CALCULATED" && (
        <>
          <h3 className="mt-4 mb-2 text-sm font-medium text-slate-700">
            Additional medical credit (Section 6B, {b.branch === "UNDER_65" ? "25% branch" : "33,3% branch"})
          </h3>
          <DetailList
            items={[
              ["Scheme contributions this year", formatRand(b.contributionsAnnual)],
              ["Costs the scheme didn't cover", formatRand(b.outOfPocketAnnual)],
              ["Credit", formatRand(b.annualCredit)],
              ["Used against your tax", formatRand(b.appliedAnnual)],
            ]}
          />
        </>
      )}
      <p className="mt-3 text-xs text-slate-500">Credits come off your tax, not your income.</p>
    </Card>
  );
}

export function ExtrasCard({ result: r }: { result: CalculationResult }) {
  const rules = useRules();
  const d = r.donations;
  const i = r.interest;
  const t = r.travel;
  if (d.givenAnnual === 0 && i.localAnnual === 0 && t.allowanceAnnual === 0) return null;
  return (
    <Card>
      <h2 className="mb-3 text-base font-semibold text-slate-900">Optional extras</h2>
      <DetailList
        items={[
          d.givenAnnual > 0 && ["Donations given", formatRand(d.givenAnnual)],
          d.givenAnnual > 0 && ["10% limit", formatRand(d.capAnnual)],
          d.givenAnnual > 0 && ["Deducted", formatRand(d.deductionAnnual)],
          d.carryForwardAnnual > 0 && ["Carried to next year", formatRand(d.carryForwardAnnual)],
          i.localAnnual > 0 && ["Interest earned", formatRand(i.localAnnual)],
          i.localAnnual > 0 && ["Tax-free portion", formatRand(i.exemptAnnual)],
          i.localAnnual > 0 && ["Taxable interest", formatRand(i.taxableAnnual)],
          t.allowanceAnnual > 0 && ["Travel allowance per month", formatRand(t.allowanceMonthly)],
          t.allowanceAnnual > 0 && [`Taxable portion (${formatPercent(t.taxableRate)})`, formatRand(t.taxableMonthly)],
          t.possibleDeductionAnnual > 0 && ["Possible logbook deduction (estimate)", formatRand(t.possibleDeductionAnnual)],
        ]}
      />
      {t.possibleDeductionAnnual > 0 && (
        <p className="mt-3 text-xs text-slate-500">
          The logbook deduction (business km × R{String(rules.travel.prescribedRatePerKm).replace(".", ",")}) is only an
          estimate and isn't included in your tax above. You can claim it when you file, with a logbook.
        </p>
      )}
    </Card>
  );
}

export function BracketTable({ result: r }: { result: CalculationResult }) {
  const rules = useRules();
  return (
    <Card>
      <h2 className="mb-1 text-base font-semibold text-slate-900">SARS {rules.label} brackets: your working</h2>
      <p className="mb-3 text-xs text-slate-500">
        Each rate applies only to the part of your taxable income inside that bracket.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
              <th scope="col" className="py-2 font-medium">
                Taxable income
              </th>
              <th scope="col" className="py-2 text-right font-medium">
                Rate
              </th>
              <th scope="col" className="py-2 text-right font-medium">
                Your income in bracket
              </th>
              <th scope="col" className="py-2 text-right font-medium">
                Tax on it
              </th>
              <th scope="col" className="py-2 text-right font-medium">
                Running total
              </th>
            </tr>
          </thead>
          <tbody>
            {r.bracketWalk.map((row) => {
              const used = row.amountInBracket > 0;
              return (
                <tr
                  key={row.index}
                  className={`border-b border-slate-100 ${row.isTopBracket ? "bg-brand-50 font-medium" : ""} ${used || row.isTopBracket ? "text-slate-900" : "text-slate-400"}`}
                >
                  <th scope="row" className="money py-2 text-left font-normal">
                    {formatRand(row.index === 0 ? 0 : row.from + 1, { decimals: 0 })}
                    {row.to === null ? " and above" : ` – ${formatRand(row.to, { decimals: 0 })}`}
                    {row.isTopBracket && (
                      <span className="ml-2 rounded-full bg-brand-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                        Your top bracket
                      </span>
                    )}
                  </th>
                  <td className="money py-2 text-right">{formatPercent(row.rate)}</td>
                  <td className="money py-2 text-right">{formatRand(row.amountInBracket)}</td>
                  <td className="money py-2 text-right">{formatRand(row.taxInBracket)}</td>
                  <td className="money py-2 text-right">{used ? formatRand(row.runningTotal) : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export function Flags({ result: r }: { result: CalculationResult }) {
  return (
    <Card>
      <h2 className="mb-3 text-base font-semibold text-slate-900">Good to know</h2>
      <ul className="space-y-2.5 text-sm text-slate-700">
        {r.flags.map((f) => (
          <li key={f.code} className="flex gap-2.5">
            <span aria-hidden="true" className="text-amber-600">
              ⚠
            </span>
            <span>
              {FLAG_TEXT[f.code]}{" "}
              <a
                href={SOURCES[f.source].url}
                target="_blank"
                rel="noreferrer"
                className="whitespace-nowrap text-brand-700 underline underline-offset-2 hover:text-brand-900"
              >
                {SOURCES[f.source].title}
              </a>
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function Provenance({ result: r }: { result: CalculationResult }) {
  const p = r.provenance;
  const facts: [string, string][] = [
    ["Tax year", p.taxYear.replace("-", "/")],
    ["Rules version", p.rulesVersion],
    ["Status", p.status === "verified" ? "Verified" : "Draft: not signed off"],
    ["Period", `${formatDate(p.period.start)} to ${formatDate(p.period.end)}`],
    ["Last checked", formatDate(p.lastVerifiedAt)],
  ];
  return (
    <Card>
      <h2 className="mb-2 text-base font-semibold text-slate-900">Rules applied</h2>
      <p className="mb-3 text-xs text-slate-500">Every figure above came from this rule set and nothing else.</p>
      <dl className="mb-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
        {facts.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-3 border-b border-slate-100 py-1">
            <dt className="text-slate-500">{label}</dt>
            <dd className={`text-right font-medium ${label === "Status" && p.status !== "verified" ? "text-amber-800" : "text-slate-900"}`}>
              {value}
            </dd>
          </div>
        ))}
      </dl>
      <h3 className="mb-1 text-xs font-semibold text-slate-700">Sources</h3>
      <ul className="mb-3 flex flex-wrap gap-1.5 text-xs">
        {p.sourceIds.map((id) => (
          <li key={id}>
            <a
              href={SOURCES[id].url}
              target="_blank"
              rel="noreferrer noopener"
              title={SOURCES[id].title}
              className="rounded-md bg-brand-50 px-2 py-1 font-mono text-brand-700 underline underline-offset-2"
            >
              {id}
            </a>
          </li>
        ))}
      </ul>
      <h3 className="mb-1 text-xs font-semibold text-slate-700">Steps used</h3>
      <ul className="flex flex-wrap gap-1.5">
        {p.appliedRules.map((rule) => (
          <li key={rule} className="rounded-md bg-slate-100 px-2 py-1 font-mono text-xs text-slate-700">
            {rule}
          </li>
        ))}
      </ul>
    </Card>
  );
}
