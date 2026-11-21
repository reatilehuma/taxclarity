import type { FaqItem } from "../components/forms/Faq.tsx";
import { copy, RETIREMENT_LIMIT_QUESTION, ruleCopy, yearCopy } from "../content/strings.ts";
import { formatRand } from "../lib/format.ts";
import { rulesFor } from "../lib/years.ts";
import {
  extrasFilledCount,
  isAmountValid,
  isExtrasComplete,
  isMedicalComplete,
  isPayslipComplete,
  isRetirementComplete,
  isVariableComplete,
  payslipApplies,
  type WizardAnswers,
} from "./answers.ts";

/**
 * The wizard's steps, in order (PRD §8, numbered as D6 settled): 0 start, 1 amount, 2 age,
 * 3 retirement, 4 medical aid, 5 variable pay, 6 optional extras, 7 payslip check (gross and
 * payslip modes only), 8 review. The page, progress bar and routing follow this list.
 */
export type StepId = "start" | "amount" | "age" | "retirement" | "medical" | "variable" | "extras" | "payslip" | "review";

export interface StepDef {
  id: StepId;
  /** Short name used in the progress announcement, e.g. "Step 1 of 8: Your pay". */
  title: string;
  /** Is this step finished enough to move on? Also decides how far a page address may jump ahead. */
  isComplete: (a: WizardAnswers) => boolean;
  /** Steps that don't apply to some answers (like the payslip check) are left out of the flow. */
  applies?: (a: WizardAnswers) => boolean;
  /** A different label for the main button, like "Skip" when nothing has been filled in. */
  primaryLabel?: (a: WizardAnswers) => string | undefined;
  faq: (a: WizardAnswers) => FaqItem[];
}

const t = copy.wizard;
const rand0 = (n: number) => formatRand(n, { decimals: 0 });

export const STEPS: readonly StepDef[] = [
  {
    id: "start",
    title: t.stepTitles.start,
    isComplete: (a) => a.mode !== null,
    faq: () => [...t.start.faq],
  },
  {
    id: "amount",
    title: t.stepTitles.amount,
    isComplete: isAmountValid,
    faq: (a) => [...t.amount.faq[a.mode ?? "GROSS"], t.amount.faq.frequency],
  },
  {
    id: "age",
    title: t.stepTitles.age,
    isComplete: () => true,
    // The age answer is "on the last day of the tax year", so the date in the FAQ follows the chosen year.
    faq: (a) => t.age.faq.map((item, i) => (i === 1 ? { ...item, answer: yearCopy(rulesFor(a.taxYear)).ageFaqAnswer } : item)),
  },
  {
    id: "retirement",
    title: t.stepTitles.retirement,
    isComplete: isRetirementComplete,
    // The yearly limit quoted in the FAQ is the chosen year's.
    faq: (a) =>
      t.retirement.faq.map((item) =>
        item.question === RETIREMENT_LIMIT_QUESTION ? { ...item, answer: ruleCopy(rulesFor(a.taxYear)).retirementLimitFaq } : item,
      ),
  },
  {
    id: "medical",
    title: t.stepTitles.medical,
    isComplete: isMedicalComplete,
    faq: (a) => [
      t.medical.faq[0]!,
      {
        question: t.medical.creditFaq.question,
        answer: t.medical.creditFaq.answer(
          rand0(rulesFor(a.taxYear).medical6A.monthlyMain),
          rand0(rulesFor(a.taxYear).medical6A.monthlyFirstDep),
          rand0(rulesFor(a.taxYear).medical6A.monthlyAdditionalDep),
        ),
      },
      ...t.medical.faq.slice(1),
    ],
  },
  {
    id: "variable",
    title: t.stepTitles.variable,
    isComplete: isVariableComplete,
    faq: () => [...t.variable.faq],
  },
  {
    id: "extras",
    title: t.stepTitles.extras,
    isComplete: isExtrasComplete,
    // Everything here is optional: with nothing filled in, the button says "Skip".
    primaryLabel: (a) => (extrasFilledCount(a) === 0 ? t.nav.skip : undefined),
    faq: (a) => [
      t.extras.faq[0]!,
      {
        question: t.extras.faq[1]!.question,
        answer: t.extras.faq[1]!.answer(
          rand0(rulesFor(a.taxYear).interestExemption.under65),
          rand0(rulesFor(a.taxYear).interestExemption.age65plus),
        ),
      },
      t.extras.faq[2]!,
    ],
  },
  {
    id: "payslip",
    title: t.stepTitles.payslip,
    applies: payslipApplies,
    isComplete: isPayslipComplete,
    faq: () => [...t.payslip.faq],
  },
  {
    id: "review",
    title: t.stepTitles.review,
    isComplete: () => true,
    faq: () => [...t.review.faq],
  },
];

/** The steps that apply to these answers. */
export function flowFor(a: WizardAnswers): StepDef[] {
  return STEPS.filter((s) => s.applies?.(a) ?? true);
}

/** Where a step sits in the flow for these answers, or -1 if it isn't part of it. */
export function indexOfStep(a: WizardAnswers, id: StepId): number {
  return flowFor(a).findIndex((s) => s.id === id);
}

/**
 * The furthest step a person may be on: the first one that isn't finished, or `flow.length`
 * when everything is. Stops page addresses like /wizard?step=5 skipping unanswered questions.
 */
export function furthestReachable(flow: readonly StepDef[], a: WizardAnswers): number {
  const firstUnfinished = flow.findIndex((s) => !s.isComplete(a));
  return firstUnfinished === -1 ? flow.length : firstUnfinished;
}

/**
 * The address of a step. `fromReview` marks a trip from the review screen's Edit links, so
 * finishing the step returns there instead of walking on through the questions.
 */
export const stepUrl = (index: number, { fromReview = false }: { fromReview?: boolean } = {}) =>
  `/wizard?step=${index}${fromReview ? "&from=review" : ""}`;

/** Reads ?step=. Anything that isn't a whole number counts as the first step. */
export function parseStep(param: string | null): number {
  return param !== null && /^\d{1,3}$/.test(param) ? Number(param) : 0;
}
