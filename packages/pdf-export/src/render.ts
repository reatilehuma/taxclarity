import pdfMake from "pdfmake/build/pdfmake";
import type { Content, TableCell, TDocumentDefinitions } from "pdfmake/interfaces";
import type { NoticeList, SummaryDocument, SummaryTable } from "./types.ts";

/**
 * Draws a summary document as a PDF, entirely in the browser (PRD §14.8). pdfmake builds real text with the font
 * embedded, so the file can be searched, selected and read aloud. Nothing is uploaded, nothing is stored, and the library
 * is told it may not fetch any address.
 *
 * Chosen after a prototype against jsPDF + AutoTable (docs/PDF-LIBRARY.md): both run under the site's strict content
 * policy; pdfmake subsets the font, numbers pages natively, repeats table headers, and can tag the file for accessibility.
 *
 * This module is a separate entry on purpose: the app loads it only when someone presses "Download PDF summary".
 */

/** The typeface, as the bytes of two TrueType files (regular and bold). The app fetches them from its own assets. */
export interface PdfFonts {
  regular: ArrayBuffer | Uint8Array;
  bold: ArrayBuffer | Uint8Array;
}

// The look: the app's own teal and greys, in the shape of the reference summary (section bars, ruled tables, shaded totals).
const BRAND = "#114741"; // brand-800
const BRAND_PALE = "#eef8f6"; // brand-50
const BRAND_TINT = "#d3eee8"; // brand-100
const INK = "#1a201f"; // ink-900
const MUTED = "#525d5c"; // ink-600
const LINE = "#d9dddd"; // ink-200

const FONT = "InterTabular";
const MARGINS = { left: 40, right: 40, top: 46, bottom: 58 };
/** A4 is 595.28 pt wide: what is left between the margins. */
const CONTENT_WIDTH = 595.28 - MARGINS.left - MARGINS.right;

/** Standard base64 of some bytes, without needing Node's Buffer, so it runs in a browser and in tests. */
function toBase64(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";
  for (let i = 0; i < view.length; i += 0x8000) binary += String.fromCharCode(...view.subarray(i, i + 0x8000));
  return btoa(binary);
}

let installed: PdfFonts | null = null;
function installFonts(fonts: PdfFonts): void {
  if (installed?.regular === fonts.regular && installed.bold === fonts.bold) return;
  pdfMake.addVirtualFileSystem({ "InterTabular-400.ttf": toBase64(fonts.regular), "InterTabular-700.ttf": toBase64(fonts.bold) });
  pdfMake.addFonts({ [FONT]: { normal: "InterTabular-400.ttf", bold: "InterTabular-700.ttf", italics: "InterTabular-400.ttf", bolditalics: "InterTabular-700.ttf" } });
  // The library must never reach for an address: no images, fonts or files are fetched from anywhere.
  pdfMake.setUrlAccessPolicy(() => false);
  installed = fonts;
}

/** Thin ruled cells, as in the reference; `fills` colours whole rows by index. */
function ruled(fills: Record<number, string>) {
  return {
    hLineWidth: () => 0.6,
    vLineWidth: () => 0.6,
    hLineColor: () => LINE,
    vLineColor: () => LINE,
    paddingLeft: () => 8,
    paddingRight: () => 8,
    paddingTop: () => 4.5,
    paddingBottom: () => 4.5,
    fillColor: (row: number) => fills[row] ?? null,
  };
}

/** A dark section bar, like the reference's "Amounts Assessed", as the first (repeating) row of its table. */
const bar = (text: string, span: number): TableCell[] => [
  { text, colSpan: span, color: "#ffffff", bold: true, fontSize: 11, margin: [0, 1.5, 0, 1.5] },
  ...Array.from({ length: span - 1 }, () => ({})),
];

function detailsBlock(doc: SummaryDocument): Content {
  return {
    margin: [0, 0, 0, 14],
    table: {
      headerRows: 1,
      widths: [150, "*"],
      body: [
        bar(doc.details.heading, 2),
        ...doc.details.rows.map((r): TableCell[] => [{ text: r.label, color: MUTED }, { text: r.value, bold: true }]),
      ],
    },
    layout: { ...ruled({ 0: BRAND }), hLineColor: (i: number) => (i === 0 ? BRAND : LINE), vLineWidth: () => 0, hLineWidth: (i: number) => (i === 0 ? 0 : 0.6) },
  };
}

/** Fill, text colour and weight for the lines a table wants to stand out. */
const EMPHASIS = {
  total: { fill: BRAND_TINT, color: INK },
  subtotal: { fill: "#f1f3f3", color: INK },
  highlight: { fill: BRAND, color: "#ffffff" },
} as const;

function amountsTable(table: SummaryTable): Content[] {
  const three = table.columns.month !== undefined;
  const span = three ? 3 : 2;
  const fills: Record<number, string> = { 0: BRAND, 1: BRAND_PALE };
  const head: TableCell[] = [{ text: table.columns.description, bold: true }];
  if (three) head.push({ text: table.columns.month ?? "", bold: true, alignment: "right" });
  head.push({ text: table.columns.amount, bold: true, alignment: "right" });
  const body: TableCell[][] = [bar(table.heading, span), head];
  table.rows.forEach((r, i) => {
    const style = r.emphasis ? EMPHASIS[r.emphasis] : null;
    if (style) fills[i + 2] = style.fill;
    const cell = (text: string, alignment?: "right"): TableCell => ({
      text,
      bold: style !== null,
      ...(style ? { color: style.color } : {}),
      ...(alignment ? { alignment } : {}),
    });
    const line: TableCell[] = [cell(r.label)];
    if (three) line.push(r.month ? cell(r.month.amount, "right") : { text: "—", alignment: "right", color: MUTED });
    line.push(cell(r.amount, "right"));
    body.push(line);
  });
  const block: Content = {
    // These tables are short: keep each on one page, so a heading is never parted from the figures it adds up.
    unbreakable: true,
    margin: [0, 0, 0, table.notes.length > 0 ? 4 : 14],
    // The bar and the column headings repeat if the table runs onto another page, a row is never split, and the headings
    // are never left alone at the foot of a page.
    table: { headerRows: 2, keepWithHeaderRows: 1, dontBreakRows: true, widths: three ? ["*", 105, 105] : ["*", 130], body },
    layout: ruled(fills),
  };
  return [block, ...notesUnder(table.notes)];
}

