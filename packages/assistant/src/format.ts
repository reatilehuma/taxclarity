const NBSP = " ";

/** "R 3 149,00": South African style, so replies read like the rest of the app. */
export function rand(value: number, decimals: 0 | 2 = 2): string {
  const negative = value < 0;
  const [whole = "0", cents] = Math.abs(value).toFixed(decimals).split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  return `${negative ? "−" : ""}R${NBSP}${grouped}${cents ? `,${cents}` : ""}`;
}

/** 0.26 gives "26%", 0.155 gives "15,5%". */
export function percent(rate: number): string {
  const points = Math.round(rate * 1000) / 10;
  return `${String(points).replace(".", ",")}%`;
}
