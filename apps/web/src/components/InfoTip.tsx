import { useId } from "react";
import { Icon } from "./Icon.tsx";

/** A small "i" that explains a term on hover, keyboard focus or tap. The text is read out with the label. */
export function InfoTip({ label, hint }: { label: string; hint: string }) {
  const id = useId();
  return (
    <span className="group relative inline-flex">
      <span
        // A focusable span so keyboard users can reach the explanation: it's a tooltip trigger, not a control.
        // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex
        tabIndex={0}
        aria-describedby={id}
        className="inline-flex cursor-help rounded-full text-ink-400 hover:text-brand-700 focus-visible:text-brand-700"
      >
        <Icon name="info" className="h-3.5 w-3.5" />
        <span className="sr-only">About {label.toLowerCase()}</span>
      </span>
      <span
        id={id}
        role="tooltip"
        className="pointer-events-none invisible absolute bottom-full left-1/2 z-10 mb-2 w-56 -translate-x-1/2 rounded-lg bg-ink-900 px-3 py-2 text-xs font-normal leading-snug text-white opacity-0 shadow-lg transition-opacity group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100"
      >
        {hint}
      </span>
    </span>
  );
}
