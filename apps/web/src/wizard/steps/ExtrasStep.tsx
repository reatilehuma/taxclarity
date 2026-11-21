import { useId, useState } from "react";
import { CurrencyField } from "../../components/forms/CurrencyField.tsx";
import { SegmentedControl } from "../../components/forms/SegmentedControl.tsx";
import { Stepper } from "../../components/forms/Stepper.tsx";
import { Icon } from "../../components/Icon.tsx";
import { copy } from "../../content/strings.ts";
import { extrasFilledCount, type ExtrasAnswers } from "../answers.ts";
import { InlineNote, type StepViewProps, StepHeading } from "./shared.tsx";

const t = copy.wizard.extras;

const negative = (v: number | null) => (v !== null && v < 0 ? t.negative : null);

function Group({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-ink-100 pt-5 first:border-t-0 first:pt-0">
      <h2 className="mb-4 text-sm font-bold tracking-wide text-ink-500 uppercase">{heading}</h2>
      <div className="space-y-5">{children}</div>
    </section>
  );
}

/** Step 6: optional extras, tucked away until asked for. Skipping is always fine. */
export function ExtrasStep({ answers, update }: StepViewProps) {
  const e = answers.extras;
  const set = (patch: Partial<ExtrasAnswers>) => update({ extras: { ...e, ...patch } });
  const count = extrasFilledCount(answers);

  // Coming back to a step that already has something in it shows it open.
  const [open, setOpen] = useState(count > 0);
  const panelId = useId();

  return (
    <>
      <StepHeading sub={t.sub}>{t.question}</StepHeading>

      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-14 w-full items-center justify-between gap-3 rounded-2xl bg-surface px-5 py-3 text-left ring-1 ring-ink-300 transition-colors hover:ring-brand-400"
      >
        <span className="flex flex-wrap items-center gap-3">
          <span className="text-base font-bold text-ink-950">{t.toggle}</span>
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${count > 0 ? "bg-brand-700 text-white" : "bg-ink-100 text-ink-600"}`}
          >
            {count > 0 ? t.filled(count) : t.none}
          </span>
        </span>
        <Icon name="chevronDown" className={`h-5 w-5 shrink-0 text-ink-500 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      <div id={panelId} hidden={!open} className="mt-6 space-y-6">
        <Group heading={t.moneyHeading}>
          <CurrencyField
            label={t.donationsLabel}
            hint={t.donationsHint}
            error={negative(e.donationsAnnual)}
            value={e.donationsAnnual}
            onChange={(v) => set({ donationsAnnual: v })}
            optional
          />
          <label className="flex cursor-pointer items-center gap-2.5 text-[15px] font-medium text-ink-800">
            <input
              type="checkbox"
              checked={e.has18AReceipt}
              onChange={(ev) => set({ has18AReceipt: ev.target.checked })}
              className="h-5 w-5 accent-brand-700"
            />
            {t.receipt}
          </label>
          {e.donationsAnnual !== null && e.donationsAnnual > 0 && !e.has18AReceipt && <InlineNote>{t.receiptNote}</InlineNote>}

          <CurrencyField
            label={t.interestLabel}
            hint={t.interestHint}
            error={negative(e.interestAnnual)}
            value={e.interestAnnual}
            onChange={(v) => set({ interestAnnual: v })}
            optional
          />
        </Group>

        <Group heading={t.travelHeading}>
          <CurrencyField
            label={t.travelLabel}
            hint={t.travelHint}
            error={negative(e.travelAllowanceMonthly)}
            value={e.travelAllowanceMonthly}
            onChange={(v) => set({ travelAllowanceMonthly: v })}
            optional
          />
          {e.travelAllowanceMonthly !== null && e.travelAllowanceMonthly > 0 && (
            <>
              <SegmentedControl
                legend={t.travelUseLegend}
                name="travel-business-use"
                value={e.travelBusinessHigh ? "HIGH" : "LOW"}
                onChange={(v) => set({ travelBusinessHigh: v === "HIGH" })}
                options={[...t.travelUseOptions]}
              />
              <CurrencyField
                label={t.travelKmLabel}
                hint={t.travelKmHint}
                error={negative(e.travelKmAnnual)}
                value={e.travelKmAnnual}
                onChange={(v) => set({ travelKmAnnual: v })}
                unit="km"
                optional
              />
              <InlineNote>{t.travelNote}</InlineNote>
            </>
          )}
        </Group>

        <Group heading={t.secondHeading}>
          <label className="flex cursor-pointer items-center gap-2.5 text-[15px] font-medium text-ink-800">
            <input
              type="checkbox"
              checked={e.hasSecondEmployer}
              onChange={(ev) => set({ hasSecondEmployer: ev.target.checked })}
              className="h-5 w-5 accent-brand-700"
            />
            {t.secondToggle}
          </label>
          {e.hasSecondEmployer && (
            <CurrencyField
              label={t.secondLabel}
              hint={t.secondHint}
              error={negative(e.secondEmployerAnnual)}
              value={e.secondEmployerAnnual}
              onChange={(v) => set({ secondEmployerAnnual: v })}
              optional
            />
          )}
        </Group>

        {answers.medical.member && (
          <Group heading={t.medicalHeading}>
            <div>
              <Stepper
                label={t.monthsLabel}
                value={e.medicalMonths}
                min={0}
                max={12}
                onChange={(medicalMonths) => set({ medicalMonths })}
                moreLabel={t.monthsMore}
                fewerLabel={t.monthsFewer}
              />
              <p className="mt-2 text-sm text-ink-500">{t.monthsHint}</p>
            </div>
            <div>
              <label className="flex cursor-pointer items-center gap-2.5 text-[15px] font-medium text-ink-800">
                <input
                  type="checkbox"
                  checked={e.disability}
                  onChange={(ev) => set({ disability: ev.target.checked })}
                  className="h-5 w-5 accent-brand-700"
                />
                {t.disability}
              </label>
              <p className="mt-1.5 ml-7.5 text-sm text-ink-500">{t.disabilityHint}</p>
            </div>
          </Group>
        )}
      </div>
    </>
  );
}