/** Small print under a table: how it joins the one before, what is not in it. */
function notesUnder(notes: string[]): Content[] {
  return notes.map((n, i) => ({ text: n, color: MUTED, fontSize: 8.5, lineHeight: 1.25, margin: [0, 0, 0, i === notes.length - 1 ? 14 : 3] }));
}

/** What the payslip comparison means, in a box of its own under the comparison table (PRD §14.4). */
function verdictBlock(v: NonNullable<SummaryDocument["comparisonVerdict"]>): Content[] {
  return [
    {
      margin: [0, 0, 0, 14],
      table: {
        widths: ["*"],
        body: [
          [
            {
              stack: [
                { text: v.verdict, bold: true },
                { text: v.explainHeading, bold: true, color: BRAND, margin: [0, 6, 0, 2] },
                { text: v.explain, lineHeight: 1.3 },
              ],
            },
          ],
        ],
      },
      layout: { ...ruled({ 0: BRAND_PALE }), paddingTop: () => 7, paddingBottom: () => 7 },
    },
  ];
}

/** Warnings, assumptions and exclusions: a section bar, then one block for each item. A block is never split. */
function noticeBlock(list: NoticeList): Content {
  const rows: TableCell[][] = list.items.map((item) => {
    const stack: Content[] = [];
    if (item.title) stack.push({ text: item.title, bold: true });
    stack.push({ text: item.body, lineHeight: 1.25, margin: [0, item.title ? 1 : 0, 0, 0] });
    if (item.source) stack.push({ text: item.source, color: MUTED, fontSize: 8, margin: [0, 2, 0, 0] });
    return [{ stack }];
  });
  return {
    margin: [0, 0, 0, 14],
    table: { headerRows: 1, keepWithHeaderRows: 1, dontBreakRows: true, widths: ["*"], body: [bar(list.heading, 1), ...rows] },
    layout: { ...ruled({ 0: BRAND }), paddingTop: (row: number) => (row === 0 ? 4.5 : 6), paddingBottom: (row: number) => (row === 0 ? 4.5 : 6) },
  };
}

function disclaimerBlock(doc: SummaryDocument): Content {
  return {
    table: { headerRows: 1, widths: ["*"], body: [bar(doc.disclaimer.heading, 1), [{ text: doc.disclaimer.paragraph, color: INK, lineHeight: 1.3 }]] },
    layout: { ...ruled({ 0: BRAND }), paddingTop: (row: number) => (row === 0 ? 4 : 8), paddingBottom: (row: number) => (row === 0 ? 4 : 8) },
  };
}

/** The page definition for a summary document. Exposed so tests can inspect it without drawing it. */
export function toDocDefinition(doc: SummaryDocument): TDocumentDefinitions {
  return {
    pageSize: "A4",
    pageMargins: [MARGINS.left, MARGINS.top, MARGINS.right, MARGINS.bottom],
    defaultStyle: { font: FONT, fontSize: 9.5, color: INK, lineHeight: 1.2 },
    language: "en-ZA",
    tagged: true,
    displayTitle: true,
    // Only the app's name and the title. The creation date is the day it was made; there is no author, subject or keywords.
    info: { title: doc.meta.title, creator: doc.meta.creator, producer: doc.meta.creator },
    content: [
      { text: doc.productName, bold: true, color: BRAND, fontSize: 12 },
      { text: doc.title, bold: true, fontSize: 17, margin: [0, 12, 0, 4] },
      { canvas: [{ type: "line", x1: 0, y1: 0, x2: CONTENT_WIDTH, y2: 0, lineWidth: 2, lineColor: BRAND }] },
      { text: doc.subtitle, color: MUTED, margin: [0, 6, 0, 16] },
      detailsBlock(doc),
      ...doc.tables.flatMap((t) => [...amountsTable(t), ...(t.id === "comparison" && doc.comparisonVerdict ? verdictBlock(doc.comparisonVerdict) : [])]),
      ...doc.notices.map(noticeBlock),
      disclaimerBlock(doc),
    ],
    footer: (page: number, pages: number): Content => ({
      margin: [MARGINS.left, 22, MARGINS.right, 0],
      columns: [
        { text: doc.footer.rules, color: MUTED, fontSize: 7.5, width: "*" },
        { text: doc.footer.page(page, pages), alignment: "right", fontSize: 8, width: "auto" },
      ],
    }),
  };
}

/** The finished PDF as bytes. The app wraps them in a download; tests read them back. */
export async function renderSummaryPdf(doc: SummaryDocument, fonts: PdfFonts): Promise<Uint8Array> {
  installFonts(fonts);
  const buffer = await pdfMake.createPdf(toDocDefinition(doc)).getBuffer();
  return new Uint8Array(buffer);
}
