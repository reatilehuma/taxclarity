import { Icon, type IconName } from "../Icon.tsx";

export interface Choice<T extends string> {
  value: T;
  title: string;
  description?: string;
  icon?: IconName;
  /** A small label on the card, like "Most accurate". */
  tag?: string;
}

/**
 * Big single-choice cards (PRD §8 Step 0). Built on real radio buttons, so arrow keys move
 * between cards, Space picks one and screen readers announce "1 of 3".
 */
export function ChoiceCards<T extends string>({
  legend,
  name,
  value,
  onChange,
  options,
}: {
  /** The question. Read out by screen readers; the visible heading above already shows it. */
  legend: string;
  name: string;
  value: T | null;
  onChange: (value: T) => void;
  options: Choice<T>[];
}) {
  return (
    <fieldset>
      <legend className="sr-only">{legend}</legend>
      <div className="grid gap-3">
        {options.map((o) => (
          <label
            key={o.value}
            className="group relative flex cursor-pointer items-start gap-4 rounded-2xl bg-surface p-4 ring-1 ring-ink-200 transition-all hover:ring-brand-300 has-checked:bg-brand-50 has-checked:ring-2 has-checked:ring-brand-600 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-brand-600 sm:p-5"
          >
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={value === o.value}
              onChange={() => onChange(o.value)}
              className="sr-only"
            />
            {o.icon && (
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700 transition-colors group-has-checked:bg-brand-700 group-has-checked:text-white">
                <Icon name={o.icon} className="h-5.5 w-5.5" />
              </span>
            )}
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2">
                <span className="text-base font-bold text-ink-950">{o.title}</span>
                {o.tag && (
                  <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[11px] font-semibold text-ink-700 group-has-checked:bg-brand-100 group-has-checked:text-brand-800">
                    {o.tag}
                  </span>
                )}
              </span>
              {o.description && <span className="mt-1 block text-[15px] leading-snug text-ink-600">{o.description}</span>}
            </span>
            {/* The check mark: icon + colour, never colour alone (PRD §17.3). */}
            <span
              aria-hidden="true"
              className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-surface text-transparent ring-1 ring-ink-300 transition-colors group-has-checked:bg-brand-700 group-has-checked:text-white group-has-checked:ring-brand-700"
            >
              <Icon name="check" className="h-4 w-4" />
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
