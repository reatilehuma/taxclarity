import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';

/**
 * A window that sits over the page and keeps the keyboard inside it: focus moves in when it opens, Tab and
 * Shift+Tab wrap, Escape and a tap outside close it, the page behind can't scroll, and focus goes back to
 * what opened it. `drawer` slides in from the right on wide screens; on a phone both fill the screen.
 */
export function Modal({
  title,
  onClose,
  children,
  variant = "centered",
  initialFocus,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  variant?: "centered" | "drawer";
  /** Which element gets focus first. Defaults to the close button. */
  initialFocus?: () => HTMLElement | null;
}) {
  const titleId = useId();
  const dialog = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    (initialFocus?.() ?? closeButton.current)?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      // Put focus back where the person was, if that is still on the page.
      if (opener && document.contains(opener)) opener.focus();
    };
    // Focus is placed once, when the window opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Escape") {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key !== "Tab" || !dialog.current) return;
    const items = [...dialog.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => {
      const closed = el.closest("details:not([open])");
      return !closed || (el.tagName === "SUMMARY" && el.parentElement === closed);
    });
    const first = items[0];
    const last = items[items.length - 1];
    if (!first || !last) return;
    const active = document.activeElement;
    const inside = dialog.current.contains(active);
    if (e.shiftKey && (active === first || !inside)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && (active === last || !inside)) {
      e.preventDefault();
      first.focus();
    }
  }

  const box =
    variant === "drawer"
      ? "h-full w-full sm:max-w-md sm:rounded-l-[var(--radius-card)]"
      : "max-h-full w-full max-w-lg rounded-[var(--radius-card)]";

  return (
    <div
      role="presentation"
      className={`fixed inset-0 z-50 flex bg-ink-950/50 ${variant === "drawer" ? "justify-end" : "items-center justify-center p-4"}`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* The dialog traps Tab and closes on Escape; the keys are handled where focus is, inside it. */}
      {/* oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={onKeyDown}
        className={`flex flex-col overflow-hidden bg-surface shadow-[var(--shadow-float)] ${box}`}
      >
        <div className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-ink-200 px-4">
          <h2 id={titleId} className="text-base font-bold text-ink-950">
            {title}
          </h2>
          <button
            ref={closeButton}
            type="button"
            onClick={onClose}
            className="inline-flex min-h-11 items-center rounded-xl px-3 text-sm font-semibold text-brand-800 hover:bg-brand-50"
          >
            Close<span className="sr-only"> {title.toLowerCase()}</span>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
