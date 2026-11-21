import {
  buildBreakdown,
  buildExplanations,
  buildRecommendations,
  type BreakdownRow,
} from "@taxclarity/tax-engine";
import { useMemo } from "react";
import { Navigate, useNavigate } from "react-router";
import { AgeConfirm } from "../components/AgeConfirm.tsx";
import { TaxYearSelect } from "../components/TaxYearSelect.tsx";
import { ConfidenceBadge, Button, ButtonLink, Container } from "../components/ui.tsx";
import { copy, yearCopy } from "../content/strings.ts";
import { useDocumentTitle } from "../hooks/useDocumentTitle.ts";
import { formatDate, formatRand } from "../lib/format.ts";
import { AssistantButton } from "../assistant/AssistantButton.tsx";
import { BracketWalk } from "../results/BracketWalk.tsx";
import { ExplanationCards, Recommendations } from "../results/Guidance.tsx";
import { CopySummary } from "../results/CopySummary.tsx";
import { DownloadPdf } from "../results/DownloadPdf.tsx";
import { LedgerTable, type LedgerLabel } from "../results/LedgerTable.tsx";
import { Assumptions, Flags, Warnings } from "../results/Notices.tsx";
import { PayslipComparison } from "../results/PayslipComparison.tsx";
import { Section } from "../results/Section.tsx";
import { ageNeedsConfirmation, toEngineInputs } from "../wizard/answers.ts";
import { indexOfStep, stepUrl } from "../wizard/flow.ts";
import { useWizard, useWizardResult } from "../wizard/WizardContext.tsx";

const t = copy.results;
const b = t.breakdown;

/**
 * The results page (PRD §14): the headline, the pay-to-bank table, the bracket working,
 * the payslip comparison, and what the calculation assumes and leaves out. Every figure is the
 * engine's; this page only lays it out. Education and recommendations arrive in Phase 11.
 */
