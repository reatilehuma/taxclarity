import type { CalculationMode } from "@taxclarity/tax-engine";
import { useEffect, useRef } from "react";
import { Navigate, useLocation, useNavigate, useSearchParams } from "react-router";
import { preloadResults } from "../lazyPages.ts";
import { Faq } from "../components/forms/Faq.tsx";
import { TaxYearSelect, WIZARD_YEAR_SELECT_ID } from "../components/TaxYearSelect.tsx";
import { Button, Container } from "../components/ui.tsx";
import { copy } from "../content/strings.ts";
import { useDocumentTitle } from "../hooks/useDocumentTitle.ts";
import { flowFor, furthestReachable, parseStep, stepUrl } from "./flow.ts";
import { LivePreview } from "./LivePreview.tsx";
import { STEP_VIEWS } from "./steps/index.ts";
import { useWizard } from "./WizardContext.tsx";
import { WizardProgress } from "./WizardProgress.tsx";

/** The landing-page buttons start the wizard already knowing the mode: /wizard?start=take-home. */
const START_MODES = new Map<string, CalculationMode>([
  ["take-home", "TAKE_HOME"],
  ["gross", "GROSS"],
  ["payslip", "PAYSLIP"],
]);

const t = copy.wizard;

export function WizardPage() {
  // The result page is the next stop, so start fetching it while the questions are being answered.
  useEffect(() => {
    void preloadResults();
  }, []);
  const [params] = useSearchParams();
  const stepParam = params.get("step");
  const startMode = START_MODES.get(params.get("start") ?? "");
  if (stepParam === null && startMode) return <EnterWizard mode={startMode} />;
  return <WizardSteps stepParam={stepParam} fromReview={params.get("from") === "review"} />;
}

/** Records how they chose to start, then goes straight to the money question. */
function EnterWizard({ mode }: { mode: CalculationMode }) {
  const { update } = useWizard();
  const navigate = useNavigate();
  useEffect(() => {
    update({ mode });
    navigate(stepUrl(1), { replace: true });
  }, [mode, update, navigate]);
  return null;
}

function WizardSteps({ stepParam, fromReview }: { stepParam: string | null; fromReview: boolean }) {
  const { answers, update } = useWizard();
  const navigate = useNavigate();
  const location = useLocation();

  const flow = flowFor(answers);
  const requested = parseStep(stepParam);
  // Never jump ahead of an unanswered question, whatever the address says.
  const index = Math.min(requested, furthestReachable(flow, answers), flow.length - 1);
  const step = flow[index]!;
  const isLast = index === flow.length - 1;
  const canContinue = step.isComplete(answers);

  // Arriving from the review screen's Edit links: finishing the step goes straight back there.
  const reviewIndex = flow.findIndex((s) => s.id === "review");
  const returnToReview = fromReview && step.id !== "review" && reviewIndex >= 0;
  // If the Edit link was clicked in this session, the review is the previous page in history, so go
  // back to it rather than adding a new entry. That keeps the browser Back button sensible.
  const cameFromReviewLink = (location.state as { fromReview?: boolean } | null)?.fromReview === true;
  const goToReview = () => (cameFromReviewLink ? navigate(-1) : navigate(stepUrl(reviewIndex)));

  useDocumentTitle(step.title);

  // When the step changes, move focus to the new question and start at the top (PRD §17.3).
  const containerRef = useRef<HTMLDivElement>(null);
  const shownIndex = useRef(index);
  // Arriving at the wizard from another page (the landing page's buttons, say) counts as a change too.
  // A fresh page load keeps focus at the top so the skip link is still the first stop.
  const arrivedByNavigation = useRef(location.key !== "default");
  useEffect(() => {
    if (arrivedByNavigation.current) containerRef.current?.querySelector<HTMLElement>("h1")?.focus();
  }, []);
  useEffect(() => {
    if (shownIndex.current === index) return;
    shownIndex.current = index;
    window.scrollTo(0, 0);
    containerRef.current?.querySelector<HTMLElement>("h1")?.focus();
  }, [index]);

  // A wrong or too-far address is tidied up without adding to the browser history.
  if (stepParam !== null && String(index) !== stepParam) return <Navigate to={stepUrl(index)} replace />;

  const View = STEP_VIEWS[step.id];
  // The very first screen ("how do you want to start?") has nothing to preview yet.
  const showPreview = step.id !== "start";

  function next() {
    if (!canContinue) return;
    if (returnToReview) goToReview();
    else navigate(isLast ? "/results" : stepUrl(index + 1));
  }

  return (
    <Container className="py-8 pb-24 sm:py-12 lg:pb-12">
      <div
        className={
          showPreview
            ? "lg:grid lg:grid-cols-[minmax(0,560px)_minmax(320px,400px)] lg:justify-center lg:gap-10 xl:gap-14"
            : ""
        }
      >
        <div ref={containerRef} className={`mx-auto w-full max-w-[560px] ${showPreview ? "lg:mx-0" : ""}`}>
          <TaxYearSelect id={WIZARD_YEAR_SELECT_ID} className="mb-5" />
          <WizardProgress index={index} total={flow.length - 1} title={step.title} />

          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              next();
            }}
            className="mt-5 rounded-[var(--radius-card)] bg-surface p-5 shadow-[var(--shadow-card)] ring-1 ring-ink-200/70 sm:p-8"
          >
            <View answers={answers} update={update} />

            <div className="mt-8 flex items-center justify-between gap-3">
              {index > 0 ? (
                <Button variant="ghost" icon="arrowLeft" iconPosition="before" onClick={() => (returnToReview ? goToReview() : navigate(stepUrl(index - 1)))}>
                  {t.nav.back}
                </Button>
              ) : (
                <span />
              )}
              <Button type="submit" disabled={!canContinue} icon="arrowRight">
                {returnToReview ? t.nav.backToReview : isLast ? t.nav.seeResult : (step.primaryLabel?.(answers) ?? t.nav.continue)}
              </Button>
            </div>
          </form>

          <Faq heading={t.faqHeading} items={step.faq(answers)} />
        </div>
        {showPreview && <LivePreview answers={answers} stepIndex={index} />}
      </div>
    </Container>
  );
}
