/**
 * Why a tax year could not be used (PRD §10.5). The UI turns these into a recoverable message; the engine
 * never answers a problem with "use another year instead".
 *
 * - UNKNOWN_YEAR: no rule set exists for that year.
 * - UNVERIFIED_YEAR: the rule set exists but is still a draft and this caller does not allow drafts.
 * - YEAR_MISMATCH: inputs for one year were given to the rules of another.
 */
export type TaxYearErrorCode = "UNKNOWN_YEAR" | "UNVERIFIED_YEAR" | "YEAR_MISMATCH";

export class TaxYearError extends Error {
  readonly code: TaxYearErrorCode;
  /** The year that was asked for. */
  readonly year: string;

  constructor(code: TaxYearErrorCode, year: string, message: string) {
    super(message);
    this.name = "TaxYearError";
    this.code = code;
    this.year = year;
  }
}
