import { SegmentedControl } from "./forms/SegmentedControl.tsx";
import { Button } from "./ui.tsx";
import { copy, yearCopy } from "../content/strings.ts";
import { rulesFor } from "../lib/years.ts";
import { useWizard } from "../wizard/WizardContext.tsx";

/**
 * After a year change that could alter the person's age group, ask before showing any numbers (PRD §8: an input whose
 * meaning could differ in the new year is flagged and confirmed, never silently reinterpreted). Choosing a different group
 * confirms it straight away; otherwise the button says it is still right.
 */
export function AgeConfirm({ name = "age-confirm" }: { name?: string }) {
  const { answers, rules, update, confirmAge } = useWizard();
  const t = copy.taxYear.ageConfirm;
  const to = yearCopy(rules);
  const from = yearCopy(rulesFor(answers.ageBandYear));
  const band = copy.wizard.age.options.find((o) => o.value === answers.ageBand)?.label ?? "";

  return (
    <section
      aria-labelledby={`${name}-title`}
      data-testid="age-confirm"
      className="rounded-2xl bg-alert-bg p-4 text-alert-fg ring-1 ring-alert-ring sm:p-5"
    >
      <h2 id={`${name}-title`} className="text-base font-bold">
        {t.title(to.label)}
      </h2>
      <p className="mt-2 text-sm">{t.body(band, from.label, to.label, to.end)}</p>
      <div className="mt-4 text-ink-900">
        <SegmentedControl
          legend={t.legend(to.end)}
          name={name}
          value={answers.ageBand}
          onChange={(ageBand) => update({ ageBand })}
          options={[...copy.wizard.age.options]}
        />
      </div>
      <Button className="mt-4" onClick={confirmAge}>
        {t.confirm}
      </Button>
    </section>
  );
}
