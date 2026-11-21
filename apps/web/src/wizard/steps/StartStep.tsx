import type { CalculationMode } from "@taxclarity/tax-engine";
import { ChoiceCards, type Choice } from "../../components/forms/ChoiceCards.tsx";
import { copy } from "../../content/strings.ts";
import { type StepViewProps, StepHeading } from "./shared.tsx";

const t = copy.wizard.start;

const OPTIONS: Choice<CalculationMode>[] = [
  { value: "TAKE_HOME", icon: "wallet", ...t.options.TAKE_HOME },
  { value: "GROSS", icon: "file", ...t.options.GROSS },
  { value: "PAYSLIP", icon: "receipt", ...t.options.PAYSLIP },
];

/** Step 0: how would you like to start? */
export function StartStep({ answers, update }: StepViewProps) {
  return (
    <>
      <StepHeading sub={t.sub}>{t.question}</StepHeading>
      <ChoiceCards
        legend={t.question}
        name="start"
        value={answers.mode}
        onChange={(mode) => update({ mode })}
        options={OPTIONS}
      />
    </>
  );
}
