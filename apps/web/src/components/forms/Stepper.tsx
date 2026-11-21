import { useId, useState } from "react";
import { Icon } from "../Icon.tsx";

/**
 * A whole-number stepper with direct entry, clamped to a range (PRD §9: 1–15 for people on a plan).
 * The − and + buttons are real buttons; the number can also be typed.
 */
export function Stepper({
  label,
  value,
  min,
  max,
  onChange,
  moreLabel,
  fewerLabel,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  /** Screen-reader names for the buttons. */
  moreLabel: string;
  fewerLabel: string;
}) {
  const id = useId();
  const clamp = (n: number) => Math.min(max, Math.max(min, Math.round(n)));

  // While typing, the box may briefly be empty or out of range; settle it when they leave.
  const [text, setText] = useState(String(value));
  const [shownValue, setShownValue] = useState(value);
  if (shownValue !== value) {
    setShownValue(value);
    setText(String(value));
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/\D/g, "").slice(0, 3);
    setText(digits);
    if (digits !== "") onChange(clamp(Number(digits)));
  }

  const button =
    "grid h-12 w-12 shrink-0 place-items-center text-ink-700 transition-colors hover:bg-brand-50 hover:text-brand-800 disabled:cursor-not-allowed disabled:text-ink-300 disabled:hover:bg-transparent";

  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm font-semibold text-ink-800">
        {label}
      </label>
      <div className="inline-flex items-center overflow-hidden rounded-xl bg-surface ring-1 ring-ink-300 focus-within:ring-2 focus-within:ring-brand-600">
        <button type="button" className={button} aria-label={fewerLabel} disabled={value <= min} onClick={() => onChange(clamp(value - 1))}>
          <Icon name="minus" className="h-5 w-5" />
        </button>
        <input
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={text}
          onChange={handleChange}
          onBlur={() => setText(String(value))}
          className="money h-12 w-16 border-x border-ink-200 bg-transparent text-center text-xl font-semibold text-ink-950 outline-none"
        />
        <button type="button" className={button} aria-label={moreLabel} disabled={value >= max} onClick={() => onChange(clamp(value + 1))}>
          <Icon name="plus" className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
