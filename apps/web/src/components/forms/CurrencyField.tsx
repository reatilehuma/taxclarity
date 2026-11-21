import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { amountValue, caretAfterFormat, formatFinal, formatWhileTyping, parseAmountParts } from "../../lib/currency.ts";

/**
 * A rand amount field (PRD §9). The person types or pastes it any way they like ("R30 000",
 * "30,000.00", "30000"); it shows as "30 000" while typing and "30 000,00" once they leave.
 * The value handed back is always a plain number, or null when the field is empty.
 */
export function CurrencyField({
  label,
  hint,
  error,
  value,
  onChange,
  onBlur,
  optional = false,
  unit = "rand",
}: {
  label: React.ReactNode;
  hint?: React.ReactNode;
  /** A gentle message under the field; the field is marked invalid while it shows. */
  error?: string | null | undefined;
  value: number | null;
  onChange: (value: number | null) => void;
  onBlur?: () => void;
  optional?: boolean;
  /** Rand (R prefix, two decimals) or kilometres (km suffix, whole numbers). */
  unit?: "rand" | "km";
}) {
  const decimals = unit === "km" ? 0 : 2;
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const inputRef = useRef<HTMLInputElement>(null);

  const [text, setText] = useState(() => (value === null ? "" : formatFinal(value, decimals)));
  const lastEmitted = useRef<number | null>(value);
  const pendingCaret = useRef<number | null>(null);

  // Show a new value that came from somewhere else (a slider, a reset), but never fight typing.
  useEffect(() => {
    if (value !== lastEmitted.current) {
      lastEmitted.current = value;
      setText(value === null ? "" : formatFinal(value, decimals));
    }
  }, [value, decimals]);

  // Put the cursor back where the person was working after we reformat.
  useLayoutEffect(() => {
    if (pendingCaret.current !== null && inputRef.current) {
      inputRef.current.setSelectionRange(pendingCaret.current, pendingCaret.current);
      pendingCaret.current = null;
    }
  }, [text]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const typed = e.target.value;
    const parts = parseAmountParts(typed);
    if (decimals === 0) parts.fraction = null; // whole numbers only
    const next = formatWhileTyping(parts);
    const next_value = amountValue(parts);
    pendingCaret.current = caretAfterFormat(typed, e.target.selectionStart ?? typed.length, next);
    lastEmitted.current = next_value;
    setText(next);
    onChange(next_value);
  }

  function handleBlur() {
    if (value !== null) setText(formatFinal(value, decimals));
    else setText((t) => (t === "-" ? "" : t));
    onBlur?.();
  }

  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ") || undefined;

  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm font-semibold text-ink-800">
        {label}
        {optional && <span className="ml-1.5 font-normal text-ink-400">(optional)</span>}
        <span className="sr-only"> {unit === "km" ? "(in kilometres)" : "(in rand)"}</span>
      </label>
      <div
        className={`flex items-center rounded-xl bg-surface ring-1 transition-shadow focus-within:ring-2 ${
          error ? "ring-alert-ring focus-within:ring-alert-fg" : "ring-ink-300 focus-within:ring-brand-600"
        }`}
      >
        {unit === "rand" && (
          <span aria-hidden="true" className="pl-4 text-lg font-semibold text-ink-500">
            R
          </span>
        )}
        <input
          ref={inputRef}
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="next"
          value={text}
          onChange={handleChange}
          onBlur={handleBlur}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={`money min-h-13 w-full rounded-xl bg-transparent py-3 pr-4 text-xl font-semibold text-ink-950 outline-none placeholder:font-normal placeholder:text-ink-300 ${unit === "rand" ? "pl-2" : "pl-4"}`}
          placeholder={unit === "km" ? "0" : "0,00"}
        />
        {unit === "km" && (
          <span aria-hidden="true" className="pr-4 text-lg font-semibold text-ink-500">
            km
          </span>
        )}
      </div>
      {hint && (
        <p id={hintId} className="mt-2 text-sm text-ink-500">
          {hint}
        </p>
      )}
      {/* Always present so screen readers pick up messages as they appear (PRD §9). */}
      <div aria-live="polite">
        {error && (
          <p id={errorId} className="mt-2 text-sm font-medium text-alert-fg">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
