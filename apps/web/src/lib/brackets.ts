import type { BracketWalkRow } from "@taxclarity/tax-engine";
import { copy } from "../content/strings.ts";
import { formatRand } from "./format.ts";

/** "R 0 – R 245 100", "R 1 878 601 and above": the range a SARS bracket covers. */
export function bracketRange(b: BracketWalkRow): string {
  const from = formatRand(b.index === 0 ? 0 : b.from + 1, { decimals: 0 });
  return b.to === null ? `${from} ${copy.panel.andAbove}` : `${from} – ${formatRand(b.to, { decimals: 0 })}`;
}
