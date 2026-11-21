import { AgeConfirm } from "../../components/AgeConfirm.tsx";
import { SegmentedControl } from "../../components/forms/SegmentedControl.tsx";
import { copy, yearCopy } from "../../content/strings.ts";
import { formatRand } from "../../lib/format.ts";
import { rulesFor } from "../../lib/years.ts";
import { ageNeedsConfirmation } from "../answers.ts";
import { InlineNote, type StepViewProps, StepHeading } from "./shared.tsx";

const t = copy.wizard.age;

/**
 * Step 2: age group, on the last day of the chosen tax year. Drives the rebates, the tax threshold and the extra
 * medical credit. After a year change that could alter the answer, the person is asked to check it here.
 */
export function AgeStep({ answers, update }: StepViewProps) {
  const rules = rulesFor(answers.taxYear);
  return (
    <>
      <StepHeading sub={t.sub}>{t.question}</StepHeading>
      {ageNeedsConfirmation(answers) ? (
        <AgeConfirm />
      ) : (
        <SegmentedControl
          legend={yearCopy(rules).ageLegend}
          hideLegend
          name="age-band"
          value={answers.ageBand}
          onChange={(ageBand) => update({ ageBand })}
          options={[...t.options]}
        />
      )}
      <InlineNote>
        {t.note(formatRand(rules.rebates.secondary65, { decimals: 0 }), formatRand(rules.rebates.tertiary75, { decimals: 0 }))}
      </InlineNote>
    </>
  );
}
