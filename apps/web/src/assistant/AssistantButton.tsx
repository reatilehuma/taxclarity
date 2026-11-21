import type { CalculationResult, Explanation, Recommendation } from "@taxclarity/tax-engine";
import { Suspense, useState } from "react";
import { lazyPage } from "../lib/lazyPage.tsx";
import { Button } from "../components/ui.tsx";
import { copy } from "../content/strings.ts";
import type { ComponentType } from "react";

type PanelProps = {
  result: CalculationResult;
  explanations: readonly Explanation[];
  recommendations: readonly Recommendation[];
  onClose: () => void;
  onDeclined: () => void;
};

/** The assistant is its own download, fetched only when it is first wanted. Nothing in the calculator depends on it. */
export const assistantPanel = lazyPage<PanelProps>(() => import("./AssistantPanel.tsx").then((m) => m.default as ComponentType<PanelProps>));

/**
 * The entry point on the results page (PRD §15.3). If the person says no, or the assistant can't load,
 * a plain message says so and the rest of the page is untouched.
 */
export function AssistantButton({
  result,
  explanations,
  recommendations,
}: {
  result: CalculationResult;
  explanations: readonly Explanation[];
  recommendations: readonly Recommendation[];
}) {
  const [open, setOpen] = useState(false);
  const [declined, setDeclined] = useState(false);
  const t = copy.assistant;

  return (
    <>
      <Button
        variant="secondary"
        icon="chat"
        iconPosition="before"
        aria-haspopup="dialog"
        onPointerEnter={() => void assistantPanel.preload()}
        onFocus={() => void assistantPanel.preload()}
        onClick={() => {
          setDeclined(false);
          setOpen(true);
        }}
      >
        {t.open}
      </Button>
      {declined && (
        <p role="status" className="basis-full text-sm text-ink-600">
          {t.unavailable}
        </p>
      )}
      {open && (
        <Suspense fallback={null}>
          <assistantPanel.Page
            result={result}
            explanations={explanations}
            recommendations={recommendations}
            onClose={() => setOpen(false)}
            onDeclined={() => {
              setOpen(false);
              setDeclined(true);
            }}
          />
        </Suspense>
      )}
    </>
  );
}
