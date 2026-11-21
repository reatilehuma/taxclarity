import { Icon, type IconName } from "../components/Icon.tsx";
import { TaxSummaryPanel } from "../components/TaxSummaryPanel.tsx";
import { TaxYearSelect } from "../components/TaxYearSelect.tsx";
import { useTaxYear } from "../wizard/WizardContext.tsx";
import { ButtonLink, ConfidenceBadge, Container, SectionHeading } from "../components/ui.tsx";
import { EXAMPLE_RESULT } from "../content/example.ts";
import { copy, ruleCopy, yearCopy } from "../content/strings.ts";
import { DEFAULT_TAX_YEAR, rulesFor } from "../lib/years.ts";
import { useDocumentTitle } from "../hooks/useDocumentTitle.ts";
import { formatPercent, formatRand } from "../lib/format.ts";

/** Landing page, sections in PRD §13.1 order. */
export function Landing() {
  useDocumentTitle(copy.meta.landingTitle, { full: true });
  return (
    <>
      <Hero />
      <TrustStrip />
      <HowItWorks />
      <DashboardPreview />
      <Capabilities />
      <PrivacyPromise />
    </>
  );
}

// ---------------------------------------------------------------------------
// Hero
// ---------------------------------------------------------------------------

function Hero() {
  const h = copy.hero;
  return (
    <section aria-labelledby="hero-heading" className="relative overflow-hidden">
      {/* Soft background shapes — decorative only. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 right-[-10%] h-[520px] w-[520px] rounded-full bg-brand-100/70 blur-3xl" />
        <div className="absolute bottom-[-30%] left-[-15%] h-[420px] w-[420px] rounded-full bg-brand-50 blur-3xl" />
      </div>

      <Container className="relative grid items-center gap-12 pt-10 pb-16 sm:pt-16 lg:grid-cols-[1.05fr_0.95fr] lg:gap-10 lg:pt-20 lg:pb-24">
        <div className="min-w-0 motion-safe:animate-rise">
          <h1 id="hero-heading" className="text-[2.15rem] leading-[1.08] font-extrabold tracking-tight text-ink-950 sm:text-5xl lg:text-[3.4rem]">
            {h.headline}
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink-600">{h.sub}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <ButtonLink to="/wizard?start=take-home" icon="arrowRight" className="w-full sm:w-auto">
              {h.primaryCta}
            </ButtonLink>
            <ButtonLink to="/wizard?start=gross" variant="secondary" className="w-full sm:w-auto">
              {h.secondaryCta}
            </ButtonLink>
          </div>
          <p className="mt-4 text-sm text-ink-500">{h.ctaNote}</p>
          <TaxYearSelect className="mt-6 max-w-sm" />
        </div>

        <HeroVisual />
      </Container>
    </section>
  );
}

/**
 * A payslip that resolves into the dashboard (PRD §13.1.2). Plays once; with reduced
 * motion it shows the dashboard straight away.
 */
function HeroVisual() {
  const r = EXAMPLE_RESULT;
  const h = copy.hero;

  const payslipRows: [string, number][] = [
    [h.payslipRows.basic, r.grossMonthly],
    [h.payslipRows.paye, -r.monthlyPaye],
    [h.payslipRows.uif, -r.uifMonthly],
    [h.payslipRows.pension, -r.ownRetirementMonthly],
    [h.payslipRows.medical, -r.ownMedicalMonthly],
  ];
  const top = r.bracketWalk.filter((b) => b.amountInBracket > 0);
  const topBracket = r.bracketWalk.find((b) => b.isTopBracket);

  return (
    <figure aria-label={h.visualLabel} className="relative mx-auto w-full max-w-md lg:max-w-none">
      <div className="relative h-[372px]">
        {/* Payslip */}
        <div
          aria-hidden="true"
          className="hero-payslip absolute inset-x-4 top-6 rounded-2xl bg-surface p-6 shadow-[var(--shadow-card)] ring-1 ring-ink-200 sm:inset-x-8"
        >
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-ink-900">{h.payslipTitle}</p>
            <span className="h-2 w-16 rounded-full bg-ink-100" />
          </div>
          <div className="mt-5 space-y-3 border-t border-dashed border-ink-200 pt-4 text-sm">
            {payslipRows.map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4">
                <span className="text-ink-600">{label}</span>
                <span className={`money ${value < 0 ? "text-ink-700" : "font-semibold text-ink-900"}`}>{formatRand(value)}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 flex justify-between border-t border-ink-900 pt-3 text-sm font-bold">
            <span>{h.payslipRows.net}</span>
            <span className="money">{formatRand(r.takeHomeMonthly)}</span>
          </div>
        </div>

        {/* Dashboard */}
        <div
          className="hero-dashboard absolute inset-0 rounded-[var(--radius-card)] bg-surface p-6 shadow-[var(--shadow-float)] ring-1 ring-ink-200/70"
        >
          <div className="flex items-center justify-between gap-2">
            <ConfidenceBadge kind="example" label={copy.common.example} />
            <span className="text-xs font-medium text-ink-500">{copy.common.taxYearPill}</span>
          </div>
          <p className="mt-6 text-sm font-medium text-ink-600">
            {copy.panel.takeHome} · {copy.common.perMonth}
          </p>
          <p className="money mt-1 text-[2.6rem] leading-none font-semibold tracking-tight text-brand-800">
            {formatRand(r.takeHomeMonthly)}
          </p>
          <div className="mt-6 grid grid-cols-2 gap-3">
            <MiniStat label={`${copy.panel.paye} · ${copy.common.perMonth}`} value={formatRand(r.monthlyPaye)} />
            <MiniStat label={copy.panel.rows.uif.label} value={formatRand(r.uifMonthly)} />
            <MiniStat label={copy.panel.rows.retirement.label} value={formatRand(r.retirement.deductionMonthly)} />
            <MiniStat label={copy.panel.rows.medical.label} value={formatRand(r.medical6A.monthlyCredit)} />
          </div>
          <div aria-hidden="true" className="mt-6 h-3 overflow-hidden rounded-full bg-ink-100">
            <div className="hero-bar flex h-full origin-left gap-0.5">
              {top.map((b) => (
                <span
                  key={b.index}
                  className={b.isTopBracket ? "bg-bracket-5" : "bg-bracket-2"}
                  style={{ width: `${(b.amountInBracket / r.taxableIncome) * 100}%` }}
                />
              ))}
            </div>
          </div>
          <div className="mt-2.5 flex items-center justify-between gap-3 text-[11px] text-ink-500">
            <span className="money">{top.map((b) => formatPercent(b.rate)).join(" · ")}</span>
            {topBracket && (
              <span className="font-semibold text-brand-700">{copy.panel.topBracket(formatPercent(topBracket.rate))}</span>
            )}
          </div>
        </div>
      </div>
    </figure>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-ink-50 px-3 py-2.5">
      <p className="text-[11px] leading-tight font-medium text-ink-500">{label}</p>
      <p className="money mt-1 text-sm font-semibold text-ink-900">{value}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

const TRUST_ICONS: IconName[] = ["checkCircle", "browser", "idOff", "tag"];

function TrustStrip() {
  const { rules } = useTaxYear();
  const items = [ruleCopy(rules).trustSars, ...copy.trust.slice(1)];
  return (
    <section aria-label="Why you can trust it" className="border-y border-ink-200/80 bg-surface">
      <Container>
        <ul className="grid grid-cols-1 gap-x-6 gap-y-3 py-5 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((item, i) => (
            <li key={item} className="flex items-center gap-2.5 text-sm font-medium text-ink-800">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700">
                <Icon name={TRUST_ICONS[i]!} className="h-4.5 w-4.5" />
              </span>
              {item}
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}

function HowItWorks() {
  const h = copy.how;
  return (
    <section id="how-it-works" aria-labelledby="how-heading" className="scroll-mt-20 py-16 sm:py-24">
      <Container>
        <SectionHeading id="how-heading" title={h.heading} sub={h.sub} />
        <ol className="grid gap-4 md:grid-cols-3 md:gap-6">
          {h.steps.map((step, i) => (
            <li key={step.title} className="relative rounded-[var(--radius-card)] bg-surface p-6 shadow-[var(--shadow-card)] ring-1 ring-ink-200/70">
              <span
                aria-hidden="true"
                className="money grid h-10 w-10 place-items-center rounded-full bg-brand-700 text-base font-semibold text-white"
              >
                {i + 1}
              </span>
              <h3 className="mt-5 text-lg leading-snug font-bold text-ink-950">{step.title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-ink-600">{step.body}</p>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  );
}

function DashboardPreview() {
  const p = copy.preview;
  const { taxYear } = useTaxYear();
  // The example is worked out once, for the default year. Say so when another year has been chosen.
  const exampleYear = yearCopy(rulesFor(DEFAULT_TAX_YEAR)).label;
  return (
    <section aria-labelledby="preview-heading" className="bg-brand-950 py-16 text-white sm:py-24">
      <Container className="grid items-center gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
        <div>
          <h2 id="preview-heading" className="text-2xl font-bold tracking-tight sm:text-3xl">
            {p.heading}
          </h2>
          <p className="mt-3 max-w-md text-lg text-brand-100">{p.sub}</p>
          {taxYear !== DEFAULT_TAX_YEAR && (
            <p data-testid="example-year-note" className="mt-3 max-w-md text-sm font-semibold text-brand-200">
              {ruleCopy(rulesFor(taxYear)).exampleNote(exampleYear)}
            </p>
          )}
          <ul className="mt-8 space-y-3 text-[15px] text-brand-50">
            {[copy.panel.takeHomeHint, copy.panel.payeHint, copy.panel.bracketHint].map((line) => (
              <li key={line} className="flex gap-3">
                <Icon name="check" className="mt-0.5 h-5 w-5 shrink-0 text-brand-300" />
                {line}
              </li>
            ))}
          </ul>
          <div className="mt-8">
            <ButtonLink to="/wizard" variant="secondary" icon="arrowRight">
              {copy.nav.cta}
            </ButtonLink>
          </div>
        </div>
        {/* min-w-0 lets wide tables scroll inside the panel instead of stretching the grid column. */}
        <div className="min-w-0 text-ink-900">
          <TaxSummaryPanel
            result={EXAMPLE_RESULT}
            badges={[{ kind: "example", label: copy.common.example }]}
            caption={p.exampleLabel}
          />
        </div>
      </Container>
    </section>
  );
}

function Capabilities() {
  const c = copy.capabilities;
  const { rules } = useTaxYear();
  const figures = ruleCopy(rules).capability;
  return (
    <section aria-labelledby="capabilities-heading" className="py-16 sm:py-24">
      <Container>
        <SectionHeading id="capabilities-heading" title={c.heading} />
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {c.items.map((item) => (
            <li key={item.title} className="flex gap-4 rounded-2xl bg-surface p-5 ring-1 ring-ink-200/80 sm:block">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700">
                <Icon name={item.icon} />
              </span>
              <div>
                <h3 className="font-bold text-ink-950 sm:mt-4">{item.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-ink-600">{figures[item.icon] ?? item.body}</p>
              </div>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}

function PrivacyPromise() {
  const p = copy.privacy;
  return (
    <section id="privacy" aria-labelledby="privacy-heading" className="scroll-mt-20 pb-16 sm:pb-24">
      <Container>
        <div className="grid gap-8 rounded-[var(--radius-card)] bg-brand-50 p-6 ring-1 ring-brand-100 sm:p-10 md:grid-cols-[auto_1fr] md:gap-12">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-brand-700 text-white">
            <Icon name="lock" className="h-7 w-7" />
          </span>
          <div>
            <h2 id="privacy-heading" className="text-2xl font-bold tracking-tight text-ink-950 sm:text-3xl">
              {p.heading}
            </h2>
            <ul className="mt-6 grid gap-4 sm:grid-cols-2">
              {p.lines.map((line) => (
                <li key={line} className="flex gap-3 text-[15px] leading-relaxed text-ink-800">
                  <Icon name="checkCircle" className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" />
                  {line}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Container>
    </section>
  );
}
