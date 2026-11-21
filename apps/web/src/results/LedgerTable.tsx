import type { BreakdownRow } from "@taxclarity/tax-engine";
import { InfoTip } from "../components/InfoTip.tsx";
import { copy } from "../content/strings.ts";
import { formatRand } from "../lib/format.ts";

const t = copy.results.breakdown;

export interface LedgerLabel {
  label: string;
  hint: string;
}

/**
 * One block of the results page as a table (PRD §14.2). Every figure and every row comes from the
 * engine's breakdown; this only lays it out: "+" and "−" in front of amounts that add or come off,
 * a heavier line for subtotals and the final line, and an explanation on every row.
 */
export function LedgerTable({
  caption,
  rows,
  columns,
  describe,
}: {
  caption: string;
  rows: BreakdownRow[];
  columns: "monthAndYear" | "yearOnly";
  describe: (row: BreakdownRow) => LedgerLabel;
}) {
  const both = columns === "monthAndYear";
  return (
    <div className="overflow-x-auto rounded-2xl bg-surface ring-1 ring-ink-200">
      <table className="w-full text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="bg-ink-50 text-xs text-ink-500">
            <th scope="col" className="px-2.5 py-2.5 text-left font-medium sm:px-4">
              <span className="sr-only">{t.colLabel}</span>
            </th>
            {both && (
              <th scope="col" className="px-1.5 py-2.5 text-right font-medium sm:px-3">
                {t.colMonth}
              </th>
            )}
            <th scope="col" className="px-2.5 py-2.5 text-right font-medium sm:px-4">
              {both ? t.colYear : t.colYearOnly}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <Line key={row.id} row={row} first={i === 0} both={both} {...describe(row)} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

const ROW_STYLE: Record<BreakdownRow["kind"], string> = {
  add: "text-ink-800",
  less: "text-ink-800",
  subtotal: "bg-ink-50 font-semibold text-ink-950",
  total: "bg-brand-50 font-bold text-brand-900",
  memo: "text-ink-600",
};

function Line({ row, first, both, label, hint }: { row: BreakdownRow; first: boolean; both: boolean } & LedgerLabel) {
  return (
    <tr className={`border-t border-ink-100 ${ROW_STYLE[row.kind]}`}>
      <th scope="row" className="px-2.5 py-2.5 text-left font-[inherit] sm:px-4">
        <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
          <span className={row.kind === "memo" || row.kind === "add" || row.kind === "less" ? "font-normal" : ""}>{label}</span>
          <InfoTip label={label} hint={hint} />
        </span>
      </th>
      {both && (
        <td className="money px-1.5 py-2.5 text-right text-[13px] whitespace-nowrap sm:px-3 sm:text-sm">
          {row.monthly === null ? <Nothing /> : <Amount value={row.monthly} kind={row.kind} first={first} />}
        </td>
      )}
      <td className="money px-2.5 py-2.5 text-right text-[13px] whitespace-nowrap sm:px-4 sm:text-sm">
        <Amount value={row.annual} kind={row.kind} first={first} />
      </td>
    </tr>
  );
}

function Nothing() {
  return (
    <>
      <span aria-hidden="true" className="text-ink-300">
        —
      </span>
      <span className="sr-only">{t.none}</span>
    </>
  );
}

/** "− R 3 000,00": the sign is for the eye; a screen reader hears "minus". */
function Amount({ value, kind, first }: { value: number; kind: BreakdownRow["kind"]; first: boolean }) {
  const sign = kind === "less" ? "−" : kind === "add" && !first ? "+" : null;
  return (
    <>
      {sign && (
        <>
          <span aria-hidden="true" className="mr-0.5 text-ink-400 sm:mr-1">
            {sign}
          </span>
          <span className="sr-only">{sign === "−" ? t.minus : t.plus} </span>
        </>
      )}
      {formatRand(value)}
    </>
  );
}
