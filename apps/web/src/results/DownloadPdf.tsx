import type { CalculationResult } from "@taxclarity/tax-engine";
import { useState } from "react";
import { Button } from "../components/ui.tsx";
import { copy } from "../content/strings.ts";

const t = copy.pdf;

/** Hands a finished file to the browser as an ordinary download. */
function saveFile(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  // Let the browser start the download before the address is let go.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/**
 * "Download PDF summary" (PRD §14.8). Shown only where there is a finished calculation. The PDF is made on this device
 * from the same result the page shows: the PDF library is loaded when the button is pressed, and nothing leaves the page.
 */
export function DownloadPdf({ result }: { result: CalculationResult }) {
  const [state, setState] = useState<"idle" | "creating" | "done" | "failed">("idle");

  async function make() {
    setState("creating");
    try {
      const { createSummaryPdf } = await import("../pdf/createSummaryPdf.ts");
      const { blob, fileName } = await createSummaryPdf(result);
      saveFile(blob, fileName);
      setState("done");
    } catch {
      // The results stay on screen; pressing the button again is the retry.
      setState("failed");
    }
  }

  return (
    <>
      <Button variant="secondary" icon="file" iconPosition="before" onClick={make} disabled={state === "creating"} aria-busy={state === "creating"}>
        {state === "creating" ? t.creating : state === "failed" ? t.retry : t.button}
      </Button>
      <p role="status" className={`basis-full text-sm empty:hidden ${state === "failed" ? "text-alert-fg" : "text-ink-600"}`}>
        {state === "done" ? t.done : state === "failed" ? t.failed : ""}
      </p>
    </>
  );
}
