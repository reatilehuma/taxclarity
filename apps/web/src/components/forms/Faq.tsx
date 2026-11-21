import { useId } from "react";
import { Icon } from "../Icon.tsx";

export interface FaqItem {
  question: string;
  answer: string;
}

/** The little "Common questions" list under each wizard step (PRD §8: 2–4 plain-language items). */
export function Faq({ heading, items }: { heading: string; items: readonly FaqItem[] }) {
  const id = useId();
  if (items.length === 0) return null;
  return (
    <section aria-labelledby={id} className="mt-8">
      <h2 id={id} className="text-sm font-semibold text-ink-700">
        {heading}
      </h2>
      <div className="mt-3 divide-y divide-ink-200 rounded-2xl bg-surface ring-1 ring-ink-200/80">
        {items.map((item) => (
          <details key={item.question} className="group px-5">
            <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 py-3 text-[15px] font-semibold text-ink-900 [&::-webkit-details-marker]:hidden">
              {item.question}
              <Icon name="chevronDown" className="h-4 w-4 shrink-0 text-ink-500 transition-transform group-open:rotate-180" />
            </summary>
            <p className="pb-4 text-[15px] leading-relaxed text-ink-600">{item.answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
