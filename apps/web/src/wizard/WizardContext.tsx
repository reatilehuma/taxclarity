import { createYearCalculator, type CalculationResult, type TaxRuleSet, type TaxYear } from "@taxclarity/tax-engine";
import { createContext, useContext, useMemo, useReducer, useState, type ReactNode } from "react";
import { isSelectableYear, rulesFor, YEAR_OPTIONS } from "../lib/years.ts";
import {
  ageNeedsConfirmation,
  applyPatch,
  changeTaxYear,
  hasMinimumAnswers,
  INITIAL_ANSWERS,
  toEngineInputs,
  type WizardAnswers,
} from "./answers.ts";

/**
 * One shared, memoised calculator: the same answers never get calculated twice (PRD §18). It picks the rules from
 * the answers' tax year and keeps one cache for every year, keyed on year and rules version, so a result from one
 * year can never be shown for another.
 */
export const calculate = createYearCalculator(YEAR_OPTIONS);

type Action =
  | { type: "patch"; patch: Partial<WizardAnswers> }
  | { type: "year"; year: TaxYear }
  | { type: "confirmAge" }
  | { type: "reset" };

function reducer(state: WizardAnswers, action: Action): WizardAnswers {
  switch (action.type) {
    case "reset":
      return INITIAL_ANSWERS;
    case "year":
      return changeTaxYear(state, action.year);
    case "confirmAge":
      return state.ageBandYear === state.taxYear ? state : { ...state, ageBandYear: state.taxYear };
    case "patch":
      return applyPatch(state, action.patch);
  }
}

interface WizardApi {
  answers: WizardAnswers;
  update: (patch: Partial<WizardAnswers>) => void;
  reset: () => void;
  /** The rule set for the year the person chose. */
  rules: TaxRuleSet;
  /** Switches the tax year. Years that cannot be offered are ignored. */
  setTaxYear: (year: TaxYear) => void;
  /** The age group is still right for the year on screen. Asked after a year change that could alter it. */
  confirmAge: () => void;
  /** The year the person just switched to, until they dismiss the message (PRD §8). */
  yearNotice: TaxYear | null;
  dismissYearNotice: () => void;
}

const WizardContext = createContext<WizardApi | null>(null);

/**
 * Keeps the answers in memory for as long as the page is open. Nothing is written to storage,
 * so a refresh starts the wizard again, and back on the default year (PRD §8, §17.1; Q1 stays "no" for v1).
 */
export function WizardProvider({ children, initial = INITIAL_ANSWERS }: { children: ReactNode; initial?: WizardAnswers }) {
  const [answers, dispatch] = useReducer(reducer, initial);
  const [yearNotice, setYearNotice] = useState<TaxYear | null>(null);
  // The actions never change identity, so effects that call them don't re-run when answers change.
  const actions = useMemo(
    () => ({
      update: (patch: Partial<WizardAnswers>) => dispatch({ type: "patch", patch }),
      reset: () => {
        dispatch({ type: "reset" });
        setYearNotice(null);
      },
      setTaxYear: (year: TaxYear) => {
        if (!isSelectableYear(year)) return;
        dispatch({ type: "year", year });
        setYearNotice(year);
      },
      confirmAge: () => dispatch({ type: "confirmAge" }),
      dismissYearNotice: () => setYearNotice(null),
    }),
    [],
  );
  const rules = useMemo(() => rulesFor(answers.taxYear), [answers.taxYear]);
  const api = useMemo<WizardApi>(() => ({ answers, rules, yearNotice, ...actions }), [answers, rules, yearNotice, actions]);
  return <WizardContext.Provider value={api}>{children}</WizardContext.Provider>;
}

export function useWizard(): WizardApi {
  const ctx = useContext(WizardContext);
  if (!ctx) throw new Error("useWizard must be used inside <WizardProvider>");
  return ctx;
}

/** The rule set for the chosen year, and the way to change it. */
export function useTaxYear(): { taxYear: TaxYear; rules: TaxRuleSet; setTaxYear: (year: TaxYear) => void } {
  const { answers, rules, setTaxYear } = useWizard();
  return { taxYear: answers.taxYear, rules, setTaxYear };
}

/**
 * The engine result for the current answers, or null until there are enough of them. Also null while the age group
 * waits to be confirmed after a year change: no numbers are shown until it is.
 */
export function useWizardResult(): CalculationResult | null {
  const { answers } = useWizard();
  return useMemo(() => previewResult(answers), [answers]);
}

/**
 * The engine's view of the answers so far, for notes inside a step (the retirement percentage,
 * the carry-forward note, warnings). Null until there are enough answers, and while the age group needs confirming.
 * All figures come from the engine; steps only choose what to show.
 */
export function previewResult(answers: WizardAnswers): CalculationResult | null {
  if (ageNeedsConfirmation(answers) || !hasMinimumAnswers(answers)) return null;
  return calculate(toEngineInputs(answers));
}
