import type { Explanation, Recommendation } from "@taxclarity/tax-engine";
import { Icon } from "../components/Icon.tsx";
import { copy } from "../content/strings.ts";
import { formatPercent, formatRand } from "../lib/format.ts";

const t = copy.results;
const R = (n: number) => formatRand(n);
const R0 = (n: number) => formatRand(n, { decimals: 0 });

/**
 * What each explanation says and what it was worth. All numbers come from the engine's
 * explanation; this only chooses the words and the formatting.
 */
function describeExplanation(e: Explanation): { title: string; paragraphs: string[]; effect?: number } {
  const x = t.explain;
  switch (e.id) {
    case "RETIREMENT":
      return {
        title: x.RETIREMENT.title,
        paragraphs: [
          x.RETIREMENT.body({
            contributed: R(e.contributedMonthly),
            savingMonthly: R(e.savingMonthly),
            savingAnnual: R(e.savingAnnual),
            rate: e.marginalRate > 0 ? formatPercent(e.marginalRate) : null,
            saves: e.savingAnnual > 0,
            cap: R0(e.annualCap),
          }),
          ...(e.carryForwardAnnual > 0 ? [x.RETIREMENT.carry(R(e.carryForwardAnnual))] : []),
        ],
        effect: e.savingAnnual,
      };
    case "MEDICAL_CREDIT":
      return {
        title: x.MEDICAL_CREDIT.title,
        paragraphs: [
          x.MEDICAL_CREDIT.body({
            monthly: R(e.monthlyCredit),
            main: R(e.mainMonthly),
            first: R(e.firstDependantMonthly),
            extra: R(e.additionalMonthly),
            members: e.members,
          }),
          ...(e.unusedAnnual > 0 ? [x.MEDICAL_CREDIT.unused(R(e.unusedAnnual))] : []),
          ...(e.claimedOnFiling ? [x.MEDICAL_CREDIT.filing] : []),
        ],
        effect: e.appliedAnnual,
      };
    case "AGE_REBATE":
      return {
        title: x.AGE_REBATE.title,
        paragraphs: [
          x.AGE_REBATE.body({
            secondary: R(e.secondary),
            tertiary: e.tertiary > 0 ? R(e.tertiary) : null,
            saving: R(e.savingAnnual),
          }),
        ],
        effect: e.savingAnnual,
      };
    case "DONATIONS":
      return {
        title: x.DONATIONS.title,
        paragraphs: [
          x.DONATIONS.body({ given: R(e.givenAnnual), saving: R(e.savingAnnual) }),
          ...(e.carryForwardAnnual > 0 ? [x.DONATIONS.carry(R(e.carryForwardAnnual))] : []),
          ...(e.hasReceipt ? [] : [x.DONATIONS.receipt]),
        ],
        effect: e.savingAnnual,
      };
    case "VARIABLE_PAY":
      return {
        title: x.VARIABLE_PAY.title,
        paragraphs: [
          x.VARIABLE_PAY.body({
            total: R(e.totalAnnual),
            tax: R(e.taxAnnual),
            share: formatPercent(e.effectiveRate),
            rate: e.marginalRate > 0 ? formatPercent(e.marginalRate) : null,
          }),
        ],
      };
    case "UIF":
      return { title: x.UIF.title, paragraphs: [x.UIF.body({ max: R(e.maxMonthly), monthly: R(e.monthly), annual: R(e.annual) })] };
    case "TRAVEL":
      return {
        title: x.TRAVEL.title,
        paragraphs: [
          x.TRAVEL.body({ allowance: R(e.allowanceAnnual), share: formatPercent(e.taxableRate), taxable: R(e.taxableAnnual) }),
          ...(e.possibleDeductionAnnual > 0 ? [x.TRAVEL.logbook(R(e.possibleDeductionAnnual))] : []),
        ],
      };
    case "INTEREST":
      return {
        title: x.INTEREST.title,
        paragraphs: [
          x.INTEREST.body({
            interest: R(e.interestAnnual),
            exemption: R(e.exemptionAnnual),
            taxable: R(e.taxableAnnual),
            none: e.taxableAnnual === 0,
          }),
        ],
      };
    case "MEDICAL_6B":
      return {
        title: x.MEDICAL_6B.title,
        paragraphs: [x.MEDICAL_6B.body({ costs: R(e.outOfPocketAnnual), credit: R(e.appliedAnnual) })],
        effect: e.appliedAnnual,
      };
  }
}

