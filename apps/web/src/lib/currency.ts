/**
 * Reading and showing rand amounts typed or pasted by people (PRD §9).
 *
 * People write amounts many ways: "30000", "R30 000", "30,000.00", "30 000,50", "1.234,56".
 * We work out which mark is the decimal point, then show the amount the South African way
 * ("30 000,50") as they type. The model underneath is always a plain number.
 */

export interface AmountParts {
  negative: boolean;
  /** Digits only, no leading zeros (except a single "0"). */
  integer: string;
  /** Digits after the decimal mark (at most 2), "" right after the mark is typed, null if no mark. */
  fraction: string | null;
}

/** Keeps the whole part comfortably inside what JavaScript numbers hold exactly (and the engine's R1 trillion cap). */
const MAX_INTEGER_DIGITS = 13;

const SPACES = /[Rr\s   ]/g;
const MINUS = /^[-−–]+/;

/** Where the decimal mark is in a string of digits, commas and dots; -1 if there isn't one. */
function findDecimalMark(s: string): number {
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma === -1 && lastDot === -1) return -1;
  // Both present: the one that comes last is the decimal mark ("1,234.56" and "1.234,56").
  if (lastComma !== -1 && lastDot !== -1) return Math.max(lastComma, lastDot);

  const mark = lastComma !== -1 ? "," : ".";
  const at = Math.max(lastComma, lastDot);
  const count = s.split(mark).length - 1;
  const digitsAfter = s.length - at - 1;

  // A single comma followed by exactly three digits is a thousands separator ("30,000").
  if (count === 1) return mark === "," && digitsAfter === 3 ? -1 : at;
  // Repeated marks are thousands separators ("1,234,567"), unless the last group is short ("1,234,5").
  return digitsAfter === 3 ? -1 : at;
}

export function parseAmountParts(raw: string): AmountParts {
  let s = raw.replace(SPACES, "");
  const negative = MINUS.test(s);
  s = s.replace(MINUS, "").replace(/[^\d.,]/g, "");

  const at = findDecimalMark(s);
  const integerSource = at === -1 ? s : s.slice(0, at);
  const fraction = at === -1 ? null : s.slice(at + 1).replace(/\D/g, "").slice(0, 2);
  const integer = integerSource
    .replace(/\D/g, "")
    .replace(/^0+(?=\d)/, "")
    .slice(0, MAX_INTEGER_DIGITS);

  return { negative, integer, fraction };
}

/** The number a set of parts stands for; null when no digits have been typed. */
export function amountValue(parts: AmountParts): number | null {
  if (parts.integer === "" && !parts.fraction) {
    if (parts.fraction === null) return null;
    // A bare "," or "," + nothing: treat as no amount yet.
    return parts.integer === "" ? null : 0;
  }
  const n = Number(`${parts.integer || "0"}${parts.fraction ? `.${parts.fraction}` : ""}`);
  return parts.negative && n !== 0 ? -n : n;
}

export function amountFromText(raw: string): number | null {
  return amountValue(parseAmountParts(raw));
}

function group(integerDigits: string): string {
  return integerDigits.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

/** What to show while the person is still typing: "30 000", "30 000,5", "-1 200". */
export function formatWhileTyping(parts: AmountParts): string {
  const sign = parts.negative ? "-" : "";
  if (parts.integer === "" && parts.fraction === null) return sign;
  return `${sign}${group(parts.integer || "0")}${parts.fraction === null ? "" : `,${parts.fraction}`}`;
}

/** What to show once they leave the field: two decimals ("30 000,00"), or whole numbers for things like kilometres. */
export function formatFinal(value: number, decimals: 0 | 2 = 2): string {
  if (!Number.isFinite(value)) return "";
  const sign = value < 0 ? "-" : "";
  if (decimals === 0) return `${sign}${group(Math.abs(Math.round(value)).toString())}`;
  const [whole = "0", cents = "00"] = Math.abs(value).toFixed(2).split(".");
  return `${sign}${group(whole)},${cents}`;
}

/**
 * Where the cursor should go after reformatting. Counts the digits that sat before the cursor
 * in what the person typed and finds the same spot in the new text, so spaces being added or
 * removed never push the cursor around.
 */
export function caretAfterFormat(typed: string, typedCaret: number, formatted: string): number {
  if (typedCaret >= typed.length) return formatted.length;
  const digitsBefore = typed.slice(0, typedCaret).replace(/\D/g, "").length;
  if (digitsBefore === 0) return formatted.startsWith("-") ? 1 : 0;
  let seen = 0;
  for (let i = 0; i < formatted.length; i++) {
    if (/\d/.test(formatted[i]!)) seen++;
    if (seen === digitsBefore) return i + 1;
  }
  return formatted.length;
}
