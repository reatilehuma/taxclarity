/**
 * A row of connected options where one is chosen (PRD §9: arrow keys switch options).
 * Real radio buttons underneath, so the keyboard and screen readers work without extra code.
 */
export function SegmentedControl<T extends string>({
  legend,
  hideLegend = false,
  name,
  value,
  onChange,
  options,
}: {
  legend: string;
  /** Hide the legend visually when a heading already asks the question. Screen readers still hear it. */
  hideLegend?: boolean;
  name: string;
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <fieldset>
      <legend className={hideLegend ? "sr-only" : "mb-2 text-sm font-semibold text-ink-800"}>{legend}</legend>
      <div
        className="grid gap-1 rounded-xl bg-ink-100 p-1"
        style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
      >
        {options.map((o) => (
          <label
            key={o.value}
            className="flex min-h-11 cursor-pointer items-center justify-center rounded-lg px-2 py-2 text-center text-sm font-semibold text-ink-600 transition-colors hover:text-ink-900 has-checked:bg-surface has-checked:text-brand-800 has-checked:shadow-sm has-focus-visible:outline-2 has-focus-visible:outline-brand-600"
          >
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={value === o.value}
              onChange={() => onChange(o.value)}
              className="sr-only"
            />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
