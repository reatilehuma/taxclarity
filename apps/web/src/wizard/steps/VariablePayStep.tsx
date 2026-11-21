import { ChipGroup, type ChipOption } from "../../components/forms/ChipGroup.tsx";
import { CurrencyField } from "../../components/forms/CurrencyField.tsx";
import { copy } from "../../content/strings.ts";
import { toggleVariableType, variableField, type VariableAnswers, type VariableType } from "../answers.ts";
import { previewResult } from "../WizardContext.tsx";
import { InlineNote, type StepViewProps, StepHeading } from "./shared.tsx";

const t = copy.wizard.variable;

type Choice = VariableType | "NONE";
const OPTIONS: readonly ChipOption<Choice>[] = t.options;
const ORDER: VariableType[] = ["BONUS", "OVERTIME", "COMMISSION"];

/** Step 5: bonus, overtime or commission. Each one picked gets a rough yearly amount. */
export function VariablePayStep({ answers, update }: StepViewProps) {
  const v = answers.variable;
  const set = (patch: Partial<VariableAnswers>) => update({ variable: { ...v, ...patch } });
  const picked = ORDER.filter((type) => v.types?.includes(type));
  const result = previewResult(answers);

  const isChecked = (c: Choice) => (c === "NONE" ? v.types !== null && v.types.length === 0 : (v.types?.includes(c) ?? false));

  function toggle(c: Choice) {
    if (c === "NONE") {
      // Ticking "None" clears the rest; ticking it again un-answers the question.
      set({ types: isChecked("NONE") ? null : [] });
    } else {
      set({ types: toggleVariableType(v.types, c) });
    }
  }

  return (
    <>
      <StepHeading sub={t.sub}>{t.question}</StepHeading>
      <ChipGroup legend={t.legend} hideLegend options={OPTIONS} isChecked={isChecked} onToggle={toggle} />

      {picked.length > 0 && (
        <div className="mt-6 space-y-5 border-t border-ink-100 pt-6">
          {picked.map((type) => {
            const value = v[variableField(type)];
            const error = value !== null && value < 0 ? t.negative : null;
            return (
              <div key={type}>
                <CurrencyField
                  label={t.amountLabel[type]}
                  hint={t.amountHint}
                  error={error}
                  value={value}
                  onChange={(amount) => set({ [variableField(type)]: amount })}
                />
                {value === null && <InlineNote>{t.required}</InlineNote>}
              </div>
            );
          })}
          {result?.warnings.includes("VARIABLE_PAY_HIGH") && <InlineNote>{t.highNote}</InlineNote>}
        </div>
      )}
    </>
  );
}
