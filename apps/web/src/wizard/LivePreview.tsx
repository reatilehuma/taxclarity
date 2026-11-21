import type { CalculationResult } from "@taxclarity/tax-engine";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { AgeConfirm } from "../components/AgeConfirm.tsx";
import { Icon } from "../components/Icon.tsx";
import { TaxSummaryPanel } from "../components/TaxSummaryPanel.tsx";
import { TaxYearSelect } from "../components/TaxYearSelect.tsx";
import { ConfidenceBadge } from "../components/ui.tsx";
import { copy } from "../content/strings.ts";
import { useDebouncedValue } from "../hooks/useDebouncedValue.ts";
import { useMediaQuery } from "../hooks/useMediaQuery.ts";
import { formatRand } from "../lib/format.ts";
import { ageNeedsConfirmation, type WizardAnswers } from "./answers.ts";
import { previewResult } from "./WizardContext.tsx";

const t = copy.live;

/** How long answers must stop changing before the preview recalculates (PRD §12.2). */
export const PREVIEW_DEBOUNCE_MS = 150;

/** The wizard is two columns from this width up (Tailwind's `lg`). Below it the preview is a bar and a sheet. */
export const DESKTOP_QUERY = "(min-width: 1024px)";

/**
 * The live preview (PRD §12.2): a sticky panel beside the questions on a wide screen, and a
 * bottom bar that opens a full-screen sheet on a phone. It shows engine output only; the numbers
 * are recalculated once typing pauses. Only the mode badge is announced to screen readers.
 */
export function LivePreview({ answers, stepIndex }: { answers: WizardAnswers; stepIndex: number }) {
  const settled = useDebouncedValue(answers, PREVIEW_DEBOUNCE_MS);
  // Typing is debounced, but a year change never is: numbers from the year just left must not linger for a moment.
  const current = settled.taxYear === answers.taxYear && settled.ageBandYear === answers.ageBandYear ? settled : answers;
  const result = useMemo(() => previewResult(current), [current]);
  const pending = ageNeedsConfirmation(answers);
  const desktop = useMediaQuery(DESKTOP_QUERY);

  const announcement = result ? (result.confidence === "ESTIMATE" ? t.announce.estimate : t.announce.accurate) : "";

  return (
    <>
      {/* The one live region: it only changes when the estimate / payslip-accurate badge changes. */}
      <p aria-live="polite" aria-atomic="true" className="sr-only" data-testid="preview-announcer">
        {announcement}
      </p>
      {desktop ? <DesktopPanel result={result} pending={pending} /> : <PhoneBar result={result} pending={pending} stepIndex={stepIndex} />}
    </>
  );
}

function PreviewCard({ result, pending, className = "" }: { result: CalculationResult | null; pending: boolean; className?: string }) {
  if (pending) return <PendingPreview className={className} />;
  if (!result) return <EmptyPreview className={className} />;
  const estimate = result.confidence === "ESTIMATE";
  return (
    <TaxSummaryPanel
      result={result}
      badges={[{ kind: estimate ? "estimate" : "accurate", label: estimate ? copy.common.estimate : copy.common.payslipAccurate }]}
      caption={estimate ? t.caption : t.captionAccurate}
      className={className}
    />
  );
}

/** After a year change that could alter the age group: no numbers, just the question that has to be answered first. */
function PendingPreview({ className = "" }: { className?: string }) {
  return (
    <div
      data-testid="preview-pending"
      className={`space-y-3 rounded-[var(--radius-card)] bg-surface p-4 shadow-[var(--shadow-float)] ring-1 ring-ink-200/70 sm:p-6 ${className}`}
    >
      <AgeConfirm name="age-confirm-preview" />
      <p className="text-xs text-ink-500">{copy.taxYear.ageConfirm.waiting}</p>
    </div>
  );
}

/** Placeholder lines shown until there is an amount to calculate with. */
function EmptyPreview({ className = "" }: { className?: string }) {
  const bar = "rounded-md bg-ink-100 motion-safe:animate-pulse";
  return (
    <div
      data-testid="preview-empty"
      className={`rounded-[var(--radius-card)] bg-surface p-4 shadow-[var(--shadow-float)] ring-1 ring-ink-200/70 sm:p-6 ${className}`}
    >
      <ConfidenceBadge kind="example" label={t.emptyBadge} />
      <div aria-hidden="true" className="mt-5 space-y-4">
        <div className={`${bar} h-10 w-3/4`} />
        <div className="grid grid-cols-2 gap-4 border-t border-ink-100 pt-4">
          <div className={`${bar} h-6`} />
          <div className={`${bar} h-6`} />
        </div>
        <div className="space-y-3 pt-1">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className={`${bar} h-4`} />
          ))}
        </div>
        <div className={`${bar} h-3.5 rounded-full`} />
      </div>
      <p className="mt-6 text-base font-semibold text-ink-900">{t.emptyTitle}</p>
      <p className="mt-1 text-sm text-ink-600">{t.emptyBody}</p>
      <p className="mt-4 text-xs text-ink-500">{t.emptyCaption}</p>
    </div>
  );
}

