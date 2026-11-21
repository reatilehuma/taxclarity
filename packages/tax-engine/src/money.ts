import DecimalBase from "decimal.js";

/**
 * Decimal type used for all engine arithmetic (PRD §10.1: no raw float maths).
 * A private clone so the configuration never leaks to other code using decimal.js.
 */
export const Decimal = DecimalBase.clone({
  precision: 40,
  rounding: DecimalBase.ROUND_HALF_UP,
});
export type Decimal = InstanceType<typeof Decimal>;

export const ZERO = new Decimal(0);

export function dec(value: number | string | Decimal): Decimal {
  return new Decimal(value);
}

/** Round half-up to cents (PRD §6.4.3). */
export function round2(value: Decimal): Decimal {
  return value.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

/** Convert to a plain number rounded to cents, for results. */
export function toCents(value: Decimal): number {
  return round2(value).toNumber();
}

export function maxD(a: Decimal, b: Decimal): Decimal {
  return a.greaterThan(b) ? a : b;
}

export function minD(a: Decimal, b: Decimal): Decimal {
  return a.lessThan(b) ? a : b;
}

/** Turn any user-supplied number into a safe, non-negative amount. */
export function sanitiseAmount(value: number): Decimal {
  if (!Number.isFinite(value) || value <= 0) return ZERO;
  return dec(Math.min(value, MAX_AMOUNT));
}

/**
 * Largest amount the engine accepts (R1 trillion). Far above any real salary
 * (the UI warns from R10 million a month) but small enough that every result
 * stays a finite JavaScript number (PRD §17.6).
 */
export const MAX_AMOUNT = 1e12;
