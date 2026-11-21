import { figuresIn } from "./allowlist.ts";
import type { AssistantPayload } from "./types.ts";

/**
 * The "no invented numbers" check (PRD §15.2.1). The assistant may quote figures the calculator produced and
 * must never work out new ones. This finds every rand amount in a reply and checks it is one of the figures it
 * was given. A reply that quotes any other amount fails and is not shown.
 */

/**
 * Rand amounts as people write them: "R 3 149,00", "R3149", "R4,250", "R4 250.50".
 * The amount must start with a digit; trailing punctuation belongs to the sentence, not the figure.
 */
const RAND = /R[\s ]?\d[\d\s ]*(?:[.,]\d+)?/g;

/** Turns the text of one amount into a number, or null when it can't be read. */
export function parseRand(text: string): number | null {
  let s = text.replace(/^R/, "").replace(/[\s ]/g, "");
  if (s === "") return null;
  const hasComma = s.includes(",");
  const hasDot = s.includes(".");
  if (hasComma && hasDot) {
    // The separator that comes last is the decimal point; the other groups thousands.
    const decimal = s.lastIndexOf(",") > s.lastIndexOf(".") ? "," : ".";
    const thousands = decimal === "," ? "." : ",";
    s = s.split(thousands).join("").replace(decimal, ".");
  } else if (hasComma) {
    // "4,250" is thousands (a group of exactly three digits); "4,25" and "4,2" are decimals.
    s = /^\d{1,3}(,\d{3})+$/.test(s) ? s.replace(/,/g, "") : s.replace(",", ".");
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Every rand amount written in the text, in order. */
export function randAmountsIn(text: string): number[] {
  return [...text.matchAll(RAND)].map((m) => parseRand(m[0].trim())).filter((n): n is number => n !== null);
}

export interface FigureCheck {
  ok: boolean;
  /** Amounts quoted that the calculator did not provide. */
  invented: number[];
  /** Amounts quoted that match the calculator's figures. */
  matched: number[];
}

/** R0 is allowed anywhere ("you owe R0"): it is not a calculation. */
export function checkRandFigures(text: string, payload: AssistantPayload): FigureCheck {
  const allowed = figuresIn(payload);
  const known = (n: number) => n === 0 || allowed.some((a) => Math.abs(Math.abs(a) - Math.abs(n)) < 0.005);
  const invented: number[] = [];
  const matched: number[] = [];
  for (const n of randAmountsIn(text)) (known(n) ? matched : invented).push(n);
  return { ok: invented.length === 0, invented, matched };
}
