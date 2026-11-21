import { ChoiceCards, type Choice } from "../../components/forms/ChoiceCards.tsx";
import { CurrencyField } from "../../components/forms/CurrencyField.tsx";
import { SegmentedControl } from "../../components/forms/SegmentedControl.tsx";
import { Stepper } from "../../components/forms/Stepper.tsx";
import { copy } from "../../content/strings.ts";
import { formatRand } from "../../lib/format.ts";
import { MAX_MEDICAL_MEMBERS, MIN_MEDICAL_MEMBERS, type MedicalAnswers } from "../answers.ts";
import { previewResult } from "../WizardContext.tsx";
import { InlineNote, type StepViewProps, StepHeading } from "./shared.tsx";

const t = copy.wizard.medical;

const OPTIONS: Choice<"YES" | "NO">[] = [
  { value: "YES", ...t.yes },
  { value: "NO", ...t.no },
];

/** Step 4: medical aid. People on the plan, what it costs, who pays, and any costs it didn't cover. */
export function MedicalStep({ answers, update }: StepViewProps) {
  const m = answers.medical;
  const set = (patch: Partial<MedicalAnswers>) => update({ medical: { ...m, ...patch } });

  const result = previewResult(answers);
  const totalError = m.monthlyTotal !== null && m.monthlyTotal < 0 ? t.negative : null;
  const shareError =
    m.employerShare !== null && m.employerShare < 0
      ? t.negative
      : m.employerShare !== null && m.monthlyTotal !== null && m.employerShare > m.monthlyTotal
        ? t.shareTooHigh
        : null;
  const oopError = m.outOfPocketAnnual !== null && m.outOfPocketAnnual < 0 ? t.negative : null;
  const ownSharePaid = m.paidBy !== "EMPLOYER";

  return (
    <>
      <StepHeading sub={t.sub}>{t.question}</StepHeading>
      <ChoiceCards
        legend={t.question}
        name="has-medical"
        value={m.member === null ? null : m.member ? "YES" : "NO"}
        onChange={(v) => set({ member: v === "YES" })}
        options={OPTIONS}
      />

      {m.member && (
        <div className="mt-6 space-y-5 border-t border-ink-100 pt-6">
          <Stepper
            label={t.membersLabel}
            value={m.members}
            min={MIN_MEDICAL_MEMBERS}
            max={MAX_MEDICAL_MEMBERS}
            onChange={(members) => set({ members })}
            moreLabel={t.membersMore}
            fewerLabel={t.membersFewer}
          />

          <CurrencyField
            label={t.totalLabel}
            hint={t.totalHint}
            error={totalError}
            value={m.monthlyTotal}
            onChange={(v) => set({ monthlyTotal: v })}
          />
          {m.monthlyTotal === null && <InlineNote>{t.required}</InlineNote>}

          <SegmentedControl
            legend={t.paidByLegend}
            name="medical-paid-by"
            value={m.paidBy}
            onChange={(paidBy) => set({ paidBy })}
            options={[...t.paidByOptions]}
          />

          {m.paidBy === "SHARED" && (
            <CurrencyField
              label={t.employerShareLabel}
              hint={t.employerShareHint}
              error={shareError}
              value={m.employerShare}
              onChange={(v) => set({ employerShare: v })}
            />
          )}

          {ownSharePaid && (
            <SegmentedControl
              legend={t.viaLegend}
              name="medical-paid-via"
              value={m.ownSharePaidVia}
              onChange={(ownSharePaidVia) => set({ ownSharePaidVia })}
              options={[...t.viaOptions]}
            />
          )}

          {m.paidBy === "EMPLOYER" && result && (
            <InlineNote>{t.employerPaysNote(formatRand(result.medical6A.monthlyCredit, { decimals: 0 }))}</InlineNote>
          )}
          {result?.notes.includes("MEDICAL_CREDIT_CLAIMED_ON_FILING") && <InlineNote>{t.debitNote}</InlineNote>}

          <div className="border-t border-ink-100 pt-5">
            <CurrencyField
              label={t.outOfPocketLabel}
              hint={t.outOfPocketHint}
              error={oopError}
              value={m.outOfPocketAnnual}
              onChange={(v) => set({ outOfPocketAnnual: v })}
              optional
            />
          </div>
        </div>
      )}
    </>
  );
}