/** "How your answers shaped your tax" (PRD §14.5). */
export function ExplanationCards({ items }: { items: Explanation[] }) {
  return (
    <ul className="space-y-3">
      {items.map((e) => {
        const d = describeExplanation(e);
        return (
          <li key={e.id} data-explanation={e.id} className="rounded-2xl bg-surface p-4 ring-1 ring-ink-200 sm:p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <h3 className="text-base font-bold text-ink-950">{d.title}</h3>
              {d.effect !== undefined && d.effect > 0 && (
                <p className="rounded-full bg-brand-50 px-3 py-1 text-sm font-semibold text-brand-800">
                  {t.effectLabel} <span className="money">{R(d.effect)}</span> {t.perYear}
                </p>
              )}
            </div>
            <div className="mt-2 space-y-2 text-[15px] leading-relaxed text-ink-700">
              {d.paragraphs.map((p) => (
                <p key={p}>{p}</p>
              ))}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function describeAdvice(r: Recommendation): { title: string; body: string } {
  const a = t.advice;
  switch (r.id) {
    case "R1":
      return {
        title: a.R1.title,
        body: a.R1.body({ room: R0(r.roomAnnual), extra: R0(r.extraMonthly), monthly: R(r.monthlySaving), annual: R(r.annualSaving) }),
      };
    case "R2":
      return {
        title: a.R2.title,
        body: a.R2.body({ extra: R0(r.extraMonthly), monthly: R(r.monthlySaving), annual: R(r.annualSaving), room: R0(r.roomAnnual) }),
      };
    case "R3":
      return { title: a.R3.title, body: a.R3.body({ credit: R(r.monthlyCredit), filing: r.claimedOnFiling }) };
    case "R4":
      return {
        title: a.R4.title,
        body: a.R4.body({ credit: R(r.monthlyCredit), usable: r.usableMonthly < r.monthlyCredit ? R(r.usableMonthly) : null }),
      };
    case "R5":
      return {
        title: a.R5.title,
        body: a.R5.body({ rate: formatPercent(r.limitRate), example: R0(r.exampleAnnual), saving: R(r.annualSaving) }),
      };
    case "R6":
      return {
        title: a.R6.title,
        body: a.R6.body({ exempt: R0(r.exemptionAnnual), exempt65: R0(r.exemptionAge65), annual: R0(r.tfsaAnnual), lifetime: R0(r.tfsaLifetime) }),
      };
    case "R7":
      return { title: a.R7.title, body: a.R7.body({ annual: R0(r.tfsaAnnual), lifetime: R0(r.tfsaLifetime) }) };
    case "R8":
      return { title: a.R8.title, body: a.R8.body() };
    case "R9":
      return { title: a.R9.title, body: a.R9.body({ cents: r.centsPerRand }) };
  }
}

/** "Ways to keep more of your pay" (PRD §14.6). */
export function Recommendations({ items }: { items: Recommendation[] }) {
  return (
    <>
      <ul className="space-y-3">
        {items.map((r) => {
          const d = describeAdvice(r);
          return (
            <li key={r.id} data-recommendation={r.id} className="flex gap-3 rounded-2xl bg-surface p-4 ring-1 ring-ink-200 sm:p-5">
              <Icon name="spark" className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" />
              <div className="min-w-0">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <h3 className="text-base font-bold text-ink-950">{d.title}</h3>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      r.confidence === "CALCULATED"
                        ? "bg-accurate-bg text-accurate-fg"
                        : r.confidence === "ESTIMATED"
                          ? "bg-estimate-bg text-estimate-fg"
                          : "bg-ink-100 text-ink-700"
                    }`}
                  >
                    {t.confidence[r.confidence]}
                  </span>
                </div>
                <p className="mt-1.5 text-[15px] leading-relaxed text-ink-700">{d.body}</p>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="mt-4 text-sm text-ink-500">{t.adviceDisclaimer}</p>
    </>
  );
}
