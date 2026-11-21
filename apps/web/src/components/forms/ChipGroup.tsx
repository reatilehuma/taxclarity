import { Icon } from "../Icon.tsx";

export interface ChipOption<T extends string> {
  value: T;
  label: string;
}

/**
 * Pick-several chips (PRD §8 Step 5). Built on real checkboxes, so Space toggles and screen
 * readers announce "checked". A tick shows the chosen ones, so colour is never the only signal.
 * The caller decides what ticking means, which lets "None of these" clear the others.
 */
export function ChipGroup<T extends string>({
  legend,
  hideLegend = false,
  options,
  isChecked,
  onToggle,
}: {
  legend: string;
  hideLegend?: boolean;
  options: readonly ChipOption<T>[];
  isChecked: (value: T) => boolean;
  onToggle: (value: T) => void;
}) {
  return (
    <fieldset>
      <legend className={hideLegend ? "sr-only" : "mb-2 text-sm font-semibold text-ink-800"}>{legend}</legend>
      <div className="flex flex-wrap gap-2.5">
        {options.map((o) => (
          <label
            key={o.value}
            className="group inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full bg-surface px-4 py-2 text-[15px] font-semibold text-ink-700 ring-1 ring-ink-300 transition-colors hover:ring-brand-400 has-checked:bg-brand-700 has-checked:text-white has-checked:ring-brand-700 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-brand-600"
          >
            <input type="checkbox" checked={isChecked(o.value)} onChange={() => onToggle(o.value)} className="sr-only" />
            <Icon name="check" className="hidden h-4 w-4 group-has-checked:block" />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
