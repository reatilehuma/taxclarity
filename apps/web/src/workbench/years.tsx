import type { CalculationResult, TaxRuleSet } from "@taxclarity/tax-engine";
import { formatPercent, formatRand } from "../lib/format.ts";
import { SOURCES } from "../lib/sources.ts";
import { Card } from "./inputs.tsx";
import { compareRows, parameterRows, ruleSetFacts } from "./years.ts";

/** Workbench views for the tax-year work: a draft banner, a side-by-side comparison and the parameter list. */

export function DraftBanner({ rules }: { rules: TaxRuleSet }) {
  if (rules.status === "verified") return null;
  return (
    <div role="status" className="border-b border-amber-300 bg-amber-100 px-4 py-2.5 text-sm text-amber-950">
      <div className="mx-auto max-w-6xl">
        <strong>Draft: not signed off.</strong> The {rules.label} figures are sourced (see the Parameters view) but nobody has
        reviewed them yet. This year can only be used here in development, never in a production build.
      </div>
    </div>
  );
}

const show = (n: number, kind: "money" | "percent") => (kind === "percent" ? formatPercent(n) : formatRand(n));

export function CompareYears({
  first,
  second,
  firstResult,
  secondResult,
}: {
  first: TaxRuleSet;
  second: TaxRuleSet;
  firstResult: CalculationResult;
  secondResult: CalculationResult;
}) {
  const rows = compareRows(firstResult, secondResult);
  return (
    <Card>
      <h2 className="mb-1 text-base font-semibold text-slate-900">
        Same inputs, {first.label} and {second.label}
      </h2>
      <p className="mb-3 text-xs text-slate-500">
        Every number comes from running your inputs through each year's own rule set. Rows that differ are highlighted.
        {(first.status === "draft" || second.status === "draft") && " A draft year is not signed off."}
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] text-sm">
          <caption className="sr-only">
            Comparison of {first.label} and {second.label}
          </caption>
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
              <th scope="col" className="py-2 font-medium">
                Line
              </th>
              <th scope="col" className="py-2 pl-3 text-right font-medium">
                {first.label}
                {first.status === "draft" && <span className="ml-1 text-amber-700">(draft)</span>}
              </th>
              <th scope="col" className="py-2 pl-3 text-right font-medium">
                {second.label}
                {second.status === "draft" && <span className="ml-1 text-amber-700">(draft)</span>}
              </th>
              <th scope="col" className="py-2 pl-3 text-right font-medium">
                Difference
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const differs = r.a !== r.b;
              const diff = r.b - r.a;
              return (
                <tr key={r.label} className={`border-b border-slate-100 ${differs ? "bg-amber-50" : ""}`}>
                  <th scope="row" className="py-2 text-left font-normal">
                    {r.label}
                  </th>
                  <td className="money py-2 pl-3 text-right">{show(r.a, r.kind)}</td>
                  <td className="money py-2 pl-3 text-right">{show(r.b, r.kind)}</td>
                  <td className="money py-2 pl-3 text-right">
                    {differs ? (
                      <>
                        {diff > 0 ? "+" : "−"}
                        {show(Math.abs(diff), r.kind)}
                      </>
                    ) : (
                      <span className="text-slate-400">same</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export function ParametersView({ rules }: { rules: TaxRuleSet }) {
  const rows = parameterRows(rules);
  const groups = [...new Set(rows.map((r) => r.group))];
  return (
    <Card>
      <h2 className="mb-3 text-base font-semibold text-slate-900">Parameters for {rules.label}</h2>
      <dl className="mb-4 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
        {ruleSetFacts(rules).map((f) => (
          <div key={f.label} className="flex justify-between gap-3 border-b border-slate-100 py-1">
            <dt className="text-slate-500">{f.label}</dt>
            <dd className="text-right font-medium text-slate-900">{f.value}</dd>
          </div>
        ))}
      </dl>
      {groups.map((g) => (
        <section key={g} aria-labelledby={`param-${g}`} className="mb-4 last:mb-0">
          <h3 id={`param-${g}`} className="mb-1 text-sm font-semibold text-slate-900">
            {g}
          </h3>
          <table className="w-full text-sm">
            <caption className="sr-only">{g}</caption>
            <tbody>
              {rows
                .filter((r) => r.group === g)
                .map((r) => (
                  <tr key={r.label} className="border-b border-slate-100 align-top">
                    <th scope="row" className="w-2/5 py-1.5 pr-3 text-left font-normal text-slate-600">
                      {r.label}
                    </th>
                    <td className="money py-1.5 pr-3 text-slate-900">{r.value}</td>
                    <td className="py-1.5 text-right text-xs">
                      {r.sources.map((id, i) => (
                        <span key={id}>
                          {i > 0 && ", "}
                          <a
                            href={SOURCES[id].url}
                            target="_blank"
                            rel="noreferrer noopener"
                            title={SOURCES[id].title}
                            className="text-brand-700 underline underline-offset-2"
                          >
                            {id}
                          </a>
                        </span>
                      ))}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </section>
      ))}
      <h3 className="mt-5 mb-1 text-sm font-semibold text-slate-900">Sources used</h3>
      <ul className="space-y-0.5 text-xs text-slate-600">
        {[...new Set(rows.flatMap((r) => r.sources))].sort().map((id) => (
          <li key={id}>
            <span className="font-mono">{id}</span> ·{" "}
            <a href={SOURCES[id].url} target="_blank" rel="noreferrer noopener" className="text-brand-700 underline underline-offset-2">
              {SOURCES[id].title}
            </a>
          </li>
        ))}
      </ul>
    </Card>
  );
}