/** Wide screens: the panel stays in view while the questions scroll. */
function DesktopPanel({ result, pending }: { result: CalculationResult | null; pending: boolean }) {
  return (
    <aside aria-label={t.regionLabel} className="self-start lg:sticky lg:top-24">
      <h2 className="sr-only">{t.heading}</h2>
      <TaxYearSelect label={copy.taxYear.previewLabel} className="mb-3" />
      <PreviewCard result={result} pending={pending} className="max-h-[calc(100vh-14rem)] overflow-y-auto overscroll-contain" />
    </aside>
  );
}

/** Phones: a bar fixed to the bottom of the screen. Tapping it opens the full preview. */
function PhoneBar({ result, pending, stepIndex }: { result: CalculationResult | null; pending: boolean; stepIndex: number }) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);

  // Moving to another step (the browser's Back button, say) closes the sheet. Focus is left alone:
  // the wizard is already moving it to the new question.
  const shownStep = useRef(stepIndex);
  useEffect(() => {
    if (shownStep.current === stepIndex) return;
    shownStep.current = stepIndex;
    setOpen(false);
  }, [stepIndex]);

  function close() {
    setOpen(false);
    trigger.current?.focus();
  }

  const figure = (value: number | undefined) => (value === undefined ? t.bar.empty : formatRand(value));

  return (
    <>
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-ink-200 bg-surface/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-10px_28px_-14px_rgb(14_19_18/0.3)] backdrop-blur">
        <button
          ref={trigger}
          type="button"
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => setOpen(true)}
          className="flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left"
        >
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-medium text-ink-500">{t.bar.takeHome}</span>
            <span className="money block truncate text-[15px] font-semibold text-brand-800">{figure(result?.takeHomeMonthly)}</span>
          </span>
          <span aria-hidden="true" className="h-8 w-px bg-ink-200" />
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-medium text-ink-500">{t.bar.paye}</span>
            <span className="money block truncate text-[15px] font-semibold text-ink-900">{figure(result?.monthlyPaye)}</span>
          </span>
          <span className="sr-only">{t.bar.open}</span>
          <Icon name="chevronDown" className="h-5 w-5 shrink-0 rotate-180 text-ink-500" />
        </button>
      </div>
      {open && <PreviewSheet result={result} pending={pending} onClose={close} />}
    </>
  );
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';

/** Full-screen sheet. A modal dialog: focus stays inside, Escape closes it, the page behind can't scroll. */
function PreviewSheet({ result, pending, onClose }: { result: CalculationResult | null; pending: boolean; onClose: () => void }) {
  const titleId = useId();
  const dialog = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButton.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Escape") {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key !== "Tab" || !dialog.current) return;
    // Anything inside a closed <details> (other than its summary) can't be reached, so it isn't a stop.
    const items = [...dialog.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => {
      const closed = el.closest("details:not([open])");
      return !closed || (el.tagName === "SUMMARY" && el.parentElement === closed);
    });
    const first = items[0];
    const last = items[items.length - 1];
    if (!first || !last) return;
    const active = document.activeElement;
    if (e.shiftKey && (active === first || !dialog.current.contains(active))) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && (active === last || !dialog.current.contains(active))) {
      e.preventDefault();
      first.focus();
    }
  }

  return (
    // The dialog traps Tab and closes on Escape; the keys are handled where focus is, inside it.
    // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <div
      ref={dialog}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onKeyDown={onKeyDown}
      className="fixed inset-0 z-50 flex flex-col bg-canvas"
    >
      <div className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-ink-200 bg-surface px-4">
        <h2 id={titleId} className="text-base font-bold text-ink-950">
          {t.sheet.title}
        </h2>
        <button
          ref={closeButton}
          type="button"
          onClick={onClose}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-brand-800 hover:bg-brand-50"
        >
          {t.sheet.close}
          <Icon name="chevronDown" className="h-4 w-4" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4">
        <TaxYearSelect label={copy.taxYear.previewLabel} className="mb-3" />
        <PreviewCard result={result} pending={pending} />
      </div>
    </div>
  );
}
