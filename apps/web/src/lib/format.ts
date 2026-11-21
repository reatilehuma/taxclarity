/**
 * South African display formatting (PRD §9, §17.5): "R 30 000,00".
 * Thousands are separated by a non-breaking space so amounts never wrap,
 * and decimals use a comma.
 */
const NBSP = " ";

function groupThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
}

export function formatRand(value: number, options: { decimals?: 0 | 2 } = {}): string {
  const decimals = options.decimals ?? 2;
  if (!Number.isFinite(value)) return `R${NBSP}0${decimals ? ",00" : ""}`;
  const negative = value < 0;
  const [whole = "0", cents] = Math.abs(value).toFixed(decimals).split(".");
  const body = `R${NBSP}${groupThousands(whole)}${cents ? `,${cents}` : ""}`;
  return negative ? `−${body}` : body;
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** "2026-03-01" → "1 March 2026" (PRD §17.5). Parses the ISO date itself, so time zones can't shift the day. */
export function formatDate(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!match) return iso;
  const [, year, month, day] = match;
  const name = MONTHS[Number(month) - 1];
  return name ? `${Number(day)} ${name} ${year}` : iso;
}

/** A figure that is already a percentage: 11.1 → "11,1%". */
export function formatPercentPoints(points: number, decimals = 1): string {
  if (!Number.isFinite(points)) return "0%";
  const text = Number.isInteger(points) ? String(points) : points.toFixed(decimals).replace(".", ",");
  return `${text}%`;
}

/** 0.26 → "26%", 0.15634 → "15,6%". */
export function formatPercent(rate: number, decimals = 1): string {
  if (!Number.isFinite(rate)) return "0%";
  const pct = rate * 100;
  const text = Number.isInteger(pct) ? String(pct) : pct.toFixed(decimals).replace(".", ",");
  return `${text}%`;
}
