import { ChoiceCards, type Choice } from "../../components/forms/ChoiceCards.tsx";
import { CurrencyField } from "../../components/forms/CurrencyField.tsx";
import { copy } from "../../content/strings.ts";
import { formatPercent, formatRand } from "../../lib/format.ts";
import type { RetirementAnswers } from "../answers.ts";
import { previewResult } from "../WizardContext.tsx";
import { InlineNote, type StepViewProps, StepHeading } from "./shared.tsx";
import { rulesFor } from "../../lib/years.ts";

const t = copy.wizard.retirement;

const OPTIONS: Choice<"YES" | "NO">[] = [
  { value: "YES", ...t.yes },
  { value: "NO", ...t.no },
];

const negative = (v: number | null) => (v !== null && v < 0 ? t.negative : null);

/** Step 3: pension, provident fund or retirement annuity. */
export function RetirementStep({ answers, update }: StepViewProps) {
  const r = answers.retirement;
  const set = (patch: Partial<RetirementAnswers>) => update({ retirement: { ...r, ...patch } });

  const result = previewResult(answers);
  const rules = rulesFor(answers.taxYear);
  const ret = result?.retirement;
  const hasAmount = ![r.payslipMonthly, r.raMonthly, r.employerContributes ? r.employerMonthly : null].every(
    (v) => v === null || v === 0,
  );

  return (
    <>
      <StepHeading sub={t.sub}>{t.question}</StepHeading>
      <ChoiceCards
        legend={t.question}
        name="has-retirement"
        value={r.has === null ? null : r.has ? "YES" : "NO"}
        onChange={(v) => set({ has: v === "YES" })}
        options={OPTIONS}
      />

      {r.has && (
        <div className="mt-6 space-y-5 border-t border-ink-100 pt-6">
          <CurrencyField
            label={t.payslipLabel}
            hint={t.payslipHint}
            error={negative(r.payslipMonthly)}
            value={r.payslipMonthly}
            onChange={(v) => set({ payslipMonthly: v })}
          />
          <CurrencyField
            label={t.raLabel}
            hint={t.raHint}
            error={negative(r.raMonthly)}
            value={r.raMonthly}
            onChange={(v) => set({ raMonthly: v })}
          />

          <div>
            <label className="flex cursor-pointer items-center gap-2.5 text-[15px] font-medium text-ink-800">
              <input
                type="checkbox"
                checked={r.employerContributes}
                onChange={(e) => set({ employerContributes: e.target.checked })}
                className="h-5 w-5 accent-brand-700"
              />
              {t.employerToggle}
            </label>
            {r.employerContributes && (
              <div className="mt-4">
                <CurrencyField
                  label={t.employerLabel}
                  hint={t.employerHint}
                  error={negative(r.employerMonthly)}
                  value={r.employerMonthly}
                  onChange={(v) => set({ employerMonthly: v })}
                />
              </div>
            )}
          </div>

          {!hasAmount && <InlineNote>{t.needAmount}</InlineNote>}

          {ret && ret.ownPercentOfGross > 0 && (
            <p className="money text-sm font-medium text-brand-800">
              {t.percent(formatPercent(ret.ownPercentOfGross / 100), result?.mode === "TAKE_HOME")}
            </p>
          )}
          {result?.warnings.includes("DEDUCTIONS_EXCEED_GROSS") && <InlineNote tone="warn">{t.tooMuch}</InlineNote>}
          {ret && ret.carryForwardAnnual > 0 && (
            <InlineNote>
              {t.carryForward(
                formatRand(ret.carryForwardAnnual, { decimals: 0 }),
                formatPercent(rules.retirement11F.rate),
                formatRand(rules.retirement11F.annualCap, { decimals: 0 }),
              )}
            </InlineNote>
          )}
          {result?.notes.includes("PRIVATE_RA_CLAIMED_ON_FILING") && <InlineNote>{t.debitNote}</InlineNote>}
        </div>
      )}
    </>
  );
}
