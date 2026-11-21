import { CurrentTaxRules, type TaxRuleSet } from "@taxclarity/tax-engine";
import { createContext, useContext } from "react";

/**
 * The rule set the Workbench's result views read their labels and limits from. The Workbench provides the one
 * chosen in its year dropdown, so a view never quotes another year's figure. Outside it, the current year.
 */
export const RulesContext = createContext<TaxRuleSet>(CurrentTaxRules);

export function useRules(): TaxRuleSet {
  return useContext(RulesContext);
}
