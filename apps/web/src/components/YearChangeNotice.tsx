import { copy, yearCopy } from "../content/strings.ts";
import { Container } from "./ui.tsx";
import { rulesFor } from "../lib/years.ts";
import { useWizard } from "../wizard/WizardContext.tsx";

/**
 * "Tax year changed to 2026/27. Your results have been recalculated using that year's rules." (PRD §8).
 * Shown at the top of the page and announced politely. It never blocks anything: it stays until it is dismissed or the
 * year changes again, so it is not a message that disappears before someone can read it.
 */
export function YearChangeNotice() {
  const { yearNotice, dismissYearNotice } = useWizard();
  return (
    // The live region is always in the page so a screen reader notices the text arriving.
    <div role="status" aria-live="polite" data-testid="year-notice">
      {yearNotice && (
        <div className="border-b border-brand-200 bg-brand-50 text-brand-900">
          <Container className="flex items-start justify-between gap-3 py-2.5 text-sm">
            <p>{copy.taxYear.changed(yearCopy(rulesFor(yearNotice)).label)}</p>
            <button
              type="button"
              onClick={dismissYearNotice}
              className="-my-1 inline-flex min-h-11 shrink-0 items-center rounded-lg px-3 font-semibold underline underline-offset-4 hover:bg-brand-100 focus-visible:outline-2 focus-visible:outline-brand-600"
            >
              {copy.taxYear.dismiss}
            </button>
          </Container>
        </div>
      )}
    </div>
  );
}
