import type { ReactNode } from "react";

/** A titled block of the results page. The heading is an h2; the page's h1 is the headline sentence. */
export function Section({ id, title, sub, children }: { id: string; title: string; sub?: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="mt-12">
      <h2 id={id} className="text-xl font-bold tracking-tight text-ink-950 sm:text-2xl">
        {title}
      </h2>
      {sub && <p className="mt-1.5 max-w-prose text-[15px] text-ink-600">{sub}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}
