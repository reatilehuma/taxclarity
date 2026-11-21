import { useId } from "react";
import { amountError } from "./form.ts";

/** Workbench-only controls. The real wizard components arrive in Phase 6. */

export function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">{children}</div>;
}

export function MoneyField({
  label,
  hint,
  value,
  onChange,
  optional = false,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  /** Blank is allowed and means "not given". */
  optional?: boolean;
}) {
  const id = useId();
  const error = amountError(value, optional);
  return (
    <div className="mb-4">
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
        {optional && <span className="ml-1 font-normal text-slate-400">(optional)</span>}
      </label>
      <div className="flex items-center rounded-lg border border-slate-300 bg-white focus-within:border-brand-600 focus-within:ring-2 focus-within:ring-brand-100">
        <span className="pl-3 text-slate-500" aria-hidden="true">
          R
        </span>
        <input
          id={id}
          inputMode="decimal"
          autoComplete="off"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={`${id}-msg`}
          className="money w-full rounded-lg bg-transparent px-2 py-2 text-base outline-none"
        />
      </div>
      <p id={`${id}-msg`} aria-live="polite" className={`mt-1 text-xs ${error ? "text-red-700" : "text-slate-500"}`}>
        {error ?? hint ?? "Rand."}
      </p>
    </div>
  );
}

export function NumberField({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const id = useId();
  const error = amountError(value);
  return (
    <div className="mb-4">
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
      </label>
      <input
        id={id}
        inputMode="decimal"
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={`${id}-msg`}
        className="money w-full rounded-lg border border-slate-300 px-3 py-2 text-base outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
      />
      <p id={`${id}-msg`} aria-live="polite" className={`mt-1 text-xs ${error ? "text-red-700" : "text-slate-500"}`}>
        {error ?? hint ?? ""}
      </p>
    </div>
  );
}

export function Segmented<T extends string>({
  legend,
  name,
  value,
  onChange,
  options,
}: {
  legend: string;
  name: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <fieldset className="mb-4">
      <legend className="mb-1.5 text-sm font-medium text-slate-700">{legend}</legend>
      <div
        className="grid gap-1 rounded-lg bg-slate-100 p-1"
        style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
      >
        {options.map((o) => (
          <label
            key={o.value}
            className="cursor-pointer rounded-md px-2 py-2 text-center text-xs font-medium text-slate-600 has-checked:bg-white has-checked:text-brand-700 has-checked:shadow-sm has-focus-visible:outline-2 has-focus-visible:outline-brand-600"
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

export function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4">
      <span className="text-base font-semibold text-slate-900">{label}</span>
      <input
        type="checkbox"
        role="switch"
        aria-checked={checked}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden="true"
        className="relative h-6 w-11 shrink-0 rounded-full bg-slate-300 transition-colors peer-checked:bg-brand-600 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand-600 after:absolute after:top-0.5 after:left-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:after:translate-x-5"
      />
    </label>
  );
}

export function Checkbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="mb-4 flex items-center gap-2 text-sm text-slate-700">
      <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

export function Stepper({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  const id = useId();
  const clamp = (v: number) => Math.min(max, Math.max(min, Math.round(v)));
  const btn =
    "h-9 w-9 rounded-lg border border-slate-300 text-lg leading-none text-slate-700 hover:bg-slate-50 disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-brand-600";
  return (
    <div className="mb-4">
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <button type="button" className={btn} onClick={() => onChange(clamp(value - 1))} disabled={value <= min} aria-label="Decrease">
          −
        </button>
        <input
          id={id}
          type="number"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(clamp(Number(e.target.value) || min))}
          className="money h-9 w-16 rounded-lg border border-slate-300 text-center"
        />
        <button type="button" className={btn} onClick={() => onChange(clamp(value + 1))} disabled={value >= max} aria-label="Increase">
          +
        </button>
      </div>
    </div>
  );
}

export function SubHeading({ children }: { children: React.ReactNode }) {
  return <h4 className="mt-2 mb-3 border-t border-slate-100 pt-4 text-sm font-semibold text-slate-900">{children}</h4>;
}
