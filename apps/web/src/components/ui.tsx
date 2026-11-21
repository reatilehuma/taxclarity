import { Link } from "react-router";
import { preloadWizard } from "../lazyPages.ts";
import { Icon, type IconName } from "./Icon.tsx";

/** Basic building blocks shared by every page. */

export function Container({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 ${className}`}>{children}</div>;
}

type ButtonVariant = "primary" | "secondary" | "ghost";

const BUTTON: Record<ButtonVariant, string> = {
  primary:
    "bg-brand-700 text-white shadow-[0_1px_0_rgb(255_255_255/0.15)_inset,0_8px_20px_-8px_rgb(6_35_31/0.6)] hover:bg-brand-800 active:bg-brand-900",
  secondary: "bg-surface text-brand-800 ring-1 ring-ink-200 hover:ring-brand-300 hover:bg-brand-50",
  ghost: "text-brand-800 hover:bg-brand-50",
};

/** Shared look for buttons and button-links. Minimum 44px tall so they're easy to tap (PRD §13.2). */
export function buttonClasses(variant: ButtonVariant, className = ""): string {
  return `inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 py-3 text-[15px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none ${BUTTON[variant]} ${className}`;
}

/** A real button (submits forms, runs actions). */
export function Button({
  variant = "primary",
  icon,
  iconPosition = "after",
  className = "",
  children,
  type = "button",
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  icon?: IconName;
  iconPosition?: "before" | "after";
}) {
  return (
    <button type={type} className={buttonClasses(variant, className)} {...rest}>
      {icon && iconPosition === "before" && <Icon name={icon} className="h-4.5 w-4.5" />}
      {children}
      {icon && iconPosition === "after" && <Icon name={icon} className="h-4.5 w-4.5" />}
    </button>
  );
}

/** A link styled as a button. Minimum 44px tall so it's easy to tap (PRD §13.2). */
export function ButtonLink({
  to,
  children,
  variant = "primary",
  icon,
  className = "",
}: {
  to: string;
  children: React.ReactNode;
  variant?: ButtonVariant;
  icon?: IconName;
  className?: string;
}) {
  // Touching or pointing at a button that leads to the questions starts downloading them, so they are ready on the click.
  const fetchAhead = to.startsWith("/wizard") ? { onPointerEnter: preloadWizard, onFocus: preloadWizard, onTouchStart: preloadWizard } : {};
  return (
    <Link to={to} className={buttonClasses(variant, className)} {...fetchAhead}>
      {children}
      {icon && <Icon name={icon} className="h-4.5 w-4.5" />}
    </Link>
  );
}

export function Pill({ icon, children, tone = "neutral" }: { icon?: IconName; children: React.ReactNode; tone?: "neutral" | "brand" }) {
  const cls = tone === "brand" ? "bg-brand-50 text-brand-800 ring-brand-100" : "bg-surface text-ink-700 ring-ink-200";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ring-1 ${cls}`}>
      {icon && <Icon name={icon} className="h-3.5 w-3.5" />}
      {children}
    </span>
  );
}

/** Estimate / payslip-accurate / example badge. Always icon + text, never colour alone (PRD §17.3). */
export function ConfidenceBadge({ kind, label }: { kind: "estimate" | "accurate" | "example"; label: string }) {
  const styles = {
    estimate: "bg-estimate-bg text-estimate-fg",
    accurate: "bg-accurate-bg text-accurate-fg",
    example: "bg-ink-100 text-ink-700",
  }[kind];
  const icon: IconName = kind === "estimate" ? "approx" : kind === "accurate" ? "checkCircle" : "info";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${styles}`}>
      <Icon name={icon} className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}

/** A thin strip of SA flag colours — a tiny accent, never a background (PRD §13.2). */
export function FlagStripe({ className = "" }: { className?: string }) {
  return (
    <span aria-hidden="true" className={`flex h-1 overflow-hidden rounded-full ${className}`}>
      <span className="flex-1 bg-sa-green" />
      <span className="flex-1 bg-sa-gold" />
      <span className="flex-1 bg-sa-red" />
      <span className="flex-1 bg-sa-blue" />
    </span>
  );
}

export function SectionHeading({ id, title, sub }: { id: string; title: string; sub?: string }) {
  return (
    <div className="mb-8 max-w-2xl sm:mb-10">
      <h2 id={id} className="text-2xl font-bold tracking-tight text-ink-950 sm:text-3xl">
        {title}
      </h2>
      {sub && <p className="mt-2 text-base text-ink-600 sm:text-lg">{sub}</p>}
    </div>
  );
}
