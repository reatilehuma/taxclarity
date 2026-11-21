import { useState } from "react";
import { CurrencyField } from "../../components/forms/CurrencyField.tsx";
import { SegmentedControl } from "../../components/forms/SegmentedControl.tsx";
import { copy } from "../../content/strings.ts";
import { formatRand } from "../../lib/format.ts";
import { MAX_REASONABLE_AMOUNT, toEngineInputs } from "../answers.ts";
import { calculate } from "../WizardContext.tsx";
import { InlineNote, type StepViewProps, StepHeading } from "./shared.tsx";

const t = copy.wizard.amount;

const SLIDER = { min: 1_000, max: 150_000, step: 500, start: 20_000 } as const;

/** Step 1: the money question, plus how often you're paid. The wording follows the chosen mode. */
export function AmountStep({ answers, update }: StepViewProps) {
  const mode = answers.mode ?? "GROSS";
  const { payFrequency, amount } = answers;
  const [touched, setTouched] = useState(false);
  const [unsure, setUnsure] = useState(false);

  const period = t.periodWord[payFrequency];
  const negative = amount !== null && amount < 0;
  const tooHigh = amount !== null && amount > MAX_REASONABLE_AMOUNT;
  const confirmed = tooHigh && answers.confirmedHighAmount === amount;

  const error = negative ? t.negative : touched && amount === null ? t.required : null;

  // The monthly equivalent comes from the engine, not from sums here.
  const monthly =
    payFrequency !== "MONTHLY" && amount !== null && amount > 0 && !negative
      ? mode === "TAKE_HOME"
        ? calculate(toEngineInputs(answers)).estimate?.targetMonthly
        : calculate(toEngineInputs(answers)).grossMonthly
      : undefined;

  function toggleUnsure(on: boolean) {
    setUnsure(on);
    if (on && amount === null) update({ amount: SLIDER.start });
  }

  return (
    <>
      <StepHeading>{t.questions[mode][payFrequency]}</StepHeading>

      <CurrencyField
        label={t.fieldLabel[mode](period)}
        hint={t.hint[mode]}
        error={error}
        value={amount}
        onChange={(value) => update({ amount: value })}
        onBlur={() => setTouched(true)}
      />

      {monthly !== undefined && (
        <p className="money mt-3 text-sm font-medium text-brand-800">{t.monthlyEquivalent(formatRand(monthly))}</p>
      )}
      {amount === 0 && <InlineNote>{t.zero}</InlineNote>}

      {tooHigh && (
        <div className="mt-4 rounded-xl bg-alert-bg px-4 py-3 text-sm text-alert-fg">
          <p className="font-medium">{t.tooHigh}</p>
          <label className="mt-2 flex items-center gap-2.5 font-semibold">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => update({ confirmedHighAmount: e.target.checked ? amount : null })}
              className="h-5 w-5 accent-brand-700"
            />
            {t.tooHighConfirm}
          </label>
        </div>
      )}

      {mode === "TAKE_HOME" && (
        <div className="mt-5">
          <label className="flex cursor-pointer items-center gap-2.5 text-[15px] font-medium text-ink-800">
            <input
              type="checkbox"
              checked={unsure}
              onChange={(e) => toggleUnsure(e.target.checked)}
              className="h-5 w-5 accent-brand-700"
            />
            {t.unsureToggle}
          </label>
          {unsure && <AmountSlider value={amount} onChange={(value) => update({ amount: value })} />}
        </div>
      )}

      <div className="mt-8 border-t border-ink-100 pt-6">
        <SegmentedControl
          legend={t.frequencyLegend}
          name="pay-frequency"
          value={payFrequency}
          onChange={(value) => update({ payFrequency: value })}
          options={[...t.frequencyOptions]}
        />
      </div>
    </>
  );
}

/** "I'm not sure": drag to roughly the right amount (PRD §8 Step 1). */
function AmountSlider({ value, onChange }: { value: number | null; onChange: (value: number) => void }) {
  const shown = Math.min(SLIDER.max, Math.max(SLIDER.min, value ?? SLIDER.start));
  return (
    <div className="mt-3 rounded-xl bg-ink-50 p-4">
      <label htmlFor="amount-slider" className="text-sm text-ink-600">
        {t.unsureSlider}
      </label>
      <input
        id="amount-slider"
        type="range"
        min={SLIDER.min}
        max={SLIDER.max}
        step={SLIDER.step}
        value={shown}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-valuetext={formatRand(shown, { decimals: 0 })}
        className="mt-3 h-6 w-full cursor-pointer accent-brand-700"
      />
      <div className="money mt-1 flex justify-between text-xs text-ink-500">
        <span>{formatRand(SLIDER.min, { decimals: 0 })}</span>
        <span className="text-sm font-semibold text-ink-800">{formatRand(shown, { decimals: 0 })}</span>
        <span>{formatRand(SLIDER.max, { decimals: 0 })}</span>
      </div>
    </div>
  );
}
