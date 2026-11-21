import type { ComponentType } from "react";
import type { StepId } from "../flow.ts";
import { AgeStep } from "./AgeStep.tsx";
import { AmountStep } from "./AmountStep.tsx";
import { ExtrasStep } from "./ExtrasStep.tsx";
import { MedicalStep } from "./MedicalStep.tsx";
import { PayslipStep } from "./PayslipStep.tsx";
import { RetirementStep } from "./RetirementStep.tsx";
import { ReviewStep } from "./ReviewStep.tsx";
import { StartStep } from "./StartStep.tsx";
import { VariablePayStep } from "./VariablePayStep.tsx";
import type { StepViewProps } from "./shared.tsx";

/** The screen for each step. Add a step in flow.ts and register its screen here. */
export const STEP_VIEWS: Record<StepId, ComponentType<StepViewProps>> = {
  start: StartStep,
  amount: AmountStep,
  age: AgeStep,
  retirement: RetirementStep,
  medical: MedicalStep,
  variable: VariablePayStep,
  extras: ExtrasStep,
  payslip: PayslipStep,
  review: ReviewStep,
};
