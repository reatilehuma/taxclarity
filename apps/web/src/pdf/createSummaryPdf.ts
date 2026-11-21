import type { CalculationResult } from "@taxclarity/tax-engine";
import regularFontUrl from "@taxclarity/pdf-export/fonts/InterTabular-400.ttf?url";
import boldFontUrl from "@taxclarity/pdf-export/fonts/InterTabular-700.ttf?url";
import { renderSummaryPdf } from "@taxclarity/pdf-export/render";
import { buildSummaryDocument, summaryFileName } from "@taxclarity/pdf-export";
import { pdfText } from "../content/strings.ts";
import { formatDate, formatPercentPoints, formatRand } from "../lib/format.ts";
import { sourceFor } from "../lib/sources.ts";

/**
 * Makes the PDF summary for a result (PRD §14.8). This module is loaded only when someone presses "Download PDF summary":
 * it is the one place the PDF library and the font files are pulled in, so the pages people see first stay small. The
 * font files are the app's own assets (same address, so the content policy needs no change), and the service worker keeps
 * them with everything else for offline use. Nothing is sent anywhere.
 */

async function fontBytes(url: string): Promise<Uint8Array> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`font ${url}: ${response.status}`);
  return new Uint8Array(await response.arrayBuffer());
}

/** The day the PDF is made, as an ISO date in the person's own time zone: it is printed on the page. */
export function todayIso(now: Date = new Date()): string {
  const two = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${two(now.getMonth() + 1)}-${two(now.getDate())}`;
}

/** The summary document for a result, worded and formatted exactly as the rest of the app. */
export function summaryDocumentFor(result: CalculationResult, generatedOn: string) {
  return buildSummaryDocument({
    result,
    text: pdfText,
    format: { rand: (n) => formatRand(n), date: formatDate, percent: (points) => formatPercentPoints(points) },
    // Links that name a year follow the year of the result (PRD §6.16), written out as text on the page.
    source: (id) => sourceFor(id, result.taxYear),
    generatedOn,
  });
}

export async function createSummaryPdf(result: CalculationResult, generatedOn: string = todayIso()): Promise<{ blob: Blob; fileName: string }> {
  const [regular, bold] = await Promise.all([fontBytes(regularFontUrl), fontBytes(boldFontUrl)]);
  const bytes = await renderSummaryPdf(summaryDocumentFor(result, generatedOn), { regular, bold });
  return {
    blob: new Blob([bytes as BlobPart], { type: "application/pdf" }),
    fileName: summaryFileName(pdfText.filenamePrefix, result.taxYear, generatedOn),
  };
}
