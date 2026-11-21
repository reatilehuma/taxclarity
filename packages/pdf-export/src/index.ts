// The pure half of the package: the summary as data. The renderer (pdfmake) is a separate entry, "./render", so a page
// that only needs the data never loads the PDF library.
export { buildSummaryDocument, summaryFileName } from "./build.ts";
export type {
  IncomeRowId,
  PdfFormat,
  PdfText,
  SummaryDocument,
  SummaryRow,
  SummaryTable,
} from "./types.ts";
