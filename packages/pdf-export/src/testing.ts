import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

/**
 * Reads a PDF back the way a reader would: the text on each page, in order, and the file's own metadata. Used by tests (here
 * and in the browser tests) to check what the page really says. Not part of the app.
 */
export interface ReadPage {
  width: number;
  height: number;
  /** Every piece of text on the page, in reading order. */
  items: string[];
  /** The page's text joined with single spaces. */
  text: string;
  /** Where each piece of text sits: from the left and the bottom of the page, in points. Height is the font size. */
  boxes: { str: string; x: number; y: number; width: number; height: number }[];
}

export interface ReadPdf {
  pages: ReadPage[];
  info: Record<string, unknown>;
  /** The raw bytes as text, for checking things like embedded fonts and tagging. */
  raw: string;
}

export async function readPdf(bytes: Uint8Array): Promise<ReadPdf> {
  const task = getDocument({ data: new Uint8Array(bytes), useSystemFonts: false, verbosity: 0 });
  const pdf = await task.promise;
  const pages: ReadPage[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const view = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    const items = content.items.flatMap((it) => ("str" in it && it.str.trim() !== "" ? [it.str] : []));
    const boxes = content.items.flatMap((it) =>
      "str" in it && it.str.trim() !== "" ? [{ str: it.str, x: it.transform[4] as number, y: it.transform[5] as number, width: it.width, height: it.height }] : [],
    );
    pages.push({ width: view.width, height: view.height, items, text: items.join(" ").replace(/[\s\u00a0]+/g, " "), boxes });
  }
  const meta = await pdf.getMetadata();
  await task.destroy();
  return { pages, info: meta.info as Record<string, unknown>, raw: new TextDecoder("latin1").decode(bytes) };
}