export function ResultsPage() {
  useDocumentTitle(t.title);
  const result = useWizardResult();
  const { answers, rules, reset } = useWizard();
  const navigate = useNavigate();
  const breakdown = useMemo(() => (result ? buildBreakdown(result) : null), [result]);
  const guidance = useMemo(() => {
    if (!result) return null;
    const inputs = toEngineInputs(answers);
    return { explanations: buildExplanations(rules, inputs, result), recommendations: buildRecommendations(rules, inputs, result) };
  }, [answers, result, rules]);

  // After a year change that could alter the age group, no numbers until it has been checked (PRD §8).
  if (ageNeedsConfirmation(answers)) {
    return (
      <Container className="py-8 sm:py-12">
        <div className="mx-auto w-full max-w-[820px] space-y-5">
          <TaxYearSelect className="max-w-sm" />
          <AgeConfirm />
          <p className="text-sm text-ink-600">{copy.taxYear.ageConfirm.waiting}</p>
        </div>
      </Container>
    );
  }

  // Without the minimum answers there is nothing to show: back to the start (PRD §18).
  if (!result || !breakdown || !guidance) return <Navigate to={stepUrl(0)} replace />;

  // Every sentence that names the year comes from the result's own year, so it always matches the numbers.
  const year = yearCopy(rules);

  const estimate = result.confidence === "ESTIMATE";
  const periodWord = copy.wizard.amount.periodWord[result.payFrequency];

  const taxRows = breakdown.tax;
  const at = (id: BreakdownRow["id"]) => taxRows.findIndex((row) => row.id === id);
  const incomeRows = taxRows.slice(0, at("TAXABLE_INCOME") + 1);
  const afterRows = taxRows.slice(at("TAX_BEFORE_REBATES"));

  const describe = (row: BreakdownRow): LedgerLabel => {
    if (row.id === "FILING_BALANCE") {
      return row.annual > 0 ? b.balance.owed : row.annual < 0 ? b.balance.refund : b.balance.even;
    }
    const label = b.rows[row.id as keyof typeof b.rows];
    return row.id === "TAX_FOR_YEAR" || row.id === "FILING_TAX" ? { ...label, hint: year.taxForYearHint } : label;
  };
  // The balance is shown as a plain amount; the label says whether it is a refund or a debt.
  const filingRows = breakdown.filing.map((row) => (row.id === "FILING_BALANCE" ? { ...row, annual: Math.abs(row.annual) } : row));
  const filingDescribe = (row: BreakdownRow): LedgerLabel =>
    row.id === "FILING_BALANCE" ? describe(breakdown.filing.find((x) => x.id === "FILING_BALANCE")!) : describe(row);

  return (
    <Container className="py-8 sm:py-12">
      <div className="mx-auto w-full max-w-[820px]">
        {/* 1. Summary (PRD §14.1) */}
        <div className="flex flex-wrap items-center gap-2">
          <ConfidenceBadge
            kind={estimate ? "estimate" : "accurate"}
            label={estimate ? copy.common.estimate : copy.common.payslipAccurate}
          />
          <p className="text-sm text-ink-500">{year.taxYearLine(formatDate(rules.startDate), formatDate(rules.endDate))}</p>
        </div>

        <TaxYearSelect className="mt-4 max-w-sm" />

        <h1 className="mt-6 text-[1.65rem] leading-snug font-bold tracking-tight text-ink-950 sm:text-3xl">
          {result.comparison ? (
            <>
              {t.payslipLead} <span className="money text-brand-800">{formatRand(result.comparison.payslipPaye)}</span>
              {year.payslipMid} <span className="money text-brand-800">{formatRand(result.comparison.calcPaye)}</span>.
            </>
          ) : (
            <>
              {t.payeLead} <span className="money text-brand-800">{formatRand(result.monthlyPaye)}</span>
              {t.takeHomeLead} <span className="money text-brand-800">{formatRand(result.takeHomeMonthly)}</span>.
            </>
          )}
        </h1>

        {result.payFrequency !== "MONTHLY" && (
          <p className="mt-3 text-base text-ink-600">{t.perPeriod(formatRand(result.takeHomePerPeriod), periodWord)}</p>
        )}
        {estimate && <p className="mt-3 text-base text-ink-600">{t.estimatedGross(formatRand(result.grossMonthly))}</p>}

        <dl className="mt-8 grid gap-3 sm:grid-cols-3">
          <Tile label={t.tiles.takeHome} value={formatRand(result.takeHomeMonthly)} emphasis />
          <Tile label={t.tiles.paye} value={formatRand(result.monthlyPaye)} />
          <Tile label={t.tiles.annual} value={formatRand(result.annualLiability)} />
        </dl>

        {result.filing.refundAnnual > 0 && (
          <p className="mt-6 rounded-xl bg-brand-50 px-4 py-3 text-sm text-brand-900">{t.refund(formatRand(result.filing.refundAnnual))}</p>
        )}
        {result.filing.owedAnnual > 0 && (
          <p className="mt-6 rounded-xl bg-alert-bg px-4 py-3 text-sm text-alert-fg">{t.owed(formatRand(result.filing.owedAnnual))}</p>
        )}

        <Warnings warnings={result.warnings} />

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <ButtonLink to={stepUrl(indexOfStep(answers, "review"))} variant="secondary" icon="arrowLeft">
            {t.adjust}
          </ButtonLink>
          <CopySummary result={result} />
          <DownloadPdf result={result} />
          <AssistantButton result={result} explanations={guidance.explanations} recommendations={guidance.recommendations} />
          <Button
            variant="ghost"
            onClick={() => {
              reset();
              navigate(stepUrl(0));
            }}
          >
            {t.startOver}
          </Button>
        </div>
        <p className="mt-4 text-xs text-ink-500">{t.disclaimer}</p>

        {/* 2. From pay to the bank account (PRD §14.2) */}
        <Section id="pay-heading" title={b.payslipHeading} sub={b.payslipSub}>
          <LedgerTable caption={b.payslipCaption} rows={breakdown.payslip} columns="monthAndYear" describe={describe} />
          {result.variablePay.totalAnnual > 0 && <p className="mt-3 text-sm text-ink-600">{b.yearNote}</p>}

          {breakdown.offPayslip.length > 0 && (
            <div className="mt-6">
              <h3 className="text-base font-bold text-ink-950">{b.offPayslipHeading}</h3>
              <p className="mt-1 mb-3 text-sm text-ink-600">{b.offPayslipSub}</p>
              <LedgerTable caption={b.offPayslipHeading} rows={breakdown.offPayslip} columns="monthAndYear" describe={describe} />
            </div>
          )}
        </Section>

        {/* 3. Taxable income, then the SARS brackets, then rebates and credits (PRD §14.2, §14.3) */}
        <Section id="income-heading" title={b.taxHeading} sub={b.taxSub}>
          <LedgerTable caption={b.taxCaption} rows={incomeRows} columns="yearOnly" describe={describe} />
        </Section>

        <Section id="brackets-heading" title={b.bracketsHeading} sub={b.bracketsSub}>
          <BracketWalk rows={result.bracketWalk} caption={year.bracketsCaption} />
        </Section>

        <Section id="after-heading" title={b.afterHeading} sub={b.afterSub}>
          <LedgerTable caption={b.afterCaption} rows={afterRows} columns="yearOnly" describe={describe} />
          {result.medical6A.unusedAnnual > 0 && (
            <p className="mt-3 text-sm text-ink-600">{b.unusedCredit(formatRand(result.medical6A.unusedAnnual))}</p>
          )}
        </Section>

        <Section id="filing-heading" title={b.filingHeading} sub={b.filingSub}>
          <LedgerTable caption={b.filingCaption} rows={filingRows} columns="yearOnly" describe={filingDescribe} />
        </Section>

        {/* 4. Payslip comparison, only when payslip figures were entered (PRD §14.4) */}
        {result.comparison && (
          <Section id="comparison-heading" title={t.comparison.heading} sub={t.comparison.sub}>
            <PayslipComparison comparison={result.comparison} />
          </Section>
        )}

        {/* 5. Education and recommendations (PRD §14.5, §14.6) */}
        {guidance.explanations.length > 0 && (
          <Section id="explain-heading" title={t.explainHeading} sub={t.explainSub}>
            <ExplanationCards items={guidance.explanations} />
          </Section>
        )}

        {guidance.recommendations.length > 0 && (
          <Section id="advice-heading" title={t.adviceHeading} sub={t.adviceSub}>
            <Recommendations items={guidance.recommendations} />
          </Section>
        )}

        {/* 6. Assumptions and exclusions (PRD §14.7) */}
        {result.notes.length > 0 && (
          <Section id="notes-heading" title={t.notesHeading}>
            <Assumptions notes={result.notes} />
          </Section>
        )}

        <Section id="flags-heading" title={t.flagsHeading} sub={t.flagsSub}>
          <Flags flags={result.flags} taxYear={result.taxYear} />
        </Section>
      </div>
    </Container>
  );
}

function Tile({ label, value, emphasis }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div
      className={`rounded-2xl p-4 ring-1 ${emphasis ? "bg-brand-700 text-white ring-brand-700" : "bg-surface text-ink-900 ring-ink-200"}`}
    >
      <dt className={`text-xs font-medium ${emphasis ? "text-brand-100" : "text-ink-500"}`}>{label}</dt>
      <dd className="money mt-1.5 text-xl font-semibold">{value}</dd>
    </div>
  );
}
