import type { TaxRuleSet } from "@taxclarity/tax-engine";
import { useId } from "react";
import { copy, yearCopy } from "../content/strings.ts";
import { SELECTABLE_YEARS } from "../lib/years.ts";
import { useTaxYear } from "../wizard/WizardContext.tsx";

/** The selector at the top of the wizard. The review screen's "Change" link for the tax year moves focus to it. */
export const WIZARD_YEAR_SELECT_ID = "wizard-tax-year";

/**
 * The tax-year selector (PRD §8). A real <select>, so the keyboard and screen readers work without extra code, with
 * each year's dates in the option so the choice is clear. Choosing a year keeps every answer and recalculates with that
 * year's rules. With only one year to offer (a production build before another year has been signed off) it shows the
 * year as plain text instead of a control that does nothing.
 *
 * It appears on the landing page, the wizard, the live preview, the review screen and the results page. They all
 * change the same year.
 */
export function TaxYearSelect({
  label = copy.taxYear.label,
  years = SELECTABLE_YEARS,
  className = "",
  id: idProp,
}: {
  /** A fixed id, so another part of the page (the review screen's Change link) can move focus here. */
  id?: string;
  /** The accessible name. A second selector on the same screen gets a different one. */
  label?: string;
  /** The years to offer. Defaults to what this build allows. */
  years?: readonly TaxRuleSet[];
  className?: string;
}) {
  const generatedId = useId();
  const id = idProp ?? generatedId;
  const { taxYear, rules, setTaxYear } = useTaxYear();
  const current = yearCopy(rules);
  const tag = (r: TaxRuleSet) => (r.status === "draft" ? ` · ${copy.taxYear.draftTag}` : "");

  if (years.length <= 1) {
    return (
      <div className={`text-sm ${className}`}>
        <p className="font-semibold text-ink-800">{label}</p>
        <p className="mt-1 text-ink-700" data-testid="tax-year-fixed">
          {current.labelWithDates}
          {tag(rules)}
        </p>
        {years.length === 1 && <p className="mt-1 text-xs text-ink-500">{copy.taxYear.onlyOne}</p>}
      </div>
    );
  }

  return (
    <div className={`text-sm ${className}`}>
      <label htmlFor={id} className="block font-semibold text-ink-800">
        {label}
      </label>
      <select
        id={id}
        value={taxYear}
        onChange={(e) => setTaxYear(e.target.value as typeof taxYear)}
        className="mt-1 min-h-11 w-full rounded-xl bg-surface px-3 text-[15px] font-semibold text-ink-900 ring-1 ring-ink-300 hover:ring-brand-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
      >
        {years.map((r) => (
          <option key={r.taxYear} value={r.taxYear}>
            {yearCopy(r).labelWithDates}
            {tag(r)}
          </option>
        ))}
      </select>
    </div>
  );
}
