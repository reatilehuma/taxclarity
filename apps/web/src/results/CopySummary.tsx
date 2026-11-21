import type { CalculationResult } from "@taxclarity/tax-engine";
import { useRef, useState } from "react";
import { Button } from "../components/ui.tsx";
import { copy } from "../content/strings.ts";
import { summaryText } from "./summaryText.ts";

const t = copy.results.copy;

/** Puts a short plain-text summary on the clipboard. User-started; nothing leaves the device. */
export function CopySummary({ result }: { result: CalculationResult }) {
  const [state, setState] = useState<"idle" | "done" | "failed">("idle");
  const fallback = useRef<HTMLTextAreaElement>(null);
  const text = summaryText(result);

  async function copyIt() {
    try {
      await navigator.clipboard.writeText(text);
      setState("done");
    } catch {
      setState("failed");
    }
  }

  return (
    <>
      <Button variant="secondary" icon="copy" iconPosition="before" onClick={copyIt}>
        {t.button}
      </Button>
      <p role="status" className="basis-full text-sm text-ink-600 empty:hidden">
        {state === "done" ? t.done : state === "failed" ? t.failed : ""}
      </p>
      {state === "failed" && (
        <textarea
          ref={fallback}
          readOnly
          rows={6}
          aria-label={t.button}
          value={text}
          onFocus={(e) => e.currentTarget.select()}
          className="basis-full rounded-xl border border-ink-200 bg-surface p-3 text-sm text-ink-800"
        />
      )}
    </>
  );
}
