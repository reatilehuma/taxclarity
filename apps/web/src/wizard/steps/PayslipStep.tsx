import { CurrencyField } from "../../components/forms/CurrencyField.tsx";
import { copy, yearCopy } from "../../content/strings.ts";
import { formatRand } from "../../lib/format.ts";
import { rulesFor } from "../../lib/years.ts";
import { previewResult } from "../WizardContext.tsx";
import { InlineNote, type StepViewProps, StepHeading } from "./shared.tsx";

const t = copy.wizard.payslip;

/**
 * Step 7: what the payslip actually deducted (gross and payslip modes only, D7).
 * PAYE is required in payslip mode and optional otherwise. UIF is optional: if it is left
 * blank we assume the calculated amount and say so.
 */
export function PayslipStep({ answers, update }: StepViewProps) {
  const p = answers.payslip;
  const required = answers.mode === "PAYSLIP";
  const result = previewResult(answers);
  const rules = rulesFor(answers.taxYear);

  const negative = (v: number | null) => (v !== null && v < 0 ? t.negative : null);
  const payeError = negative(p.paye) ?? null;

  return (
    <>
      <StepHeading sub={t.sub}>{t.question}</StepHeading>

      <div className="space-y-5">
        <CurrencyField
          label={t.payeLabel}
          hint={required ? t.payeHintRequired : t.payeHintOptional}
          error={payeError}
          value={p.paye}
          onChange={(v) => update({ payslip: { ...p, paye: v } })}
          optional={!required}
        />
        {required && p.paye === null && <InlineNote>{t.payeRequired}</InlineNote>}
        {result?.warnings.includes("PAYSLIP_PAYE_ABOVE_GROSS") && <InlineNote tone="warn">{t.payeTooHigh}</InlineNote>}

        <CurrencyField
          label={t.uifLabel}
          hint={result ? t.uifHint(formatRand(result.uifPerPeriod)) : undefined}
          error={negative(p.uif)}
          value={p.uif}
          onChange={(v) => update({ payslip: { ...p, uif: v } })}
          optional
        />
        {result?.warnings.includes("PAYSLIP_UIF_ABOVE_MAX") && (
          <InlineNote tone="warn">{yearCopy(rules).uifTooHigh(formatRand(rules.uif.maxMonthlyEmployee))}</InlineNote>
        )}
      </div>
    </>
  );
}
