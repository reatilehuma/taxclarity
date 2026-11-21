import { Link } from "react-router";
import { AgeConfirm } from "../../components/AgeConfirm.tsx";
import { WIZARD_YEAR_SELECT_ID } from "../../components/TaxYearSelect.tsx";
import { copy, yearCopy } from "../../content/strings.ts";
import { rulesFor, SELECTABLE_YEARS } from "../../lib/years.ts";
import { ageNeedsConfirmation } from "../answers.ts";
import { indexOfStep, stepUrl, type StepId } from "../flow.ts";
import { buildReview } from "../review.ts";
import { previewResult } from "../WizardContext.tsx";
import { type StepViewProps, StepHeading } from "./shared.tsx";

const t = copy.wizard.review;

/** Step 8: read-only summary of every answer. Edit links go back to the step and return here. */
export function ReviewStep({ answers }: StepViewProps) {
  const groups = buildReview(answers, previewResult(answers));
  const link = (step: StepId) => stepUrl(Math.max(indexOfStep(answers, step), 0), { fromReview: true });
  const linkClass =
    "rounded-lg px-2 py-1 text-sm font-semibold text-brand-700 underline decoration-brand-300 underline-offset-4 hover:bg-brand-50 hover:text-brand-900";

  return (
    <>
      <StepHeading sub={t.sub}>{t.question}</StepHeading>

      {ageNeedsConfirmation(answers) && (
        <div className="mb-4">
          <AgeConfirm />
        </div>
      )}

      <div className="space-y-4">
        {groups.map((g) => (
          <section
            key={g.id}
            aria-labelledby={`review-${g.id}`}
            className="rounded-2xl bg-ink-50/70 p-4 ring-1 ring-ink-200/70 sm:p-5"
          >
            <div className="flex items-center justify-between gap-3">
              <h2 id={`review-${g.id}`} className="text-base font-bold text-ink-950">
                {g.title}
              </h2>
              <Link to={link(g.editStep)} state={{ fromReview: true }} className={linkClass} aria-label={t.editLabel(g.title)}>
                {t.edit}
              </Link>
            </div>
            <dl className="mt-3 divide-y divide-ink-200/70 text-[15px]">
              {g.rows.map((row) => (
                <div key={row.label} className="flex items-baseline justify-between gap-4 py-2 first:pt-0 last:pb-0">
                  <dt className="text-ink-600">{row.label}</dt>
                  <dd className="money flex flex-wrap items-baseline justify-end gap-x-3 text-right font-semibold text-ink-950">
                    {row.value}
                    {row.focusYearSelect && SELECTABLE_YEARS.length > 1 && (
                      <button
                        type="button"
                        onClick={() => document.getElementById(WIZARD_YEAR_SELECT_ID)?.focus()}
                        className={`${linkClass} font-sans text-xs`}
                        aria-label={`${t.change} ${row.label}`}
                      >
                        {t.change}
                      </button>
                    )}
                    {row.editStep && (
                      <Link to={link(row.editStep)} state={{ fromReview: true }} className={`${linkClass} font-sans text-xs`} aria-label={`${t.change} ${row.label}`}>
                        {t.change}
                      </Link>
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>

      <p className="mt-6 text-sm leading-relaxed text-ink-500">{yearCopy(rulesFor(answers.taxYear)).smallPrint}</p>
    </>
  );
}
